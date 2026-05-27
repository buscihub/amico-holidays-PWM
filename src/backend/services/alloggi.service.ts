import { dbAll, dbRun } from '../utils/db.util';

// Interfaccia per tipizzare l'alloggio estratto dal DB
export interface IAlloggio {
  id_alloggio: number;
  nome_alloggio: string;
  stato_pulizia: number; // Memorizzato come 0 o 1 nel DB
  kit_benvenuto: number; // Memorizzato come 0 o 1 nel DB
  link_airbnb: string | null;
  link_ical: string | null;
}

// Recupera la lista di tutti gli alloggi
export const recuperaTuttiAlloggi = async (): Promise<IAlloggio[]> => {
  const sql = 'SELECT * FROM ALLOGGIO';
  return await dbAll<IAlloggio>(sql, []);
};

// Modifica lo stato della pulizia e ritorna l'oggetto modificato (o null se l'ID non esiste)
export const aggiornaStatoPulizia = async (idAlloggio: number): Promise<IAlloggio | null> => {
  // 1. Eseguiamo l'update con la logica toggle (CASE WHEN)
  const updateSql = `
    UPDATE ALLOGGIO 
    SET stato_pulizia = CASE stato_pulizia WHEN 1 THEN 0 ELSE 1 END 
    WHERE id_alloggio = ?
  `;
  const result = await dbRun(updateSql, [idAlloggio]);

  // Se non ci sono state righe modificate, l'alloggio richiesto non esiste
  if (result.changes === 0) {
    return null;
  }

  // 2. Recuperiamo l'alloggio appena aggiornato per restituirlo al controller
  const selectSql = 'SELECT * FROM ALLOGGIO WHERE id_alloggio = ?';
  const rows = await dbAll<IAlloggio>(selectSql, [idAlloggio]);
  
  return rows.length > 0 ? rows[0] : null;
};

export const aggiornaKitBenvenuto = async (idAlloggio: number): Promise<IAlloggio | null> => {

  const updateSql =`

    UPDATE ALLOGGIO
    SET kit_benvenuto = CASE kit_benvenuto  WHEN 1 THEN 0 ELSE 1 END
    WHERE id_alloggio = ?
    `;

  const result = await dbRun(updateSql, [idAlloggio]);

    if (result.changes === 0){
      return null
    }

   
  const selectSql = 'SELECT * FROM ALLOGGIO WHERE id_alloggio = ?';
  const rows = await dbAll<IAlloggio>(selectSql, [idAlloggio]);
  
  return rows.length > 0 ? rows[0] : null;
}