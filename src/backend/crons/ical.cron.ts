import cron from 'node-cron';
import { eseguiSincronizzazioneCore } from '../services/sincronizzazione.service';

export const startSincJob = (): void => {
  cron.schedule('*/10 * * * *', async () => { // Ogni 10 minuti
    console.log('\n--- 🔄 Avvio Sincronizzazione Automatica iCal ---');
    try {
      await eseguiSincronizzazioneCore();
      console.log('✅ Sincronizzazione automatica completata senza errori.');
    } catch (error: any) {
      console.error('❌ Errore Cron Job:', error.message);
    }
  });
};