import { Router } from 'express';
import { getAlloggi} from '../controllers/alloggi.controllers';
import { putClean} from '../controllers/alloggi.controllers'

const router = Router();

router.get('/alloggi', getAlloggi);

// Rotta per aggiornare lo stato pulizia (accetta l'ID sia nell'URL che nel body)
router.put('/alloggi', putClean);      // Per chiamate con ID nel JSON body
router.put('/alloggi/:id', putClean); // Per chiamate con ID nell'URL (es: /alloggi/1)

export const alloggiRoutes = router;