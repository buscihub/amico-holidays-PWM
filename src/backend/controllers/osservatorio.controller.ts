import { Request, Response } from 'express';
import { getDb } from '../db-config';
import * as OsservatorioService from '../services/osservatorio.service'
import { RunResult } from 'sqlite3';
import { error } from 'console';
import e from 'cors';



// GET /api/osservatorio/pendenti
/* Restituisce i dati in formato JSON per popolare la tabella su Angular (così l'host vede a schermo
chi deve ancora inviare).*/

export const pendenti = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Chiamiamo il Service e aspettiamo (await) che il database ci risponda
    const dati = await OsservatorioService.recuperaPendenti();
    
    // 2. Se tutto va bene, serviamo i dati al client
    res.status(200).json(dati);

  } catch (error: any) {
    // 3. Se il DB esplode, intercettiamo l'errore e rispondiamo con status 500
    res.status(500).json({ error: error.message || 'Errore interno durante il recupero dei pendenti.' });
  }
};

/**
 * @API PUT /api/osservatorio/conferma-selezionati
 * @Descrizione Riceve un array di ID soggiorno dal frontend e aggiorna lo stato
 * di osservatorio a 1 solo per i soggiorni selezionati dall'host sulla dashboard.
 */
export interface IConfermaInBloccoBody {
  ids: number[]; // Un array di ID soggiorno
}

export const confermaSelezionati = async (
  req: Request<{}, {}, IConfermaInBloccoBody>,
  res: Response,
): Promise<void> => {
  try {
    const { ids } = req.body;

    // VALIDAZIONE: Se l'array è vuoto o malformato, blocchiamo tutto
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Nessun ID soggiorno selezionato.' });
      return;
    }

    // Chiamiamo lo Chef, aspettiamo (await) e salviamo il numero che ci restituisce
    const ospitiAggiornati = await OsservatorioService.selezionati(ids);

    // Rispondiamo al frontend usando la variabile appena ricevuta
    res.status(200).json({
      message: 'Ospiti inviati all\'osservatorio con successo!',
      ospiti_elaborati: ospitiAggiornati,
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};