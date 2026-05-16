import { Router } from 'express';
import { 
  aggiungiSoggiorno, 
  modificaSoggiorno, 
  rimuoviSoggiorno, 
  bloccaDate // <-- Aggiunto l'import del blocco date
} from '../controllers/prenotazioni.controllers';

const router = Router();

// ==========================================
// ROTTE UTENTE (SITO PRENOTAZIONI)
// ==========================================

// POST /api/prenotazioni/aggiungi-soggiorno - Nuova prenotazione dal sito
router.post('/aggiungi-soggiorno', aggiungiSoggiorno);


// ==========================================
// ROTTE GESTIONALE HOST (BACKOFFICE)
// ==========================================

// POST /api/prenotazioni/blocca-date - Chiude una struttura per manutenzione/uso privato
router.post('/blocca-date', bloccaDate);

// PUT /api/prenotazioni/:id - Modifica le date di un soggiorno esistente
router.put('/:id', modificaSoggiorno);

// DELETE /api/prenotazioni/:id - Cancella una prenotazione dal database
router.delete('/:id', rimuoviSoggiorno);


export const prenotazioniRoutes = router;