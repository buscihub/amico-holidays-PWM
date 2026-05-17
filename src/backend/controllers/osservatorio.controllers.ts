import { Request, Response } from 'express';
import { getDb } from '../db-config';
import { RunResult } from 'sqlite3';

// GET /api/osservatorio/pendenti
/* Restituisce i dati in formato JSON per popolare la tabella su Angular (così l'host vede a schermo
chi deve ancora inviare).*/

export const getPendenti = (req : Request, res: Response): Response | void => {
    const db = getDb()

    const sqlGetPendInfo = `SELECT `

}
