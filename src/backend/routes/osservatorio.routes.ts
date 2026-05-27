import { Router } from 'express';
import * as OsservatorioController from '../controllers/osservatorio.controller';
import { verificaToken } from './autenticazione.middleware';

const router = Router();

// GET /api/osservatorio -> Prende i dati (usa i query params ?stato=X&mese=Y&anno=Z)
router.get('/', verificaToken, OsservatorioController.getOspitiOsservatorio);

// PUT /api/osservatorio/conferma-selezionati -> Segna quelli selezionati
router.put('/conferma-selezionati', verificaToken, OsservatorioController.confermaSelezionati);

export { router as osservatorioRoutes };