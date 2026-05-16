import cron from 'node-cron';
import { getDb } from '../db-config';
import { Data } from '@angular/router';
import { raw } from 'express';
import ical from 'node-ical';
import { link } from 'fs';
// Qui importeremo le funzioni per scaricare e salvare i dati

const formatDataDB = (data: Date): String => {
  const anno = data.getFullYear();
  const mese = data.getMonth();
  const gg = data.getDay();
  return `${anno}-${mese}-${gg}`;
};

const startSincJob = (): any => {
  cron.schedule('*/30 * * * *', (): any => {
    // Segnalo l'avvio della scincronizzazione in console
    console.log('--- Avvio Sincronizzazione iCal Airbnb ---', new Date().toLocaleString()); // data della sinc
  });

  const db = getDb();

  // RECUPERO I LINK DAL DB
  // query da inserire in db.all(query, variabili[], callback)
  const sqlGetIcal = 'SELECT id_alloggio, link_ical FROM ALLOGGI WHERE link_ical IS NOT NULL';

  db.all(sqlGetIcal, [], async (err: Error | null, rows: any[]) => {
    if (err) {
      console.error('Errore nel recupero dei link iCal:', err.message);
      return;
    }

    for (const row of rows) {
      // destrutturo row per assegnarlo alle variabili di interesse
      const { id_alloggio, link_ical } = row;
      console.log(`\nSincronizzazione Alloggio ID: ${id_alloggio}...`);

      try {
        // SCARICO E PARSO IL FILE .ICS
        /* Questa variabile conterrà i dati del calendario per ogni alloggio */
        const eventi = await ical.async.fromURL(row.link_ical);

        // PULISCO LE VECCHIE PRENOTAZIONI
        // elimino solo quelle che sono state fatte solo tramite airbnb dell'alloggio specifico
        const sqlPulisci = `DELETE FROM SOGGIORNI WHERE id_alloggio = ? AND sorgente = 'PrenotazioneAirbnb'`;

        db.run(sqlPulisci, [id_alloggio], (errPulisci: Error): any => {
          if (errPulisci) {
            console.error(
              `Errore pulizia vecchi dati per alloggio ${id_alloggio}:`,
              errPulisci.message,
            );
            return;
          }
        });

        // AGGIORNAMENTO DEL CALENDARIO
        // query per linserimento dei nuovi valori
        const sqlInsert = `INSERT INSO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ? , ?, 'PrenotazioneAirbnb')`;

        // scorro tutti gli eventi del file iCal
        for (const key in eventi) {
          const evento = eventi[key];

          // filtriamo gli eventi (VEVENT) dai metadati
          if (evento?.type == 'VEVENT') {
            const checkIn = formatDataDB(evento.start as Date);
            const checkOut = formatDataDB(evento.end as Date);

            db.run(sqlInsert, [id_alloggio, checkIn, checkOut], (errInsert: Error) => {
              if (errInsert) {
                console.error(`Errore inserimento data Airbnb (${checkIn}):`, errInsert.message);
              }
            });
          }
        }
        console.log(`Alloggio ${id_alloggio} sincronizzato con successo!`);
      } catch (error) {
        // Questo catch cattura gli errori di download del link (es. se Airbnb è giù)
        // Usiamo il try/catch DENTRO il ciclo così se fallisce Casa Pretoria, il ciclo continua con Massimo!
        console.error(`Errore di rete/download per alloggio ${id_alloggio}:`, error);
      }
    }
  });
};
