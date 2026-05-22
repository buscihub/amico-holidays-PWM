import { dbAll, dbRun } from '../utils/db.util';

// Interfaccia aggiornata con la nuova colonna del DB
export interface IOspiteOsservatorio {
  id_cliente: number;
  id_soggiorno: number;
  nome_alloggio: string;
  sesso: string;
  cittadinanza: string;
  luogo_residenza: string;
  data_check_in: string;
  permanenza: number;
}

export const recuperaOspitiFiltrati = async (
  stato: number, 
  mese?: string, 
  anno?: string
): Promise<IOspiteOsservatorio[]> => {
  
  // Query base: filtriamo subito per lo stato (0 = Da Segnare, 1 = Già Segnato)
  let sql = `
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
        WHERE s.segnato_osservatorio = ?
  `;
  
  const params: any[] = [stato];

  // Se l'host vuole vedere i record di un mese specifico (es. per lo storico)
  if (mese && anno) {
    sql += ` AND strftime('%m', s.data_check_in) = ? AND strftime('%Y', s.data_check_in) = ?`;
    params.push(mese, anno);
  }

  sql += ` ORDER BY s.data_check_in ASC`;

  return await dbAll<IOspiteOsservatorio>(sql, params);
};

// Manteniamo la tua funzione di conferma in blocco (aggiornata con la nuova colonna)
export const selezionati = async (ids: number[]): Promise<number> => {
    const placeholders = ids.map(() => '?').join(', ');
    const sqlUpdateInBlocco = `
        UPDATE SOGGIORNI 
        SET segnato_osservatorio = 1 
        WHERE id_soggiorno IN (${placeholders})
    `;
    const result = await dbRun(sqlUpdateInBlocco, ids);
    return result.changes; 
};