import { Router } from 'express';
import { registraCliente } from '../controllers/prenotazioni.controllers';

const router = Router();

// POST /apo/prenotazioni/:id - Aggiunta di un soggiorno
router.post('/registra-cliente', registraCliente);

// PUT /api/prenotazioni/:id - Modifica di un soggiorno
router.put('/:id', /* authMiddleware, */ updatePrenotazione);

// DELETE /api/prenotazioni/:id - Cancellazione di un soggiorno
router.delete('/:id', /* authMiddleware, */ deletePrenotazione);

export const prenotazioniRoutes = router;