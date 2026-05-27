import ical from 'node-ical';
import { dbGet, dbAll, dbRun } from '../utils/db.util';

// Helper per la data
const formatDataDB = (data: Date): string => {
  const anno = data.getFullYear();
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const gg = String(data.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${gg}`;
};

export const eseguiSincronizzazioneCore = async (): Promise<void> => {
  try {
    // 1. PULIZIA PENDING SCADUTI (Usa dbRun con await)
    const sqlGarbageCollection = `
      DELETE FROM SOGGIORNI 
      WHERE stato_prenotazione = 'pending' 
        AND data_creazione_record < DATETIME('now', '-30 minutes')
    `;
    await dbRun(sqlGarbageCollection);

    // 2. RECUPERO LINK (Usa dbAll con await)
    const sqlGetIcal = 'SELECT id_alloggio, link_ical FROM ALLOGGIO WHERE link_ical IS NOT NULL';
    const rows: any[] = await dbAll(sqlGetIcal);
    
    if (!rows || rows.length === 0) return; // Nessun link, finiamo con successo

    // Usiamo un normale ciclo for...of per poter usare await all'interno!
    for (const row of rows) {
      const { id_alloggio, link_ical } = row;
      
      // Scarichiamo il calendario da internet
      const eventi = await ical.async.fromURL(link_ical);

      // Pulizia parziale vecchi record confermati da iCal
      const sqlPulisci = `DELETE FROM SOGGIORNI WHERE id_alloggio = ? AND sorgente = 'PrenotazioneAirbnb' AND stato_prenotazione = 'confirmed'`;
      await dbRun(sqlPulisci, [id_alloggio]);

      // 3. FLUSSO DI MATCHING
      for (const key in eventi) {
        const evento = eventi[key];
        
        if (evento?.type === 'VEVENT' && evento.start && evento.end) {
          const checkIn = formatDataDB(evento.start as Date);
          const checkOut = formatDataDB(evento.end as Date);
          const sommarioMinuscolo = ((evento.summary as string) || '').toLowerCase();

          let sorgenteReale = 'PrenotazioneAirbnb';
          if (sommarioMinuscolo.includes('not available') || sommarioMinuscolo.includes('airbnb_not_available')) {
            sorgenteReale = 'BloccatoAirbnb';
          }

          // --- LOGICA DI MATCHING CON AWAIT (ORDINATA E SICURA) ---
          
          // Cerchiamo se c'è una pre-prenotazione del sito (pending) per queste date
          const sqlTrovaPending = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in = ? AND data_check_out = ? AND stato_prenotazione = 'pending'`;
          const rowPending = await dbGet<{ id_soggiorno: number }>(sqlTrovaPending, [id_alloggio, checkIn, checkOut]);

          if (rowPending) {
            // Se esiste, la confermiamo aggiornandola
            const sqlConfermaSoggiorno = `UPDATE SOGGIORNI SET stato_prenotazione = 'confirmed', sorgente = 'PrenotazioneAirbnb' WHERE id_soggiorno = ?`;
            await dbRun(sqlConfermaSoggiorno, [rowPending.id_soggiorno]);
          } else {
            // Se non c'è una pending, controlliamo l'anti-overbooking (con l'ordine corretto dei parametri checkOut e checkIn!)
            const sqlCheckOverbooking = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ? AND stato_prenotazione = 'confirmed'`;
            const rowOver = await dbGet(sqlCheckOverbooking, [id_alloggio, checkOut, checkIn]);

            if (!rowOver) {
              // Se la camera è libera, inseriamo ufficialmente la prenotazione di Airbnb
              const sqlInsert = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente, stato_prenotazione, data_creazione_record) VALUES (?, ?, ?, ?, 'confirmed', CURRENT_TIMESTAMP)`;
              await dbRun(sqlInsert, [id_alloggio, checkIn, checkOut, sorgenteReale]);
            }
          }
        }
      }
    }
  } catch (error: any) {
    throw new Error('Errore sincronizzazione o parsing Airbnb: ' + error.message);
  }
};