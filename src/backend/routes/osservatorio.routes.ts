import { Router } from 'express';
import * as OsservatorioController from '../controllers/osservatorio.controller';

const router = Router();

// GET /api/osservatorio -> Prende i dati (usa i query params ?stato=X&mese=Y&anno=Z)
router.get('/', OsservatorioController.getOspitiOsservatorio);

// PUT /api/osservatorio/conferma-selezionati -> Segna quelli selezionati
router.put('/conferma-selezionati', OsservatorioController.confermaSelezionati);

export { router as osservatorioRoutes };