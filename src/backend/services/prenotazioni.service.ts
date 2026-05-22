import { checkPrime } from 'node:crypto';
import { dbGet, dbAll, dbRun } from '../utils/db.util';
import { ERROR } from 'sqlite3';
import { last } from 'rxjs';

// =========================================================================
// INTERFACCE DI TIPIZZAZIONE (CONTRATTI DATI)
// =========================================================================

/**
 * Rappresenta la struttura dei dati richiesti nel corpo (body)
 * per la creazione o l'inserimento di un nuovo soggiorno dal sito.
 */

// Interfaccia per i dati in ingresso (che ci passa il controller)
export interface INuovoSoggiorno {
  id_alloggio: number;
  data_check_in: string;
  data_check_out: string;
  sesso: string;
  cittadinanza: string;
  luogo_residenza: string;
}

/**
 * Rappresenta la struttura dei dati richiesti nel body
 * per la modifica delle date di un soggiorno esistente.
 */
export interface IAggiornaSoggiornoBody {
  data_check_in: string;
  data_check_out: string;
}

/**
 * Rappresenta la struttura dati richiesta nel body
 * per l'inserimento di un blocco manuale sulle date.
 */
export interface IBloccoDateBody {
  id_alloggio: number;
  data_check_in: string;
  data_check_out: string;
}

/**
 * Specifica i campi mappati per ogni riga restituita dalla query
 * di JOIN per i Soggiorni Attivi nella Dashboard.
 */
export interface ISoggiornoAttivo {
  id_soggiorno: number;
  id_alloggio: number;
  data_check_in: string;
  data_check_out: string;
  stato_osservatorio_in: number;
  stato_osservatorio_out: number;
  sorgente: string;
  nome_alloggio: string; // Ottenuto tramite JOIN con la tabella ALLOGGIO
}

// =========================================================================
// LOGICA DI BUSINESS E QUERY AL DATABASE
// =========================================================================

// 1. CREA SOGGIORNO
export const creaSoggiorno = async (dati: INuovoSoggiorno, permanenza: number): Promise<number> => {
  // QUERY DI CONTROLLO ANTI-OVERBOOKING: Verifica intersezioni di date per lo stesso alloggio
  const sqlCheck = `SELECT id_soggiorno 
                          FROM SOGGIORNI 
                          WHERE id_alloggio = ? 
                            AND data_check_in < ? 
                            AND data_check_out > ?`;

  const checkParams = [dati.id_alloggio, dati.data_check_in, dati.data_check_out];

  const overlap = await dbGet(sqlCheck, checkParams);

  if (overlap) {
    throw new Error('Overbooking! Date già occupate in questa struttura.');
  }

  await dbRun(`BEGIN TRANSACTION;`);

  try {
    const sqlSoggiorno = `INSERT INTO SOGGIORNI 
                                    (id_alloggio, data_check_in, data_check_out, sorgente, stato_prenotazione, data_creazione_record) 
                                  VALUES (?, ?, ?, 'PrenotazioneSito', 'pending', CURRENT_TIMESTAMP)`;

    const lastID = await dbRun(sqlSoggiorno, checkParams);

    const sqlCliente = `INSERT INTO CLIENTE 
                                    (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) 
                                VALUES (?, ?, ?, ?, ?)`;

    const clienParams = [
      lastID.id,
      dati.sesso,
      dati.cittadinanza,
      dati.luogo_residenza,
      permanenza,
    ];

    await dbRun(sqlCliente, clienParams);

    await dbRun('COMMIT;');

    return lastID.id;
  } catch (error) {
    await dbRun('ROLLBACK');
    throw error;
  }
};

// 2. AGGIORNA SOGGIORNO
export const aggiornaSoggiorno = async (
  id_soggiorno: number,
  dati: IAggiornaSoggiornoBody,
  permanenza: number,
): Promise<number> => {
  // Recupero l'alloggio associato per poter fare il controllo di sovrapposizione date
  const sqlAlloggio = `SELECT id_alloggio
                             FROM SOGGIORNI
                             WHERE id_soggiorno = ?`;

  const row = await dbGet<{ id_alloggio: number }>(sqlAlloggio, [id_soggiorno]);

  // Se l'ID non esiste, lo Chef lancia un errore
  if (!row) {
    throw new Error('Soggiorno non trovato nel database.');
  }

  // Estraiamo il numero puro dall'oggetto restituito
  const id_alloggio = row.id_alloggio;

  const sqlCheckDisponibilita = `SELECT id_soggiorno 
                                       FROM SOGGIORNI 
                                       WHERE id_alloggio = ? 
                                        AND id_soggiorno != ? 
                                        AND data_check_in < ? 
                                        AND data_check_out > ?`;

  const dispParams = [id_alloggio, id_soggiorno, dati.data_check_out, dati.data_check_in];

  const overlap = await dbGet(sqlCheckDisponibilita, dispParams);

  if (overlap) {
    throw new Error('Impossibile modificare: le nuove date sono già occupate.');
  }

  await dbRun(`BEGIN TRANSACTION;`);

  try {
    const sqlSoggAgg = `UPDATE SOGGIORNI 
                                SET data_check_in = ?, 
                                    data_check_out = ? 
                                WHERE id_soggiorno = ?`;
    const soggAggParams = [dati.data_check_in, dati.data_check_out, id_soggiorno];
    await dbRun(sqlSoggAgg, soggAggParams);

    const sqlClienAgg = `UPDATE CLIENTE SET permanenza = ? WHERE id_soggiorno = ?`;
    const ClienAggParams = [permanenza, id_soggiorno];
    await dbRun(sqlClienAgg, ClienAggParams);

    await dbRun('COMMIT;');
    return permanenza;
  } catch (error) {
    await dbRun('ROLLBACK');
    throw error;
  }
};

