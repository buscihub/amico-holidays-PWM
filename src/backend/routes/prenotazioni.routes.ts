import { Router } from 'express';
import { registraCliente } from '../controllers/prenotazioni.controllers';

const router = Router();

// Creiamo la rotta POST che richiama la funzione del controller
router.post('/registra-cliente', registraCliente);

export const prenotazioniRoutes = router;