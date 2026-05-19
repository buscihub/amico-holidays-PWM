import { Request, Response } from 'express';
import { getDb } from '../db-config';
import { RunResult } from 'sqlite3';
import { error } from 'console';

// Definiamo cosa ci aspettiamo dal database (Ottimo per la documentazione!)
interface IPendente {
  id_cliente: number;
  id_soggiorno: number;
  nome_alloggio: string;
  sesso: string;
  cittadinanza: string;
  luogo_residenza: string;
  data_check_in: string;
  permanenza: number;
}

// GET /api/osservatorio/pendenti
/* Restituisce i dati in formato JSON per popolare la tabella su Angular (così l'host vede a schermo
chi deve ancora inviare).*/

export const getPendenti = (req: Request, res: Response): Response | void => {
  const db = getDb();

  const sqlGetPendInfo = `
        SELECT cl.id_cliente, 
               cl.id_soggiorno,     
               a.nome_alloggio, 
               cl.sesso, 
               cl.cittadinanza, 
               cl.luogo_residenza,
               s.data_check_in, 
               cl.permanenza 
        FROM CLIENTE as cl
        JOIN SOGGIORNI as s ON s.id_soggiorno = cl.id_soggiorno
        JOIN ALLOGGIO as a ON a.id_alloggio = s.id_alloggio
        WHERE s.stato_osservatorio_in = 0
        ORDER BY s.data_check_in ASC
    `;

  // Usiamo IPendente[] invece di any[] per dire che è un array di quegli oggetti
  db.all(sqlGetPendInfo, [], (err: Error | null, dati: IPendente[]): Response | void => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(dati);
  });
};

// 1. Interfaccia per i dati in entrata da Angular
interface IConfermaInBloccoBody {
  ids: number[]; // Un array di ID soggiorno da contrassegnare come inviati
}

/**
 * @API PUT /api/osservatorio/conferma-selezionati
 * @Descrizione Riceve un array di ID soggiorno dal frontend e aggiorna lo stato
 * di osservatorio a 1 solo per i soggiorni selezionati dall'host sulla dashboard.
 */
export const confermaSelezionati = (
  req: Request<{}, {}, IConfermaInBloccoBody>,
  res: Response,
): void => {
  const db = getDb();
  const { ids } = req.body;

  // VALIDAZIONE: Se l'array è vuoto o non è stato passato, blocchiamo l'operazione
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'Nessun ID soggiorno selezionato.' });
    return;
  }

  // Trasformiamo l'array di ID in una stringa di punti interrogativi per la query SQL
  // Es: [12, 15, 19] diventa "?, ?, ?"
  const placeholders = ids.map(() => '?').join(', ');

  // Costruiamo la query dinamica usando l'operatore IN
  // Es: UPDATE SOGGIORNI SET stato_osservatorio_in = 1 WHERE id_soggiorno IN (?, ?, ?)
  const sqlUpdateInBlocco = `
        UPDATE SOGGIORNI 
        SET stato_osservatorio_in = 1 
        WHERE id_soggiorno IN (${placeholders})
    `;

  // Eseguiamo la query passando l'array di ID come parametri per evitare SQL Injection
  db.run(
    sqlUpdateInBlocco,
    ids,
    function (this: import('sqlite3').RunResult, err: Error | null): void {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Rispondiamo ad Angular dicendo quanti ospiti sono stati effettivamente aggiornati
      res.status(200).json({
        message: 'Ospiti inviati all osservatorio con successo!',
        ospiti_elaborati: this.changes,
      });
    },
  );
};
