import { Router } from 'express';
import { loginHost, logoutHost } from '../controllers/autenticazione.controllers';

const router = Router();

// Creiamo la rotta POST per il login, che richiama la funzione loginHost del controller
router.post('/login', loginHost);

// Creiamo la rotta POST per il logout, che richiama la funzione logoutHost del controller
router.post('/logout', logoutHost);

export default router;