// 3. ELIMINA SOGGIORNO
export const eliminaSoggiorno = async (idSoggiorno: string | number): Promise<void> => {
  await dbRun('BEGIN TRANSACTION;');
  try {
    await dbRun('DELETE FROM CLIENTE WHERE id_soggiorno = ?', [idSoggiorno]);
    await dbRun('DELETE FROM SOGGIORNI WHERE id_soggiorno = ?', [idSoggiorno]);
    await dbRun('COMMIT;');
  } catch (error) {
    await dbRun('ROLLBACK;');
    throw error;
  }
};

// 4. BLOCCA DATE MANUALE
export const inserisciBloccoDate = async (dati: IBloccoDateBody): Promise<number> => {
  const sqlCheckOccupato = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ?`;
  const overlap = await dbGet(sqlCheckOccupato, [dati.id_alloggio, dati.data_check_out, dati.data_check_in]);

  if (overlap) {
    throw new Error("L'alloggio risulta già occupato o bloccato in questo periodo.");
  }

  const sqlInsertBlocco = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'BloccatoSito')`;
  const result = await dbRun(sqlInsertBlocco, [dati.id_alloggio, dati.data_check_in, dati.data_check_out]);
  
  return result.id;
};

// 5. DASHBOARD STATS
export const calcolaStatistiche = async (oggi: string) => {
  const qOccupate = `SELECT COUNT(DISTINCT id_alloggio) as conto FROM SOGGIORNI WHERE ? BETWEEN data_check_in AND data_check_out`;
  const qArrivi = `SELECT COUNT(*) as conto FROM SOGGIORNI WHERE data_check_in = ? AND sorgente != 'BloccatoSito' AND sorgente != 'BloccatoAirbnb'`;
  const qPartenze = `SELECT COUNT(*) as conto FROM SOGGIORNI WHERE data_check_out = ? AND sorgente != 'BloccatoSito' AND sorgente != 'BloccatoAirbnb'`;

  const [occupate, arrivi, partenze] = await Promise.all([
    dbGet<{ conto: number }>(qOccupate, [oggi]),
    dbGet<{ conto: number }>(qArrivi, [oggi]),
    dbGet<{ conto: number }>(qPartenze, [oggi])
  ]);

  return {
    camereOccupate: occupate?.conto || 0,
    inArrivo: arrivi?.conto || 0,
    inPartenza: partenze?.conto || 0,
    checkOutDaFare: partenze?.conto || 0,
  };
};

// 6. SOGGIORNI ATTIVI
export const recuperaSoggiorniAttivi = async (oggi: string): Promise<ISoggiornoAttivo[]> => {
  const sql = `
    SELECT S.*, A.nome_alloggio 
    FROM SOGGIORNI S
    JOIN ALLOGGIO A ON S.id_alloggio = A.id_alloggio
    WHERE ? BETWEEN S.data_check_in AND S.data_check_out
    ORDER BY S.data_check_out ASC
  `;
  return await dbAll<ISoggiornoAttivo>(sql, [oggi]); 
};

// 7. AZIONA CHECK-IN
export const segnaCheckInDigitale = async (idSoggiorno: string): Promise<void> => {
  await dbRun(`UPDATE SOGGIORNI SET stato_osservatorio_in = 1 WHERE id_soggiorno = ?`, [idSoggiorno]);
};

// 8. RICERCA STORICO
export const cercaStorico = async (idAlloggio?: string): Promise<any[]> => {
  let sql = `SELECT S.*, A.nome_alloggio FROM SOGGIORNI S JOIN ALLOGGIO A ON S.id_alloggio = A.id_alloggio`;
  const params: any[] = [];

  if (idAlloggio) {
    sql += ` WHERE S.id_alloggio = ?`;
    params.push(idAlloggio);
  }

  sql += ` ORDER BY S.data_check_in DESC`;
  return await dbAll(sql, params);
};