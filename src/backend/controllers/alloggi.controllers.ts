import { Request, Response } from 'express';
import { getDb } from '../db-config';
import { RunResult } from 'sqlite3' // Importa getDb da qui


export const getAlloggi = (req: Request, res: Response): any => {

    const db = getDb();
    if (!db) {
        return res.status(500).json({ error: 'Database non inizializzato' });
    }
    // Query per recuperare tutti i dati della tabella ALLOGGIO definita nel progetto
    const sql = 'SELECT * FROM ALLOGGIO';

    try {
        // Esecuzione della query (assumendo l'uso di sqlite3 o simili)
        db.all(sql, [], (err: any, rows: any) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            
            // Restituiamo la lista degli alloggi e i loro stati
            const alloggi = rows.map((row: any) => ({
                id_alloggio: row.ID_Alloggio,
                nome: row.Nome,
                stato_pulizia: Boolean(row.Stato_Pulizia),
                kit_benvenuto: Boolean(row.Kit_Benvenuto),
                airbnb_url_id: row.Airbnb_URL_ID || null,
                ical_url: row.iCal_URL || null,
            }));

            return res.status(200).json({
                success: true,
                count: alloggi.length,
                data: alloggi
            });
        });
    } catch (error) {
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}

export const putClean = (req: Request, res: Response): void => {

    const db = getDb();
    if (!db) {
        res.status(500).json({ error: 'Database non inizializzato' });
        return;
    }

    const idParam = req.params['id'] || req.body.id_alloggio || req.body.id;
    const idAlloggio = Number(idParam);

    if (!idAlloggio || Number.isNaN(idAlloggio)) {
        res.status(400).json({ error: 'ID alloggio mancante o non valido' });
        return;
    }

    const updateSql = `UPDATE ALLOGGIO 
                       SET Stato_Pulizia = CASE Stato_Pulizia WHEN 1 THEN 0 ELSE 1 END 
                       WHERE ID_Alloggio = ?`;

    db.run(updateSql, [idAlloggio], function (this: RunResult, err: Error | null) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (this.changes === 0) {
            res.status(404).json({ error: 'Alloggio non trovato' });
            return;
        }

        const selectSql = 'SELECT * FROM ALLOGGIO WHERE ID_Alloggio = ?';
        db.get(selectSql, [idAlloggio], (selectErr: any, row: any) => {
            if (selectErr) {
                res.status(500).json({ error: selectErr.message });
                return;
            }

            if (!row) {
                res.status(404).json({ error: 'Alloggio non trovato dopo l aggiornamento' });
                return;
            }

            res.status(200).json({
                success: true,
                data: {
                   id_alloggio: row.ID_Alloggio,
                    nome: row.Nome, // Coerente con ENUM: 'massimo', 'cattedrale', 'pretoria'
                    stato_pulizia: Boolean(row.Stato_Pulizia),
                    kit_benvenuto: Boolean(row.Kit_Benvenuto),
                    airbnb_url_id: row.Airbnb_URL_ID,
                    ical_url: row.iCal_URL
                },
            });
        });
    });
};

export const putKit = (req: Request, res: Response): void =>{

    const db = getDb();
    
     if (!db) {
        res.status(500).json({ error: 'Database non inizializzato' });
        return;
    }

    
}

;
   
    
    
    







