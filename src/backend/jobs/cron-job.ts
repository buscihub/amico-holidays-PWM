import cron from 'node-cron';
import { getDb } from '../db-config';
import ical from 'node-ical';
import { get } from 'http';

/**
 * Converte un oggetto Date nel formato YYYY-MM-DD richiesto da SQLite
 * Risolve i bug nativi di JS: getMonth() (+1) e getPercentuale di getDate()
 */
const formatDataDB = (data: Date): string => {
  const anno = data.getFullYear();
  // padStart aggiunge lo zero iniziale se il mese o giorno è a una sola cifra (es: "06" invece di "6")
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const gg = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${gg}`;
};

export const startSincJob = (): void => {
  cron.schedule('* * * * *', (): any => {
    console.log('\n--- 🔄 Avvio Sincronizzazione iCal Airbnb ---', new Date().toLocaleString());

    const db = getDb();

    // 1. PULIZIA AUTOMATICA RECORD 'PENDING' SCADUTI
    const sqlGarbageCollection = `
      DELETE FROM SOGGIORNI 
      WHERE stato_prenotazione = 'pending' 
        AND data_creazione_record < DATETIME('now', '-30 minutes')
    `;
    db.run(sqlGarbageCollection, [], (errClean) => {
      if (errClean) {
        console.error('❌ Errore pulizia pending scaduti: ' + errClean.message);
      }
    });

    const sqlGetIcal = 'SELECT id_alloggio, link_ical FROM ALLOGGIO WHERE link_ical IS NOT NULL';

    db.all(sqlGetIcal, [], async (err: Error | null, rows: any[]) => {
      if (err) {
        console.error('❌ Errore nel recupero dei link iCal: ' + err.message);
        return;
      }

      for (const row of rows) {
        const { id_alloggio, link_ical } = row;

        try {
          const eventi = await ical.async.fromURL(link_ical);

          // Pulizia parziale: eliminiamo solo quelle effettivamente confermate da iCal 
          // per rinfrescarle, senza toccare i pending del sito.
          const sqlPulisci = `
            DELETE FROM SOGGIORNI 
            WHERE id_alloggio = ? 
              AND sorgente = 'PrenotazioneAirbnb' 
              AND stato_prenotazione = 'confirmed'
          `;
          
          db.run(sqlPulisci, [id_alloggio], (errPulisci) => {
            if (errPulisci) {
              console.error('❌ Errore pulizia vecchi dati alloggio: ' + errPulisci.message);
              return;
            }

            for (const key in eventi) {
              const evento = eventi[key];

              if (evento?.type === 'VEVENT' && evento.start && evento.end) {
                const checkIn = formatDataDB(evento.start as Date);
                const checkOut = formatDataDB(evento.end as Date);
                const sommarioMinuscolo = ((evento.summary as string) || '').toLowerCase();

                let sorgenteReale = 'PrenotazioneAirbnb';
                let statoIniziale = 'confirmed';

                if (sommarioMinuscolo.includes('not available') || sommarioMinuscolo.includes('airbnb_not_available')) {
                  sorgenteReale = 'BloccatoAirbnb';
                }

                // 🔍 FLUSSO DI MATCHING INTELLIGENTE
                const sqlTrovaPending = `
                  SELECT id_soggiorno FROM SOGGIORNI 
                  WHERE id_alloggio = ? 
                    AND data_check_in = ? 
                    AND data_check_out = ? 
                    AND stato_prenotazione = 'pending'
                `;

                db.get(sqlTrovaPending, [id_alloggio, checkIn, checkOut], (errMatch, rowPending: any) => {
                  if (errMatch) {
                    console.error('❌ Errore controllo matching: ' + errMatch.message);
                    return;
                  }

                  if (rowPending) {
                    // 👉 MATCH: L'utente ha pagato, confermiamo il record del sito
                    const sqlConfermaSoggiorno = `
                      UPDATE SOGGIORNI 
                      SET stato_prenotazione = 'confirmed', 
                          sorgente = 'PrenotazioneAirbnb' 
                      WHERE id_soggiorno = ?
                    `;
                    db.run(sqlConfermaSoggiorno, [rowPending.id_soggiorno], (errUp) => {
                      if (errUp) {
                        console.error('❌ Errore aggiornamento stato prenotazione: ' + errUp.message);
                      } else {
                        console.log(`🔗 [Match Success] Agganciata e confermata prenotazione sito ID: ${rowPending.id_soggiorno}`);
                      }
                    });
                  } else {
                    // 👉 NESSUN MATCH: Verifica se è un overbooking reale con altre confermate
                    const sqlCheckOverbooking = `
                      SELECT id_soggiorno FROM SOGGIORNI 
                      WHERE id_alloggio = ? 
                        AND data_check_in < ? 
                        AND data_check_out > ? 
                        AND stato_prenotazione = 'confirmed'
                    `;

                    db.get(sqlCheckOverbooking, [id_alloggio, checkOut, checkIn], (errOver, rowOver) => {
                      if (errOver) {
                        console.error('❌ Errore controllo disponibilità: ' + errOver.message);
                        return;
                      }

                      if (!rowOver) {
                        const sqlInsertDinamico = `
                          INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente, stato_prenotazione, data_creazione_record) 
                          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `;
                        db.run(sqlInsertDinamico, [id_alloggio, checkIn, checkOut, sorgenteReale, statoIniziale], (errIns) => {
                          if (errIns) console.error('❌ Errore inserimento soggiorno: ' + errIns.message);
                        });
                      } else {
                        console.warn(`⚠️ [Overbooking Rilevato] Date occupate per alloggio ${id_alloggio} dal ${checkIn} al ${checkOut}`);
                      }
                    });
                  }
                });
              }
            }
          });
        } catch (error) {
          console.error('❌ Errore di rete/download o DB non pronto');
        }
      }
    });
  });
};