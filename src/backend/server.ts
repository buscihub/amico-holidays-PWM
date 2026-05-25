import express from 'express';
import cors from 'cors'; // <-- FONDAMENTALE per far parlare Angular col Backend
import { initDb } from './db-config'; 
import { prenotazioniRoutes } from './routes/prenotazioni.routes';
import { alloggiRoutes } from './routes/alloggi.routes'; // <-- Rotte dei tuoi amici
import { startSincJob } from './crons/ical.cron'; // <-- Il tuo cron job iCal

const app = express();

// ==========================================
// 1. MIDDLEWARE (I filtri di ingresso)
// ==========================================
app.use(cors()); 
app.use(express.json()); 

// ==========================================
// 2. REGISTRAZIONE API
// ==========================================
// Registriamo sia le tue rotte delle prenotazioni che quelle degli alloggi dei tuoi amici
app.use('/api', prenotazioniRoutes);
app.use('/api/alloggi', alloggiRoutes); // <-- RECUPERATO! Ora le chiamate dei tuoi amici funzioneranno

// Rotta di test globale
app.get('/', (req, res) => {
  res.status(200).send('API Backend Amicos Holidays perfettamente funzionanti! 🚀');
});

// ==========================================
// 3. AVVIO SERVER E DATABASE
// ==========================================
const port = process.env['PORT'] || 4000;

// Inizializza il database SQLite (tabelle e seeding)
initDb(); 

// Avvia il cron job per la sincronizzazione iCal di Airbnb ogni minuto
startSincJob(); 

app.listen(port, () => {
  console.log(`\n🎧 API Server in ascolto sulla porta ${port}`);
  console.log(`🌐 Testa il server aprendo: http://localhost:${port}/api/lista`);
});