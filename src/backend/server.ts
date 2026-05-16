import express from 'express';
import cors from 'cors'; // <-- FONDAMENTALE per far parlare Angular col Backend
import { initDb } from './db-config'; 
import { prenotazioniRoutes } from './routes/prenotazioni.routes';

const app = express();

// ==========================================
// 1. MIDDLEWARE (I filtri di ingresso)
// ==========================================
app.use(cors()); 
app.use(express.json()); 

// ==========================================
// 2. REGISTRAZIONE API
// ==========================================
app.use('/api', prenotazioniRoutes);

// Rotta di test
app.get('/', (req, res) => {
  res.status(200).send('API Backend Amicos Holidays perfettamente funzionanti! 🚀');
});

// ==========================================
// 3. AVVIO SERVER E DATABASE
// ==========================================
const port = process.env['PORT'] || 4000;

initDb(); // Popola il database coi link che abbiamo messo prima

app.listen(port, () => {
  console.log(`🎧 API Server in ascolto sulla porta ${port}`);
  console.log(`🌐 Testa il server aprendo: http://localhost:${port}/`);
});