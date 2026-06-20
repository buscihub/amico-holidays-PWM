// src/backend/routes/contabilita.routes.ts
import { Router } from 'express';
import multer from 'multer';
import * as ContabilitaController from '../controllers/contabilità.controller';
import { verificaToken } from '../routes/autenticazione.middleware'; // 👈 Importiamo il buttafuori!

const router = Router();
const upload = multer({ dest: 'uploads/' });

/**
 * 🛫 ROTTE DELLA CONTABILITÀ PROTETTE DA JWT
 * Inserendo 'verificaToken' come secondo parametro, Express farà prima controllare il token.
 * Se il token non è valido, si ferma lì e risponde 401/403 senza far toccare il DB.
 */

// 1. Upload CSV Airbnb (Prima controlla il token, poi multer gestisce il file, poi il controller elabora)
router.post('/upload-csv', verificaToken, upload.single('file'), ContabilitaController.postUploadReportAirbnb);

// 2. Inserimento manuale spese
router.post('/transazione-manuale', verificaToken, ContabilitaController.postTransazioneManuale);

// 3. Dati grafici dashboard
router.get('/dashboard', verificaToken, ContabilitaController.getDatiDashboard);

// 4. Filtri avanzati incrociati
router.get('/filtra', verificaToken, ContabilitaController.getTransazioniFiltrate);

// 5. Storico completo movimenti
router.get('/movimenti', verificaToken, ContabilitaController.getTuttiIMovimenti);

// ... altre rotte esistenti ...

// 🔄 ROTTA TEMPORANEA PER RESETTARE I TEST
// Svuota la tabella transazioni direttamente tramite Express evitando i blocchi del file .db
router.delete('/reset-test', verificaToken, async (req, res) => {
  try {
    const { dbRun } = require('../utils/db.util');
    await dbRun("DELETE FROM TRANSAZIONI;");
    res.status(200).json({ success: true, message: "Tabella TRANSAZIONI svuotata con successo!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;