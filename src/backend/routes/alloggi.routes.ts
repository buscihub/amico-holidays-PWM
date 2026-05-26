
import { Router } from 'express';
import * as AlloggiController from '../controllers/alloggi.controller';

const router = Router();

// GET /api/alloggi -> Prende tutti gli alloggi (e mappa gli stati in booleani)
router.get('/', AlloggiController.getAlloggi);

// PUT /api/alloggi/clean -> Inverte lo stato della pulizia (accetta l'ID nel body o nell'URL)
router.put('/clean', AlloggiController.putClean);
router.put('/clean/:id', AlloggiController.putClean); // Supporta anche l'ID direttamente nell'URL (es: /api/alloggi/clean/1)

export { router as alloggiRoutes };