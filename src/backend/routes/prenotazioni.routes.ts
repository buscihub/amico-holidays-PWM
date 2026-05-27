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
import { verificaToken } from './autenticazione.middleware';

const router = Router();

// --- Debug & Utility ---
// 3. AGGIORNATA CON ASYNC/AWAIT
router.get('/lista', verificaToken, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll('SELECT * FROM SOGGIORNI');
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Operazioni Core Prenotazioni ---
router.post('/aggiungi-soggiorno', verificaToken, aggiungiSoggiorno);
router.post('/blocca-date', verificaToken, bloccaDate);
router.put('/:id', verificaToken, modificaSoggiorno);
router.delete('/:id', verificaToken, rimuoviSoggiorno);

// --- Rotte Dati Dashboard ---
router.get('/dashboard/stats', verificaToken, getDashboardStats);
router.get('/soggiorni/attivi', verificaToken, getSoggiorniAttivi);
router.get('/sincronizza-ical', verificaToken, sincronizzaManuale); // <-- 4. AGGIUNTA LA ROTTA PER IL SYNC MANUALE

// --- Azioni Gestionali Host ---
router.put('/:id/checkin', verificaToken, azionaCheckIn);
router.get('/storico/ricerca', verificaToken, storicoPrenotazioni);

export const prenotazioniRoutes = router;