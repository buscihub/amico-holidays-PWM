// src/backend/services/contabilita.service.ts
import fs from 'fs';
import csvParser from 'csv-parser';
import { dbGet, dbRun, dbAll } from '../utils/db.util'; // Magazzinieri asincroni del progetto
import { Transazione, TipoTransazione, SorgenteTransazione } from '../../models/types'; // I tuoi tipi ed enum

/**
 * UTILITY INTERNA: MAPPATURA ALLOGGI
 * Analizza la stringa dell'annuncio proveniente da Airbnb e la associa all'id_alloggio corretto sul DB.
 * Essendo interna e non esportata, garantisce l'incapsulamento della logica.
 */
const mappaAlloggio = (nomeAirbnb: string): number | null => {
  if (!nomeAirbnb) return null;
  const nome = nomeAirbnb.toLowerCase();
  
  if (nome.includes('pretoria') || nome.includes('casa vacanze')) return 1; // ID 1 = Casa Pretoria
  if (nome.includes('massimo') || nome.includes('massimo\'s')) return 2;   // ID 2 = Stanza Massimo
  if (nome.includes('cathedral') || nome.includes('cattedrale')) return 3; // ID 3 = Stanza Cattedrale
  
  return null; // Restituisce null se si tratta di una spesa/entrata generale del B&B
};

/**
 * 1. INGESTIONE E PARSING DEL FILE CSV AIRBNB
 * Sfrutta gli Stream di Node.js per leggere i file in modo non bloccante e ottimizzare la RAM.
 */
