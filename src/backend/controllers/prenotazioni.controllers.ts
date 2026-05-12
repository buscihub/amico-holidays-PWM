import { Request, Response } from 'express';
import { getDb } from '../db-config'; // Importa getDb da qui
import { RunResult } from 'sqlite3';

// Esportiamo la funzione che contiene tutta la logica che prima era in server.ts
export const registraCliente = (req: Request, res: Response): any => {
  const db = getDb();

  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } =
    req.body;

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

  const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'manuale')`;

  db.run(
    sqlSoggiorno,
    [id_alloggio, data_check_in, data_check_out],
    function (this: RunResult, err: Error | null): any {
      if (err) {
        return res.status(500).json({ error: 'Errore salvataggio soggiorno: ' + err.message });
      }

      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      db.run(
        sqlCliente,
        [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza],
        (errCliente: Error | null): any => {
          if (errCliente) {
            return res
              .status(500)
              .json({ error: 'Errore salvataggio cliente: ' + errCliente.message });
          }

          return res.status(200).json({
            message: 'Registrazione completata con successo!',
            id_soggiorno: nuovoIdSoggiorno,
          });
        },
      );
    },
  );
};