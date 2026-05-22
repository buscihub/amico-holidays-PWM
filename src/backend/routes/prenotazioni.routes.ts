import { Router } from 'express';
import { 
  aggiungiSoggiorno, 
  modificaSoggiorno, 
  rimuoviSoggiorno, 
  bloccaDate,
  getDashboardStats,
  getSoggiorniAttivi,
  azionaCheckIn,
  storicoPrenotazioni
} from '../controllers/prenotazioni.controller';
import { getDb } from '../db-config';

const router = Router();

// --- Debug & Utility ---
router.get('/lista', (req, res) => {
  getDb().all('SELECT * FROM SOGGIORNI', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(rows);
  });
});

// --- Operazioni Core Prenotazioni ---
router.post('/aggiungi-soggiorno', aggiungiSoggiorno);
router.post('/blocca-date', bloccaDate);
router.put('/:id', modificaSoggiorno);
router.delete('/:id', rimuoviSoggiorno);

// --- Rotte Dati Dashboard ---
router.get('/dashboard/stats', getDashboardStats);
router.get('/soggiorni/attivi', getSoggiorniAttivi);

// --- Azioni Gestionali Host ---
router.put('/:id/checkin', azionaCheckIn);
router.get('/storico/ricerca', storicoPrenotazioni);

export const prenotazioniRoutes = router;