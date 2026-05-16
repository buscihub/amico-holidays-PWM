import { Request, Response } from 'express';
import { getDb } from '../db-config'; 
import { RunResult } from 'sqlite3';

// ==========================================
// GESTIONE MANUALE HOST (Strutture Indipendenti)
// ==========================================

/**
 * POST /api/prenotazioni/aggiungi-soggiorno
 * Descrizione: Registra un nuovo soggiorno e i relativi dati anagrafici del cliente sul sito.
 * * SCELTE TECNICHE PER L'ESAME:
 * 1. Controllo Overbooking: Usa la logica (check_in_DB < check_out_Richiesto AND check_out_DB > check_in_Richiesto)
 * per intercettare tutti i 4 casi possibili di sovrapposizione date.
 * 2. Transazioni SQL (Atomicità): Garantisce che le tabelle SOGGIORNI e CLIENTE vengano
 * aggiornate insieme. Se una fallisce, scatta il ROLLBACK per non lasciare "dati orfani".
 */
export const aggiungiSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();
  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } = req.body;

  // 1. Validazione base dei dati in ingresso
  if (!id_alloggio || !data_check_in || !data_check_out) {
    return res.status(400).json({ error: 'Dati mancanti. Impossibile procedere.' });
  }

  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);

  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
    return res.status(400).json({ error: 'Formato data non valido.' });
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0); 
  if (inizio < oggi) {
    return res.status(400).json({ error: 'Non puoi effettuare un check-in nel passato!' });
  }

  // Calcolo della permanenza in notti
  const diffInMs = fine.getTime() - inizio.getTime();
  const permanenza = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  if (permanenza <= 0) return res.status(400).json({ error: 'La data di check-out deve essere successiva al check-in.' });
  if (permanenza < 2) return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti.' });

  // 2. Controllo Overbooking (Verifica disponibilità per la singola struttura)
  const sqlCheck = `
    SELECT id_soggiorno FROM SOGGIORNI 
    WHERE id_alloggio = ? 
    AND data_check_in < ? 
    AND data_check_out > ?
  `;

  // I parametri sono incrociati appositamente per la formula di sovrapposizione
  db.get(sqlCheck, [id_alloggio, data_check_out, data_check_in], (errCheck: Error | null, row: any): any => {
    if (errCheck) return res.status(500).json({ error: 'Errore DB durante controllo disponibilità: ' + errCheck.message });
    
    // Se 'row' esiste, significa che la query ha trovato un soggiorno che si accavalla
    if (row) return res.status(409).json({ error: 'Overbooking! Le date selezionate sono già occupate in questa struttura.' });

    // 3. Salvataggio Sicuro (Inizio Transazione)
    db.run('BEGIN TRANSACTION;');

    const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'PrenotazioneSito')`;

    db.run(sqlSoggiorno, [id_alloggio, data_check_in, data_check_out], function (this: RunResult, err: Error | null): any {
      if (err) {
        db.run('ROLLBACK;');
        return res.status(500).json({ error: 'Errore salvataggio soggiorno: ' + err.message });
      }

      // Recupera l'ID appena generato per collegare il cliente
      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      db.run(sqlCliente, [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza], (errCliente: Error | null): any => {
          if (errCliente) {
            db.run('ROLLBACK;');
            return res.status(500).json({ error: 'Errore salvataggio cliente: ' + errCliente.message });
          }

          // Tutto è andato a buon fine, confermiamo i dati!
          db.run('COMMIT;');
          return res.status(200).json({
            message: 'Registrazione completata con successo!',
            id_soggiorno: nuovoIdSoggiorno,
          });
        }
      );
    });
  });
};

/**
 * PUT /api/prenotazioni/:id
 * Descrizione: Modifica le date di un soggiorno esistente.
 * * SCELTE TECNICHE PER L'ESAME:
 * L'aggiunta di "AND id_soggiorno != ?" nella query di check permette al cliente 
 * di estendere le proprie date senza che il sistema segnali un falso overbooking 
 * con la sua stessa prenotazione precedente.
 */
export const modificaSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();
  const id_soggiorno = req.params['id'];
  const { data_check_in, data_check_out } = req.body;

  if (!data_check_in || !data_check_out) {
    return res.status(400).json({ error: 'Le date di check-in e check-out sono obbligatorie.' });
  }

  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);

  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) return res.status(400).json({ error: 'Formato data non valido.' });

  const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));
  if (permanenza <= 0) return res.status(400).json({ error: 'La data di check-out deve essere successiva al check-in.' });
  if (permanenza < 2) return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti.' });

  // 1. Recupero l'alloggio associato a questa prenotazione
  db.get(`SELECT id_alloggio FROM SOGGIORNI WHERE id_soggiorno = ?`, [id_soggiorno], (err: Error | null, row: any): any => {
    if (err) return res.status(500).json({ error: 'Errore durante la ricerca del soggiorno: ' + err.message });
    if (!row) return res.status(404).json({ error: 'Soggiorno non trovato.' });

    const id_alloggio = row.id_alloggio;

    // 2. Controllo disponibilità ignorando la prenotazione corrente (id_soggiorno != ?)
    const sqlCheckDisponibilita = `
      SELECT id_soggiorno FROM SOGGIORNI 
      WHERE id_alloggio = ? 
      AND id_soggiorno != ? 
      AND data_check_in < ? 
      AND data_check_out > ?
    `;

    db.get(sqlCheckDisponibilita, [id_alloggio, id_soggiorno, data_check_out, data_check_in], (errCheck: Error | null, overlap: any): any => {
        if (errCheck) return res.status(500).json({ error: 'Errore verifica disponibilità: ' + errCheck.message });
        if (overlap) return res.status(409).json({ error: 'Impossibile modificare: le nuove date si accavallano con un altro cliente.' });

        // 3. Transazione per l'aggiornamento simultaneo
        db.run('BEGIN TRANSACTION;');

        const sqlUpdateSoggiorno = `UPDATE SOGGIORNI SET data_check_in = ?, data_check_out = ? WHERE id_soggiorno = ?`;
        db.run(sqlUpdateSoggiorno, [data_check_in, data_check_out, id_soggiorno], function (errUpdateSoggiorno: Error | null): any {
            if (errUpdateSoggiorno) {
              db.run('ROLLBACK;');
              return res.status(500).json({ error: 'Errore aggiornamento date: ' + errUpdateSoggiorno.message });
            }

            const sqlUpdateCliente = `UPDATE CLIENTE SET permanenza = ? WHERE id_soggiorno = ?`;
            db.run(sqlUpdateCliente, [permanenza, id_soggiorno], function (errUpdateCliente: Error | null) {
                if (errUpdateCliente) {
                  db.run('ROLLBACK;');
                  return res.status(500).json({ error: 'Errore aggiornamento cliente: ' + errUpdateCliente.message });
                }

                db.run('COMMIT;');
                return res.status(200).json({
                  message: 'Prenotazione modificata con successo!',
                  nuova_permanenza: permanenza,
                });
              }
            );
          }
        );
      }
    );
  });
};

/**
 * DELETE /api/prenotazioni/:id
 * Descrizione: Rimuove permanentemente un soggiorno e il relativo cliente.
 * * SCELTE TECNICHE PER L'ESAME:
 * Rispetta rigorosamente l'Integrità Referenziale del database relazionale: 
 * viene eliminato prima il record "figlio" (Tabella Cliente) e poi il record 
 * "padre" (Tabella Soggiorni), il tutto protetto da una Transazione.
 */
export const rimuoviSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();
  const id_soggiorno = req.params['id'];

  db.get(`SELECT id_soggiorno FROM SOGGIORNI WHERE id_soggiorno = ?`, [id_soggiorno], (err: Error | null, row: any): any => {
      if (err) return res.status(500).json({ error: 'Errore durante la ricerca del soggiorno: ' + err.message });
      if (!row) return res.status(404).json({ error: 'Soggiorno non trovato.' });

      db.run('BEGIN TRANSACTION;');

      const sqlDeleteCliente = 'DELETE FROM CLIENTE WHERE id_soggiorno = ?';
      db.run(sqlDeleteCliente, [id_soggiorno], function (errCli: Error | null): any {
        if (errCli) {
          db.run('ROLLBACK;');
          return res.status(500).json({ error: 'Errore rimozione cliente: ' + errCli.message });
        }

        const sqlDeleteSoggiorno = 'DELETE FROM SOGGIORNI WHERE id_soggiorno = ?';
        db.run(sqlDeleteSoggiorno, [id_soggiorno], function (errSogg: Error | null) {
          if (errSogg) {
            db.run('ROLLBACK;');
            return res.status(500).json({ error: 'Errore rimozione soggiorno: ' + errSogg.message });
          }

          db.run('COMMIT;');
          return res.status(200).json({ message: 'Prenotazione e relativi dati cliente rimossi con successo!' });
        });
      });
    }
  );
};

/**
 * POST /api/blocca-date
 * Descrizione: Consente all'Host di chiudere le date per manutenzione o uso personale.
 * Logica: Inserisce un record solo in SOGGIORNI con sorgente 'BloccatoSito'.
 */
export const bloccaDate = (req: Request, res: Response):any => {
  const db = getDb();
  const { id_alloggio, data_check_in, data_check_out } = req.body;

  if (!data_check_in || !data_check_out || !id_alloggio) {
    return res.status(400).json({ error: 'Dati incompleti: id_alloggio e date sono obbligatori.' });
  }

  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);

  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) return res.status(400).json({ error: 'Formato data non valido (usa YYYY-MM-DD).' });

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0); 
  if (inizio < oggi) return res.status(400).json({ error: 'Non puoi bloccare date nel passato.' });

  const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));
  if (permanenza <= 0) return res.status(400).json({ error: 'La data di fine blocco deve essere successiva all\'inizio.' });
  if (permanenza < 2) return res.status(400).json({ error: 'Il periodo minimo di blocco è di 2 notti.' });

  // Controllo Overbooking
  const sqlCheckOccupato = `
    SELECT id_soggiorno FROM SOGGIORNI 
    WHERE id_alloggio = ? 
    AND data_check_in < ? 
    AND data_check_out > ?
  `;

  db.get(sqlCheckOccupato, [id_alloggio, data_check_out, data_check_in], (err: Error | null, row: any):any => {
      if (err) return res.status(500).json({ error: 'Errore durante il controllo disponibilità: ' + err.message });
      if (row) return res.status(409).json({ error: "Conflitto: l'alloggio ha già una prenotazione o un blocco in questo periodo." });

      const sqlInsertBlocco = `
        INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) 
        VALUES (?, ?, ?, 'BloccatoSito')
      `;

      db.run(sqlInsertBlocco, [id_alloggio, data_check_in, data_check_out], function (this: any, errInsert: Error | null) {
          if (errInsert) return res.status(500).json({ error: 'Errore durante il salvataggio del blocco: ' + errInsert.message });

          return res.status(201).json({
            message: 'Alloggio bloccato correttamente per manutenzione.',
            id_blocco: this.lastID
          });
        }
      );
    }
  );
};