import { Request, Response } from 'express';
import { getDb } from '../db-config'; // Importa getDb da qui


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
};
   
    
    
    







