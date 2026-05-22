import { Router, Request, Response } from 'express';
import { 
  aggiungiSoggiorno, 
  modificaSoggiorno, 
  rimuoviSoggiorno, 
  bloccaDate,
  getDashboardStats,
  getSoggiorniAttivi,
  azionaCheckIn,
  storicoPrenotazioni,
  sincronizzaManuale // <-- 1. IMPORTATA LA NUOVA FUNZIONE
} from '../controllers/prenotazioni.controller';
import { dbAll } from '../utils/db.util'; // <-- 2. IMPORTATO IL MAGAZZINIERE

const router = Router();

// --- Debug & Utility ---
// 3. AGGIORNATA CON ASYNC/AWAIT
router.get('/lista', async (req: Request, res: Response) => {
  try {
    const rows = await dbAll('SELECT * FROM SOGGIORNI');
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Operazioni Core Prenotazioni ---
router.post('/aggiungi-soggiorno', aggiungiSoggiorno);
router.post('/blocca-date', bloccaDate);
router.put('/:id', modificaSoggiorno);
router.delete('/:id', rimuoviSoggiorno);

// --- Rotte Dati Dashboard ---
router.get('/dashboard/stats', getDashboardStats);
router.get('/soggiorni/attivi', getSoggiorniAttivi);
router.get('/sincronizza-ical', sincronizzaManuale); // <-- 4. AGGIUNTA LA ROTTA PER IL SYNC MANUALE

// --- Azioni Gestionali Host ---
router.put('/:id/checkin', azionaCheckIn);
router.get('/storico/ricerca', storicoPrenotazioni);

export const prenotazioniRoutes = router;