export const elaboraCSV = async (filePath: string): Promise<{ inserite: number; saltate: number }> => {
  return new Promise((resolve, reject) => {
    const risultatiRaw: any[] = [];
    let inserite = 0;
    let saltate = 0;

    // Apertura dello stream di lettura sul file temporaneo salvato sul server
    fs.createReadStream(filePath)
      .pipe(csvParser()) // Il file passa nella pipeline del parser che lo converte in oggetti JS
      .on('data', (riga) => {
        // Validazione minima: se mancano colonne essenziali salta la riga
        if (!riga.Importo || !riga.Data || !riga.Tipo) return;
        
        // Saltiamo i Payout (i bonifici aggregati) per evitare di raddoppiare i conteggi dei ricavi
        if (riga.Tipo === 'Payout') return;

        risultatiRaw.push(riga);
      })
      .on('end', async () => {
        try {
          // Apriamo una transazione manuale su SQLite per blindare la consistenza del DB
          await dbRun("BEGIN TRANSACTION");

          for (const riga of risultatiRaw) {
            // Sostituiamo la virgola con il punto per convertire la stringa dell'importo in numero decimale
            const importoPulito = parseFloat(riga.Importo.replace(',', '.'));
            
            // Assegniamo l'enum corretto: se positivo è un'Entrata, altrimenti un'Uscita
            const tipo = importoPulito >= 0 ? TipoTransazione.ENTRATA : TipoTransazione.USCITA;
            
            // Categorizzazione automatica basata sui tipi nativi del CSV di Airbnb
            let categoria = 'Altro';
            if (riga.Tipo === 'Prenotazione') categoria = 'Prenotazione';
            if (riga.Tipo === 'Ritenuta fiscale per il reddito italiano') categoria = 'Tasse';
            if (riga.Tipo === 'Costi del servizio') categoria = 'Commissioni Airbnb';

            // Conversione data da formato USA (MM/DD/YYYY) a formato ISO (YYYY-MM-DD) per SQLite
            const dataFormattata = new Date(riga.Data).toISOString().split('T')[0];
            const codiceConferma = riga['Codice di Conferma'] || null;

            // SCUDO ANTI-DUPLICATI: Interroghiamo dbGet per vedere se questa riga è già stata salvata
            if (codiceConferma) {
              const giaEsistente = await dbGet(
                `SELECT id_transazione FROM TRANSAZIONI 
                 WHERE codice_conferma_airbnb = ? AND categoria = ? AND sorgente = ?`,
                [codiceConferma, categoria, SorgenteTransazione.AIRBNB_CSV]
              );

              if (giaEsistente) {
                saltate++;
                continue; // Trovata corrispondenza: salta l'inserimento e passa alla riga successiva
              }
            }

            const idAlloggio = mappaAlloggio(riga.Annuncio);
            const importoAssoluto = Math.abs(importoPulito); // Salviamo il valore economico sempre positivo
            const descrizione = `${riga.Tipo} - ${riga.Ospite || 'N/D'}`;

            // Esecuzione dell'inserimento effettivo tramite dbRun
            await dbRun(
              `INSERT INTO TRANSAZIONI (id_alloggio, data_transazione, tipo, categoria, importo, descrizione, sorgente, codice_conferma_airbnb)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [idAlloggio, dataFormattata, tipo, categoria, importoAssoluto, descrizione, SorgenteTransazione.AIRBNB_CSV, codiceConferma]
            );

            inserite++;
          }

          // Confermiamo tutte le modifiche apportate sul DB
          await dbRun("COMMIT");

          // Rimuoviamo il file temporaneo dalla cartella 'uploads' per liberare spazio sul server
          try { fs.unlinkSync(filePath); } catch (e) {}

          resolve({ inserite, saltate });

        } catch (error) {
          // In caso di errore critico annulliamo tutto (Rollback) per non lasciare il database corrotto
          try { await dbRun("ROLLBACK"); } catch (e) {}
          try { fs.unlinkSync(filePath); } catch (e) {}
          reject(error);
        }
      })
      .on('error', (err) => {
        try { fs.unlinkSync(filePath); } catch (e) {}
        reject(err);
      });
  });
};

/**
 * 2. INSERIMENTO MANUALE MOVIMENTI (Spese Extra di Gestione)
 * Consente all'Host di registrare costi offline (es. Colazioni, Pulizie extra, Manutenzioni).
 */
export const inserisciTransazioneManuale = async (
  transazione: Omit<Transazione, 'id_transazione' | 'sorgente' | 'codice_conferma_airbnb'>
): Promise<{ id_inserito: number }> => {
  const query = `
    INSERT INTO TRANSAZIONI (id_alloggio, data_transazione, tipo, categoria, importo, descrizione, sorgente)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const risultato = await dbRun(query, [
    transazione.id_alloggio, // ID numerico (1, 2, 3) o NULL se è un costo generale del B&B
    transazione.data_transazione,
    transazione.tipo,        // TipoTransazione.ENTRATA o TipoTransazione.USCITA
    transazione.categoria,   // Stringa inserita dall'utente (es. 'Colazione')
    transazione.importo,
    transazione.descrizione,
    SorgenteTransazione.MANUALE // Forza la sorgente a 'Manuale' nel database
  ]);

  return { id_inserito: risultato.id };
};

/**
 * 3. MATRICE PIVOT INCROCIATA (Alloggio vs Categoria)
 * Genera un report bidimensionale aggregato. Ottimo per visualizzare su Angular quanto incide
 * una specifica categoria (es. Tasse o Pulizie) su ogni singola stanza e sulle spese generali.
 */
export const recuperaMatriceCostiIncrociati = async (): Promise<any[]> => {
  const query = `
    SELECT 
      T.categoria,
      SUM(CASE WHEN T.id_alloggio = 1 THEN T.importo ELSE 0 END) as costo_pretoria,
      SUM(CASE WHEN T.id_alloggio = 2 THEN T.importo ELSE 0 END) as costo_massimo,
      SUM(CASE WHEN T.id_alloggio = 3 THEN T.importo ELSE 0 END) as costo_cattedrale,
      SUM(CASE WHEN T.id_alloggio IS NULL THEN T.importo ELSE 0 END) as costo_generale,
      SUM(T.importo) as totale_complessivo_categoria
    FROM TRANSAZIONI T
    WHERE T.tipo = 'Uscita'
    GROUP BY T.categoria
    ORDER BY totale_complessivo_categoria DESC
  `;
  return await dbAll<any>(query);
};

/**
 * 4. PERFORMANCE GLOBALE ALLOGGI (P&L Dashboard)
 * Calcola Ricavi totali, Costi totali, Guadagno Netto reale e Margine di Profitto percentuale
 * per ognuna delle tre strutture, mettendo a confronto l'impatto economico reale di gestione.
 */
export const recuperaPerformanceAlloggi = async (): Promise<any[]> => {
  const query = `
    SELECT 
      T.id_alloggio,
      IFNULL(A.nome_alloggio, 'Spese Generali') as nome_alloggio,
      SUM(CASE WHEN T.tipo = 'Entrata' THEN T.importo ELSE 0 END) as ricavi_totali,
      SUM(CASE WHEN T.tipo = 'Uscita' THEN T.importo ELSE 0 END) as costi_totali,
      (SUM(CASE WHEN T.tipo = 'Entrata' THEN T.importo ELSE 0 END) - 
       SUM(CASE WHEN T.tipo = 'Uscita' THEN T.importo ELSE 0 END)) as utile_netto,
      CASE 
        WHEN SUM(CASE WHEN T.tipo = 'Entrata' THEN T.importo ELSE 0 END) > 0 
        THEN ROUND(((SUM(CASE WHEN T.tipo = 'Entrata' THEN T.importo ELSE 0 END) - SUM(CASE WHEN T.tipo = 'Uscita' THEN T.importo ELSE 0 END)) / SUM(CASE WHEN T.tipo = 'Entrata' THEN T.importo ELSE 0 END)) * 100, 2)
        ELSE 0 
      END as margine_profitto_percentuale
    FROM TRANSAZIONI T
    LEFT JOIN ALLOGGIO A ON T.id_alloggio = A.id_alloggio
    GROUP BY T.id_alloggio
  `;
  return await dbAll<any>(query);
};

/**
 * 5. IMPATTO PERCENTUALE DELLE CATEGORIE (Pie Chart Data)
 * Sfrutta le Common Table Expressions (CTE) per estrarre la percentuale di incidenza
 * di ogni categoria di costo sul totale complessivo delle uscite dell'attività.
 */
export const recuperaImpattoCategorieCosti = async (): Promise<any[]> => {
  const query = `
    WITH TotaleUscite AS (
      SELECT SUM(importo) as totale_globale FROM TRANSAZIONI WHERE tipo = 'Uscita'
    )
    SELECT 
      T.categoria,
      SUM(T.importo) as totale_categoria,
      ROUND((SUM(T.importo) / (SELECT totale_globale FROM TotaleUscite)) * 100, 2) as percentuale_incidenza
    FROM TRANSAZIONI T
    WHERE T.tipo = 'Uscita'
    GROUP BY T.categoria
    ORDER BY totale_categoria DESC
  `;
  return await dbAll<any>(query);
};

/**
 * 6. FILTRI INCROCIATI DINAMICI MULTI-CATEGORIA (Query di Ricerca Avanzata)
 * Permette ad Angular di richiedere record specifici incrociando una stanza e MULTIPLE categorie.
 * Es: Estrai le transazioni di Massimo Room (ID 2) che appartengono a 'Tasse', 'Colazione' o 'Pulizie'.
 */
export const filtraTransazioniIncrociate = async (
  idAlloggio?: number | null, 
  categories?: string[] // Modificato: ora accetta un array di stringhe!
): Promise<any[]> => {
  let query = `
    SELECT T.*, IFNULL(A.nome_alloggio, 'Spesa Generale') as nome_alloggio 
    FROM TRANSAZIONI T
    LEFT JOIN ALLOGGIO A ON T.id_alloggio = A.id_alloggio
    WHERE 1=1
  `;
  const params: any[] = [];

  // Filtro per Alloggio specifico
  if (idAlloggio !== undefined) {
    query += ` AND T.id_alloggio = ?`;
    params.push(idAlloggio);
  }

  // MODIFICA AVANZATA: Filtro per gruppo di categorie (Costruisce dinamicamente il costrutto SQL IN)
  if (categories && categories.length > 0) {
    // Genera tanti punti interrogativi quanti sono gli elementi dell'array (es. "?, ?, ?")
    const placeholders = categories.map(() => '?').join(', ');
    query += ` AND T.categoria IN (${placeholders})`;
    
    // Iniettiamo i valori reali dell'array dentro i parametri della query
    categories.forEach(cat => params.push(cat));
  }

  query += ` ORDER BY T.data_transazione DESC`;
  return await dbAll<any>(query, params);
};

/**
 * 7. STORICO MOVIMENTI COMPLETO
 * Estrae l'elenco cronologico di tutte le transazioni (Entrate e Uscite) presenti a database.
 */
export const recuperaTuttiIMovimenti = async (): Promise<any[]> => {
  const query = `
    SELECT T.*, IFNULL(A.nome_alloggio, 'Spesa Generale') as nome_alloggio 
    FROM TRANSAZIONI T
    LEFT JOIN ALLOGGIO A ON T.id_alloggio = A.id_alloggio
    ORDER BY T.data_transazione DESC
  `;
  return await dbAll<any>(query);
};