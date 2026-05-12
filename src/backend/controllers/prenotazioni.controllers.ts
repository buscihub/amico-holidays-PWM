import { Request, Response } from 'express';
import { getDb } from '../db-config'; // Assicurati che il percorso sia corretto
import { RunResult } from 'sqlite3';

// POST: Creazione manuale di un Soggiorno e del relativo Cliente
export const registraCliente = (req: Request, res: Response): any => {
  const db = getDb();

  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } =
    req.body;

  // 1. Validazione dati in ingresso
  if (!id_alloggio || !data_check_in || !data_check_out) {
    return res.status(400).json({ error: 'Dati mancanti. Impossibile procedere.' });
  }

  const fine = new Date(data_check_out);
  const inizio = new Date(data_check_in);

  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
    return res.status(400).json({ error: 'Formato data non valido.' });
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  if (inizio < oggi) {
    return res.status(400).json({ error: 'Non puoi effettuare un check-in nel passato!' });
  }

  // 2. Calcolo permanenza in notti
  const diffInMs = fine.getTime() - inizio.getTime();
  const permanenza = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  if (permanenza <= 0) {
    return res
      .status(400)
      .json({ error: 'La data di check-out deve essere successiva al check-in.' });
  }

  if (permanenza < 2) {
    return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti' });
  }

  // 3. Inizio Transazione SQL per garantire l'integrità dei dati
  db.run("BEGIN TRANSACTION;");

  // Nome della tabella corretto in base alla tua inizializzazione (SOGGIORNI)
  const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'manuale')`;

  db.run(
    sqlSoggiorno,
    [id_alloggio, data_check_in, data_check_out],
    function (this: RunResult, err: Error | null): any {
      if (err) {
        // Se l'inserimento del soggiorno fallisce, si annulla la transazione
        db.run("ROLLBACK;");
        return res.status(500).json({ error: 'Errore salvataggio soggiorno: ' + err.message });
      }

      // this.lastID contiene l'id_soggiorno appena generato dal database
      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      db.run(
        sqlCliente,
        [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza],
        (errCliente: Error | null): any => {
          if (errCliente) {
            // Se l'inserimento del cliente fallisce, si annulla TUTTO (elimina in automatico anche il soggiorno appena creato)
            db.run("ROLLBACK;");
            return res
              .status(500)
              .json({ error: 'Errore salvataggio cliente: ' + errCliente.message });
          }

          // Se entrambi gli inserimenti sono andati a buon fine, salviamo definitivamente
          db.run("COMMIT;");
          
          return res.status(200).json({
            message: 'Registrazione completata con successo!',
            id_soggiorno: nuovoIdSoggiorno,
          });
        },
      );
    },
  );
};