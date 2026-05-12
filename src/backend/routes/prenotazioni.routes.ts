import { Router } from 'express';
import { aggiungiSoggiorno, modificaSoggiorno, rimuoviSoggiorno } from '../controllers/prenotazioni.controllers';

const router = Router();

// POST /api/prenotazioni/ - Prenotazione sul sito
router.post('/aggiungi-soggiorno', aggiungiSoggiorno);

// PUT /api/prenotazioni/:id - Modifica di un soggiorno
router.put('/:id', modificaSoggiorno);

// DELETE /api/prenotazioni/:id - Cancellazione di un soggiorno
router.delete('/:id', rimuoviSoggiorno);

export const prenotazioniRoutes = router;