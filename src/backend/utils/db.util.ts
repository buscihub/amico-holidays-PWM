import { resolve } from "path";
import { getDb } from "../db-config";
import { rejects } from "assert";

/** const db = getDb() messo in questa posizione questo comando viene eseguito immediatamente non appena importiamo questo
 * file da qualche parte nel progetto. Node.js lo eseguirà prima che server.ts abbia avuto il tempo di chiamare initDb(), cioè
 * prima di inizializzare il database. Per risolvere inseriamo il comando all'interno di ogni singola funzione nel momento in
 * cui serve

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
        const db = getDb(); //inseriamo il comando qui
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

export const dbGet = <T>(sql: string,params: any[] = []): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
        const db = getDb(); //inseriamo il comando qui
        db.get(sql, params, function(err, row){
            if (err) {
                reject(err)                
            } else {
                resolve(row as T)
            }
        })
    })
}

/**
 * 🛠️ IL MAGAZZINIERE: dbAll
 * 
 * COSA FA: Si usa per leggere TANTE righe dal database e ottenere liste complete
 * (es. recuperare lo storico, o la lista degli alloggi da pulire).
 * 
 * @param sql La query SQL (es. "SELECT * FROM CLIENTE")
 * @param params Array dei parametri per i "?"
 * @returns Ritorna un Array contenente tutti gli oggetti trovati. Se non trova nulla, ritorna un array vuoto [].
 */
export const dbAll = <T>(sql: string, params: any[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const db = getDb(); //inseriamo il comando qui
        db.all(sql, params, function(err, rows){
            if (err) {
                reject(err)
            } else {
                resolve(rows as T[])
            }
        })
    })
}