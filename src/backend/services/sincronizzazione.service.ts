import ical from 'node-ical';
import { Database } from 'sqlite3';
import { getDb } from '../db-config';

// Helper per la data
const formatDataDB = (data: Date): string => {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const gg = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${gg}`;
};

export const eseguiSincronizzazioneCore = async (): Promise<void> => {
  const db = getDb()
  return new Promise((resolve, reject) => {
    // 1. PULIZIA PENDING SCADUTI
    const sqlGarbageCollection = `
      DELETE FROM SOGGIORNI 
      WHERE stato_prenotazione = 'pending' 
        AND data_creazione_record < DATETIME('now', '-30 minutes')
    `;
    
    db.run(sqlGarbageCollection, [], (errClean) => {
      if (errClean) return reject(new Error('Errore pulizia pending scaduti: ' + errClean.message));

      // 2. RECUPERO LINK
      const sqlGetIcal = 'SELECT id_alloggio, link_ical FROM ALLOGGIO WHERE link_ical IS NOT NULL';
      
      db.all(sqlGetIcal, [], async (err, rows: any[]) => {
        if (err) return reject(new Error('Errore nel recupero link iCal: ' + err.message));
        if (!rows || rows.length === 0) return resolve(); // Nessun link, finiamo con successo

        try {
          for (const row of rows) {
            const { id_alloggio, link_ical } = row;
            const eventi = await ical.async.fromURL(link_ical);

            // Pulizia parziale vecchi record confermati da iCal
            const sqlPulisci = `DELETE FROM SOGGIORNI WHERE id_alloggio = ? AND sorgente = 'PrenotazioneAirbnb' AND stato_prenotazione = 'confirmed'`;
            
            await new Promise<void>((res, rej) => {
              db.run(sqlPulisci, [id_alloggio], (errPulisci) => {
                if (errPulisci) rej(errPulisci);
                else res();
              });
            });

            // 3. FLUSSO DI MATCHING
            for (const key in eventi) {
              const evento = eventi[key];
              if (evento?.type === 'VEVENT' && evento.start && evento.end) {
                const checkIn = formatDataDB(evento.start as Date);
                const checkOut = formatDataDB(evento.end as Date);
                const sommarioMinuscolo = ((evento.summary as string) || '').toLowerCase();

                let sorgenteReale = 'PrenotazioneAirbnb';
                if (sommarioMinuscolo.includes('not available') || sommarioMinuscolo.includes('airbnb_not_available')) {
                  sorgenteReale = 'BloccatoAirbnb';
                }

                const sqlTrovaPending = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in = ? AND data_check_out = ? AND stato_prenotazione = 'pending'`;

                db.get(sqlTrovaPending, [id_alloggio, checkIn, checkOut], (errMatch, rowPending: any) => {
                  if (rowPending) {
                    const sqlConfermaSoggiorno = `UPDATE SOGGIORNI SET stato_prenotazione = 'confirmed', sorgente = 'PrenotazioneAirbnb' WHERE id_soggiorno = ?`;
                    db.run(sqlConfermaSoggiorno, [rowPending.id_soggiorno]);
                  } else {
                    const sqlCheckOverbooking = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ? AND stato_prenotazione = 'confirmed'`;
                    db.get(sqlCheckOverbooking, [id_alloggio, checkOut, checkIn], (errOver, rowOver) => {
                      if (!rowOver && !errOver) {
                        const sqlInsert = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente, stato_prenotazione, data_creazione_record) VALUES (?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP)`;
                        db.run(sqlInsert, [id_alloggio, checkIn, checkOut, sorgenteReale]);
                      }
                    });
                  }
                });
              }
            }
          }
          resolve(); // Tutto completato con successo!
        } catch (error: any) {
          reject(new Error('Errore di rete o parsing Airbnb: ' + error.message));
        }
      });
    });
  });
};