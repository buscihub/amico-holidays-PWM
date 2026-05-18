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
