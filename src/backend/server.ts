import express from 'express';
import cors from 'cors'; 
import { initDb } from './db-config'; 

// 1. IMPORTIAMO TUTTI I ROUTER DEL PROGETTO
import { prenotazioniRoutes } from './routes/prenotazioni.routes';
import { alloggiRoutes } from './routes/alloggi.routes'; 
import { osservatorioRoutes } from './routes/osservatorio.routes'; 
import { default as autenticazioneRoutes } from './routes/autenticazione.routes'; 
import { startSincJob } from './crons/ical.cron'; 
import { default as contabilitaRoutes } from './routes/contabilita.routes'; // 👈 AGGIUNGI QUESTO!

const app = express();

// ==========================================
// 1. MIDDLEWARE (I filtri di ingresso)
// ==========================================
app.use(cors()); 
app.use(express.json()); 

// ==========================================
// 2. REGISTRAZIONE API (Smistamento Ordinato)
// ==========================================

// Rotte di Autenticazione (Login/Logout)
// URL Finale: POST http://localhost:4000/api/auth/login
app.use('/api/auth', autenticazioneRoutes);

// Rotte delle Prenotazioni e Dashboard
// URL Finali: http://localhost:4000/api/prenotazioni/dashboard/stats, ecc.
app.use('/api/prenotazioni', prenotazioniRoutes);

// Rotte degli Alloggi (Stato pulizia e Kit)
// URL Finale: GET/PUT http://localhost:4000/api/alloggi
app.use('/api/alloggi', alloggiRoutes); 

// Rotte dell'Osservatorio Turistico
// URL Finale: GET http://localhost:4000/api/osservatorio
app.use('/api/osservatorio', osservatorioRoutes); 

// Rotte dell'Osservatorio Turistico
// URL Finale: GET http://localhost:4000/api/osservatorio
app.use('/api/osservatorio', osservatorioRoutes); 

// Rotte della Gestione Contabile & Finanziaria (CSV e Spese Manuali)
// URL Finale: POST http://localhost:4000/api/contabilita/upload-csv
app.use('/api/contabilita', contabilitaRoutes); // 👈 AGGIUNGI QUESTO!

// Rotta di test globale per verificare se il server risponde
app.get('/', (req, res) => {
  res.status(200).send('API Backend Amicos Holidays perfettamente funzionanti! 🚀');
});

// ==========================================
// 3. AVVIO SERVER E DATABASE
// ==========================================
const port = process.env['PORT'] || 4000;

// Inizializza il database SQLite (tabelle e seeding)
initDb(); 

// Avvia il cron job per la sincronizzazione iCal di Airbnb ogni 10 minuti
startSincJob(); 

app.listen(port, () => {
  console.log(`\n🎧 API Server in ascolto sulla porta ${port}`);
  console.log(`🌐 API di test globale: http://localhost:${port}/`);
  console.log(`📊 Rotta di debug prenotazioni: http://localhost:${port}/api/prenotazioni/lista`);
});