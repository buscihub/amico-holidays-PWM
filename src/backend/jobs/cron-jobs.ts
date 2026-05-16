import cron from 'node-cron';
import { getDb } from '../db-config';
import ical from 'node-ical';

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
  // Configurato per girare OGNI MINUTO durante i test (* * * * *)
  cron.schedule('* * * * *', (): any => {
    console.log('\n--- 🔄 Avvio Sincronizzazione iCal Airbnb ---', new Date().toLocaleString());

    const db = getDb();

    // 1. RECUPERO I LINK DAL DB
    const sqlGetIcal = 'SELECT id_alloggio, link_ical FROM ALLOGGIO WHERE link_ical IS NOT NULL';

    db.all(sqlGetIcal, [], async (err: Error | null, rows: any[]) => {
      if (err) {
        console.error('❌ Errore nel recupero dei link iCal:', err.message);
        return;
      }

      // Ciclo asincrono per elaborare ogni alloggio in sequenza
      for (const row of rows) {
        const { id_alloggio, link_ical } = row;
        console.log(`⏳ Sincronizzazione Alloggio ID: ${id_alloggio}...`);

        try {
          // 2. SCARICO E PARSO IL FILE .ICS DA AIRBNB
          const eventi = await ical.async.fromURL(link_ical);

          // 3. PULISCO LE VECCHIE PRENOTAZIONI AIRBNB (Evita duplicati storici)
          const sqlPulisci = `DELETE FROM SOGGIORNI WHERE id_alloggio = ? AND sorgente = 'PrenotazioneAirbnb'`;

          db.run(sqlPulisci, [id_alloggio], (errPulisci: Error | null) => {
            if (errPulisci) {
              console.error(
                `❌ Errore pulizia vecchi dati alloggio ${id_alloggio}:`,
                errPulisci.message,
              );
              return;
            }

            // 4. AGGIORNAMENTO DEL CALENDARIO (Inserimento nuovi blocchi)
            // Corretto "INSO" con "INTO"
            const sqlInsert = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'PrenotazioneAirbnb')`;

            // Scorro tutti gli eventi presenti nel file iCal scaricato
            for (const key in eventi) {
              const evento = eventi[key];

              // Filtriamo isolando solo gli eventi di tipo VEVENT (le prenotazioni effettive)
              if (evento?.type === 'VEVENT' && evento.start && evento.end) {
                const checkIn = formatDataDB(evento.start as Date);
                const checkOut = formatDataDB(evento.end as Date);

                // Leggiamo il testo descrittivo che ci manda Airbnb (es: "Airbnb - XYZ" oppure "AIRBNB_NOT_AVAILABLE")
                const sommario = (evento.summary as string) || '';

                // Trasformiamo tutto in minuscolo per evitare problemi di maiuscole/minuscole
                const sommarioMinuscolo = sommario.toLowerCase();

                // Di base per il DB è una prenotazione arrivata da Airbnb
                let sorgenteReale = 'PrenotazioneAirbnb';

                // Controlliamo se il testo contiene "not available" (copre sia con le parentesi che senza)
                if (
                  sommarioMinuscolo.includes('not available') ||
                  sommarioMinuscolo.includes('airbnb_not_available')
                ) {
                  sorgenteReale = 'BloccatoAirbnb';
                }

                // 🔴 STAMPA DI CONTROLLO TEMPORANEA (Guarda il terminale!)
                console.log(
                  `[Alloggio ${id_alloggio}] Trovato blocco dal ${checkIn} al ${checkOut} - Testo Airbnb: "${sommario}"`,
                );

                // Se Airbnb ci dice che è un blocco manuale o non disponibile, cambiamo l'etichetta
                if (
                  sommario.includes('AIRBNB_NOT_AVAILABLE') ||
                  sommario.includes('Not available')
                ) {
                  sorgenteReale = 'BloccatoAirbnb';
                }

                // Modifichiamo al volo la query per inserire la sorgente dinamica
                const sqlInsertDinamico = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, ?)`;

                db.run(
                  sqlInsertDinamico,
                  [id_alloggio, checkIn, checkOut, sorgenteReale],
                  (errInsert: Error | null) => {
                    if (errInsert) {
                      console.error(
                        `❌ Errore inserimento data Airbnb per alloggio ${id_alloggio} (${checkIn}):`,
                        errInsert.message,
                      );
                    }
                  },
                );
              }
            }
            console.log(`✅ Alloggio ${id_alloggio} sincronizzato con successo!`);
          });
        } catch (error) {
          // Se un link fallisce (es. host ha inserito un URL errato), il catch lo blocca e il ciclo continua per gli altri alloggi
          console.error(`❌ Errore di rete/download per alloggio ${id_alloggio}:`, error);
        }
      }
    });
  });
};
