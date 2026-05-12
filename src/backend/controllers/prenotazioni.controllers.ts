import { Request, Response } from 'express';
import { getDb } from '../db-config'; // Assicurati che il percorso sia corretto
import { RunResult } from 'sqlite3';

// POST /api/prenotazioni/ - Inserimento manuale di un nuovo soggiorno e relativo cliente
export const aggiungiSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();

  // DESTRUTTURAZIONE: Estraiamo i dati inviati dal frontend dal corpo della richiesta (body)
  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } =
    req.body;

  // 1. VALIDAZIONE PRESENZA DATI: Controllo di sicurezza per evitare l'inserimento di campi nulli obbligatori
  if (!id_alloggio || !data_check_in || !data_check_out) {
    return res.status(400).json({ error: 'Dati mancanti. Impossibile procedere.' });
  }

  // CONVERSIONE DATE: Trasformiamo le stringhe ISO in oggetti Date per manipolarle a livello logico
  const fine = new Date(data_check_out);
  const inizio = new Date(data_check_in);

  // VALIDAZIONE FORMATO: Verifichiamo che le stringhe ricevute siano effettivamente date valide
  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
    return res.status(400).json({ error: 'Formato data non valido.' });
  }

  // CONTROLLO TEMPORALE: Impediamo prenotazioni retroattive (check-in nel passato)
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0); // Azzeriamo l'ora per confrontare solo il giorno
  if (inizio < oggi) {
    return res.status(400).json({ error: 'Non puoi effettuare un check-in nel passato!' });
  }

  // 2. CALCOLO LOGICO PERMANENZA: Determiniamo il numero di notti tramite la differenza temporale
  const diffInMs = fine.getTime() - inizio.getTime();
  const permanenza = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  // COERENZA DATE: La data di uscita deve essere logicamente successiva a quella di entrata
  if (permanenza <= 0) {
    return res
      .status(400)
      .json({ error: 'La data di check-out deve essere successiva al check-in.' });
  }

  // BUSINESS RULE: Vincolo commerciale del B&B (soggiorno minimo di 2 notti)
  if (permanenza < 2) {
    return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti' });
  }

  // 3. TRANSAZIONE ATOMICA: Avviamo una transazione SQL. 
  // Questo assicura che se il salvataggio del Cliente fallisce, venga annullato anche il Soggiorno (niente dati orfani).
  db.run('BEGIN TRANSACTION;');

  // QUERY SOGGIORNO: Prepariamo l'inserimento nella tabella principale
  const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'PrenotazioneSito')`;

  db.run(
    sqlSoggiorno,
    [id_alloggio, data_check_in, data_check_out],
    function (this: RunResult, err: Error | null): any {
      if (err) {
        // GESTIONE ERRORE: Se il primo insert fallisce, facciamo il ROLLBACK per sicurezza
        db.run('ROLLBACK;');
        return res.status(500).json({ error: 'Errore salvataggio soggiorno: ' + err.message });
      }

      // RECUPERO ID GENERATO: Otteniamo l'ID del soggiorno appena creato (Primary Key) 
      // per collegarlo come Foreign Key nella tabella CLIENTE.
      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      // QUERY CLIENTE: Inseriamo i dati anagrafici e la permanenza calcolata
      db.run(
        sqlCliente,
        [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza],
        (errCliente: Error | null): any => {
          if (errCliente) {
            // INTEGRITÀ DEI DATI: Se il cliente fallisce, annulliamo anche la creazione del soggiorno precedente
            db.run('ROLLBACK;');
            return res
              .status(500)
              .json({ error: 'Errore salvataggio cliente: ' + errCliente.message });
          }

          // FINALIZZAZIONE: Tutto è andato a buon fine, scriviamo definitivamente le modifiche sul database
          db.run('COMMIT;');

          return res.status(200).json({
            message: 'Registrazione completata con successo!',
            id_soggiorno: nuovoIdSoggiorno,
          });
        },
      );
    },
  );
};

// PUT /api/prenotazioni/:id - Modifica manuale di un soggiorno
export const modificaSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();

  // ESTRAZIONE DATI: Recuperiamo l'ID dall'URL e le nuove date dal corpo della richiesta (Body)
  const { id } = req.params;
  const id_soggiorno = id;
  const { data_check_in, data_check_out } = req.body;

  // VALIDAZIONE BASE: Verifichiamo che l'utente non abbia inviato campi vuoti
  if (!data_check_in || !data_check_out) {
    return res.status(400).json({ error: 'Le date di check-in e check-out sono obbligatorie.' });
  }

  // PARSING DELLE DATE: Trasformiamo le stringhe in oggetti Date per poter fare calcoli matematici
  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);

  // CONTROLLO FORMATO: Verifichiamo che le date inserite siano scritte correttamente
  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
    return res.status(400).json({ error: 'Formato data non valido.' });
  }

  // BUSINESS LOGIC: Calcoliamo la durata del soggiorno (differenza tra date in millisecondi convertita in giorni)
  const diffInMs = fine.getTime() - inizio.getTime();
  const permanenza = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  // VINCOLI DI PRENOTAZIONE: Controllo ordine temporale (non si può uscire prima di entrare)
  if (permanenza <= 0) {
    return res
      .status(400)
      .json({ error: 'La data di check-out deve essere successiva al check-in.' });
  }

  // REQUISITO MINIMO: Il B&B impone almeno 2 notti di permanenza
  if (permanenza < 2) {
    return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti.' });
  }

  // RECUPERO INFO SOGGIORNO: Prima di modificare, dobbiamo sapere a quale alloggio appartiene il soggiorno
  db.get(
    `SELECT id_alloggio FROM SOGGIORNI WHERE id_soggiorno = ?`,
    [id_soggiorno],
    (err: Error | null, row: any): any => {
      if (err) {
        return res
          .status(500)
          .json({ error: 'Errore durante la ricerca del soggiorno: ' + err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Soggiorno non trovato.' });
      }

      const id_alloggio = row.id_alloggio;

      // ANTI-OVERBOOKING: Query complessa per vedere se le nuove date "toccano" altre prenotazioni esistenti.
      // Il pezzo "id_soggiorno != ?" è fondamentale per non far scontrare la prenotazione con se stessa!
      const sqlCheckDisponibilita = `
      SELECT id_soggiorno 
      FROM SOGGIORNI 
      WHERE id_alloggio = ? 
      AND id_soggiorno != ? 
      AND data_check_in < ? 
      AND data_check_out > ?
    `;

      db.get(
        sqlCheckDisponibilita,
        [id_alloggio, id_soggiorno, data_check_out, data_check_in],
        (errCheck: Error | null, overlap: any): any => {
          if (errCheck) {
            return res
              .status(500)
              .json({ error: 'Errore verifica disponibilità: ' + errCheck.message });
          }

          if (overlap) {
            return res.status(409).json({
              error: 'Impossibile modificare: le date si accavallano con un altro soggiorno.',
            });
          }

          // TRANSAZIONE: Iniziamo un'operazione "Atomica". O si aggiorna tutto o non si aggiorna niente.
          db.run('BEGIN TRANSACTION;');

          // OPERAZIONE 1: Aggiorniamo le date nella tabella principale SOGGIORNI
          const sqlUpdateSoggiorno = `UPDATE SOGGIORNI SET data_check_in = ?, data_check_out = ? WHERE id_soggiorno = ?`;

          db.run(
            sqlUpdateSoggiorno,
            [data_check_in, data_check_out, id_soggiorno],
            function (this: RunResult, errUpdateSoggiorno: Error | null): any {
              if (errUpdateSoggiorno) {
                db.run('ROLLBACK;'); // Se fallisce, annulliamo tutto
                return res
                  .status(500)
                  .json({ error: 'Errore aggiornamento date: ' + errUpdateSoggiorno.message });
              }

              // OPERAZIONE 2: Aggiorniamo il numero di notti nella tabella CLIENTE (Dati Osservatorio)
              const sqlUpdateCliente = `UPDATE CLIENTE SET permanenza = ? WHERE id_soggiorno = ?`;

              db.run(
                sqlUpdateCliente,
                [permanenza, id_soggiorno],
                function (errUpdateCliente: Error | null) {
                  if (errUpdateCliente) {
                    db.run('ROLLBACK;'); // Se fallisce anche solo questa, annulliamo anche l'operazione 1
                    return res
                      .status(500)
                      .json({ error: 'Errore aggiornamento cliente: ' + errUpdateCliente.message });
                  }

                  // CONFERMA: Tutto è andato a buon fine, salviamo i cambiamenti definitivamente
                  db.run('COMMIT;');
                  return res.status(200).json({
                    message: 'Prenotazione modificata con successo!',
                    nuova_permanenza: permanenza,
                  });
                },
              );
            },
          );
        },
      );
    },
  );
};

// DELETE /api/prenotazioni/:id - Rimozione manuale di un soggiorno
export const rimuoviSoggiorno = (req: Request, res: Response) => {
  // Rimosso ": any" per evitare l'errore di TypeScript
  const db = getDb();

  // ESTRAZIONE PARAMETRI: Recuperiamo l'ID del soggiorno dall'URL
  const { id } = req.params;
  const id_soggiorno = id;

  // 1. VERIFICA ESISTENZA: Controlliamo se il soggiorno esiste davvero prima di provare a cancellare qualcosa.
  db.get(
    `SELECT id_soggiorno FROM SOGGIORNI WHERE id_soggiorno = ?`,
    [id_soggiorno],
    (err: Error | null, row: any): any => {
      if (err) {
        return res
          .status(500)
          .json({ error: 'Errore durante la ricerca del soggiorno: ' + err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Soggiorno non trovato.' });
      }

      // 2. TRANSAZIONE ACID: Iniziamo un'operazione "Atomica". Garantisce che se il server crasha a metà, il DB non rimanga sporco.
      db.run('BEGIN TRANSACTION;');

      // 3. ELIMINAZIONE FIGLIO (INTEGRITÀ REFERENZIALE):
      // Dobbiamo cancellare PRIMA dalla tabella CLIENTE. Dato che CLIENTE ha id_soggiorno come chiave esterna, usiamo direttamente quello.
      const sqlDeleteCliente = 'DELETE FROM CLIENTE WHERE id_soggiorno = ?';

      db.run(sqlDeleteCliente, [id_soggiorno], function (errCli: Error | null):any {
        if (errCli) {
          db.run('ROLLBACK;'); // Se fallisce, annulliamo la transazione
          return res.status(500).json({ error: 'Errore rimozione cliente: ' + errCli.message });
        }

        // 4. ELIMINAZIONE PADRE: Questa query è ANNIDATA dentro la callback precedente.
        // Node.js la eseguirà SOLO dopo aver avuto la certezza che il cliente sia stato cancellato.
        const sqlDeleteSoggiorno = 'DELETE FROM SOGGIORNI WHERE id_soggiorno = ?';

        db.run(sqlDeleteSoggiorno, [id_soggiorno], function (errSogg: Error | null) {
          if (errSogg) {
            db.run('ROLLBACK;'); // Se fallisce questa, il ROLLBACK ripristinerà anche il cliente appena cancellato!
            return res
              .status(500)
              .json({ error: 'Errore rimozione soggiorno: ' + errSogg.message });
          }

          // 5. CONFERMA FINALE: Tutto è andato a buon fine in entrambe le tabelle, salviamo i cambiamenti definitivamente.
          db.run('COMMIT;');
          return res.status(200).json({
            message: 'Prenotazione e relativi dati cliente rimossi con successo!',
          });
        });
      });
    },
  );
};
