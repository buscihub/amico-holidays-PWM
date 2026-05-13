import cron from 'node-cron';
import { getDb } from '../db-config';
// Qui importeremo le funzioni per scaricare e salvare i dati

export const startSincronizzazioneJob = () => {
  // Configurazione Cron: "*/30 * * * *" significa "ogni 30 minuti"
  cron.schedule('*/30 * * * *', async () => {
    console.log('--- Avvio Sincronizzazione iCal Airbnb ---', new Date().toLocaleString());

    try {
        const db = getDb()

        const sqlGetIcal = "SELECT id_alloggio, link_ical FROM ALLOGGI WHERE link_ical is NOT NULL"

        db.get()

      // 2. Per ogni link, scarico il file .ics
      // 3. Elaboro le date e le inserisco nel DB

      console.log('--- Sincronizzazione completata con successo ---');
    } catch (error) {
      console.error('--- Errore durante il Job di Sincronizzazione ---', error);
    }
  });
};
