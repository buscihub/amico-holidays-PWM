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
interface INuovoSoggiorno {
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
interface IAggiornaSoggiornoBody {
  data_check_in: string;
  data_check_out: string;
}

/**
 * Rappresenta la struttura dati richiesta nel body
 * per l'inserimento di un blocco manuale sulle date.
 */
interface IBloccoDateBody {
  id_alloggio: number;
  data_check_in: string;
  data_check_out: string;
}

/**
 * Specifica i campi mappati per ogni riga restituita dalla query
 * di JOIN per i Soggiorni Attivi nella Dashboard.
 */
interface ISoggiornoAttivo {
  id_soggiorno: number;
  id_alloggio: number;
  data_check_in: string;
  data_check_out: string;
  stato_osservatorio_in: number;
  stato_osservatorio_out: number;
  sorgente: string;
  nome_alloggio: string; // Ottenuto tramite JOIN con la tabella ALLOGGIO
}

/**
 * Specifica i campi mappati per ogni riga restituita dalla query
 * per lo Stato delle Pulizie degli alloggi.
 */
interface IStatoPuliziaAlloggio {
  id_alloggio: number;
  nome_alloggio: string;
  stato_pulizia: number;
}

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
