import { resolve } from "path";
import { getDb } from "../db-config";

const db = getDb()

/**
 * 🛠️ IL MAGAZZINIERE: dbRun
 * 
 * COSA FA: Si usa per le operazioni che MODIFICANO il database (INSERT, UPDATE, DELETE).
 * NON restituisce i dati della tabella, ma ti dice come è andata l'operazione.
 * 
 * @param sql La query SQL da eseguire (es. "UPDATE ALLOGGIO SET stato = ? WHERE id = ?")
 * @param params Array dei valori da sostituire ai "?" (es. [1, 14])
 * @returns Ritorna una Promise con un oggetto contenente:
 *          - id: L'ID dell'ultima riga inserita (utile dopo le INSERT)
 *          - changes: Il numero di righe modificate o eliminate (utile per UPDATE/DELETE)
 */
export const dbRun = (
    sql: string,
    params: any[] = []
): Promise<{id: number; changes: number}> => {
    return new Promise((resolve, reject)=> {
        // Usiamo function() normale invece della freccia per poter accedere a 'this.lastID'
        db.run(sql, params, function(err){
            if (err) {
                reject(err)
            } else {
                resolve({
                    id: this.lastID,
                    changes: this.changes
                })
            }
        })    
    })
}

/**
 * 🛠️ IL MAGAZZINIERE: dbGet
 * 
 * COSA FA: Si usa per leggere UNA SOLA riga dal database (es. recuperare un singolo alloggio
 * o controllare se esiste già una prenotazione). Ferma la ricerca appena trova il primo match.
 * 
 * @param sql La query SQL (es. "SELECT * FROM SOGGIORNI WHERE id_soggiorno = ?")
 * @param params Array dei parametri per i "?"
 * @returns Ritorna l'oggetto trovato, oppure 'undefined' se non c'è nessun risultato.
 */

export const dbGet = (sql: string,params: any[] = []): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, function(err, row){
            if (err) {
                reject(err)                
            } else {
                resolve(row as T)
            }
        })
    })
}
