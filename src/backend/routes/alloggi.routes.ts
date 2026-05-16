import { Router } from 'express';
import { getAlloggi} from '../controllers/alloggi.controllers';

const router = Router();

router.get('/alloggi', getAlloggi);

export const alloggiRoutes = router;