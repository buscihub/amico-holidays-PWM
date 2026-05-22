import { dbGet, dbAll, dbRun } from '../utils/db.util';

// Definiamo cosa ci aspettiamo dal database (Ottimo per la documentazione!)
export interface IPendente {
  id_cliente: number;
  id_soggiorno: number;
  nome_alloggio: string;
  sesso: string;
  cittadinanza: string;
  luogo_residenza: string;
  data_check_in: string;
  permanenza: number;
}

export const recuperaPendenti = async (): Promise<IPendente[]> => {
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
        WHERE s.segnato_osservatorio = 0
        ORDER BY s.data_check_in ASC
    `;

  // Usiamo il nostro helper dbAll che supporta i tipi generici <IPendente>
  return await dbAll<IPendente>(sqlGetPendInfo);
};

export const selezionati = async (ids: number[]): Promise<number> => {
  // Trasformiamo l'array di ID in una stringa di punti interrogativi (Es: [12, 15] -> "?, ?")
  const placeholders = ids.map(() => '?').join(', ');

  const sqlUpdateInBlocco = `
        UPDATE SOGGIORNI 
        SET segnato_osservario = 1 
        WHERE id_soggiorno IN (${placeholders})
    `;

  // Usiamo await e salviamo l'oggetto restituito dal nostro magazziniere!
  const result = await dbRun(sqlUpdateInBlocco, ids);

  // result.changes contiene esattamente il numero di righe modificate
  return result.changes;
};
