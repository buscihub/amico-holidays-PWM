import { Request, Response } from 'express';
import { getDb } from '../db-config'; 
import { RunResult } from 'sqlite3';

// =========================================================================
// 1. OPERAZIONI CRUD UTENTE / HOST (Aggiunta, Modifica, Rimozione, Blocco)
// =========================================================================

export const aggiungiSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();
  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } = req.body;

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

  const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));
  if (permanenza <= 0) return res.status(400).json({ error: 'La data di check-out deve essere successiva al check-in.' });
  if (permanenza < 2) return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti.' });

  const sqlCheck = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ?`;

  db.get(sqlCheck, [id_alloggio, data_check_out, data_check_in], (errCheck, row): any => {
    if (errCheck) return res.status(500).json({ error: 'Errore controllo disponibilità: ' + errCheck.message });
    if (row) return res.status(409).json({ error: 'Overbooking! Date già occupate in questa struttura.' });

    db.run('BEGIN TRANSACTION;');
    const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'PrenotazioneSito')`;

    db.run(sqlSoggiorno, [id_alloggio, data_check_in, data_check_out], function (this: RunResult, err): any {
      if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: err.message }); }

      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      db.run(sqlCliente, [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza], (errCliente) => {
        if (errCliente) { db.run('ROLLBACK;'); return res.status(500).json({ error: errCliente.message }); }
        db.run('COMMIT;');
        return res.status(200).json({ message: 'Registrazione completata!', id_soggiorno: nuovoIdSoggiorno });
      });
    });
  });
};

export const modificaSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();
  const id_soggiorno = req.params['id'];
  const { data_check_in, data_check_out } = req.body;

  if (!data_check_in || !data_check_out) return res.status(400).json({ error: 'Date obbligatorie.' });

  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);
  const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));

  if (permanenza <= 0 || permanenza < 2) return res.status(400).json({ error: 'Date non valide o inferiori a 2 notti.' });

  db.get(`SELECT id_alloggio FROM SOGGIORNI WHERE id_soggiorno = ?`, [id_soggiorno], (err, row: any): any => {
    if (err || !row) return res.status(404).json({ error: 'Soggiorno non trovato.' });

    const sqlCheckDisponibilita = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND id_soggiorno != ? AND data_check_in < ? AND data_check_out > ?`;

    db.get(sqlCheckDisponibilita, [row.id_alloggio, id_soggiorno, data_check_out, data_check_in], (errCheck, overlap): any => {
      if (overlap) return res.status(409).json({ error: 'Impossibile modificare: date occupate.' });

      db.run('BEGIN TRANSACTION;');
      db.run(`UPDATE SOGGIORNI SET data_check_in = ?, data_check_out = ? WHERE id_soggiorno = ?`, [data_check_in, data_check_out, id_soggiorno], (errUp): any => {
        if (errUp) { db.run('ROLLBACK;'); return res.status(500).json({ error: errUp.message }); }

        db.run(`UPDATE CLIENTE SET permanenza = ? WHERE id_soggiorno = ?`, [permanenza, id_soggiorno], (errCli) => {
          if (errCli) { db.run('ROLLBACK;'); return res.status(500).json({ error: errCli.message }); }
          db.run('COMMIT;');
          return res.status(200).json({ message: 'Prenotazione modificata!', nuova_permanenza: permanenza });
        });
      });
    });
  });
};

export const rimuoviSoggiorno = (req: Request, res: Response): any => {
  const db = getDb();
  const id_soggiorno = req.params['id'];

  db.run('BEGIN TRANSACTION;');
  db.run('DELETE FROM CLIENTE WHERE id_soggiorno = ?', [id_soggiorno], (err): any => {
    if (err) { db.run('ROLLBACK;'); return res.status(500).json({ error: err.message }); }
    
    db.run('DELETE FROM SOGGIORNI WHERE id_soggiorno = ?', [id_soggiorno], (errSogg) => {
      if (errSogg) { db.run('ROLLBACK;'); return res.status(500).json({ error: errSogg.message }); }
      db.run('COMMIT;');
      return res.status(200).json({ message: 'Prenotazione rimossa con successo.' });
    });
  });
};

export const bloccaDate = (req: Request, res: Response): any => {
  const db = getDb();
  const { id_alloggio, data_check_in, data_check_out } = req.body;

  const sqlCheckOccupato = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ?`;
  db.get(sqlCheckOccupato, [id_alloggio, data_check_out, data_check_in], (err, row): any => {
    if (row) return res.status(409).json({ error: "Alloggio già occupato in questo periodo." });

    const sqlInsertBlocco = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'BloccatoSito')`;
    db.run(sqlInsertBlocco, [id_alloggio, data_check_in, data_check_out], function(this: RunResult) {
      return res.status(201).json({ message: 'Alloggio bloccato correttamente.', id_blocco: this.lastID });
    });
  });
};

// =========================================================================
// 2. CONTROLLER DATA ACQUISITION & MONITORING (Dashboard Stats, Attivi, Pulizie)
// =========================================================================

export const getDashboardStats = (req: Request, res: Response) => {
  const db = getDb();
  const oggi = new Date().toISOString().split('T')[0];

  const qOccupate = `SELECT COUNT(DISTINCT id_alloggio) as conto FROM SOGGIORNI WHERE ? BETWEEN data_check_in AND data_check_out`;
  const qArrivi = `SELECT COUNT(*) as conto FROM SOGGIORNI WHERE data_check_in = ?`;
  const qPartenze = `SELECT COUNT(*) as conto FROM SOGGIORNI WHERE data_check_out = ?`;

  db.get(qOccupate, [oggi], (err, rowOccupate: any) => {
    db.get(qArrivi, [oggi], (err2, rowArrivi: any) => {
      db.get(qPartenze, [oggi], (err3, rowPartenze: any) => {
        res.json({
          camereOccupate: rowOccupate?.conto || 0,
          inArrivo: rowArrivi?.conto || 0,
          inPartenza: rowPartenze?.conto || 0,
          checkOutDaFare: rowPartenze?.conto || 0
        });
      });
    });
  });
};

export const getSoggiorniAttivi = (req: Request, res: Response) => {
  const db = getDb();
  const oggi = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT S.*, A.nome_alloggio 
    FROM SOGGIORNI S
    JOIN ALLOGGIO A ON S.id_alloggio = A.id_alloggio
    WHERE ? BETWEEN S.data_check_in AND S.data_check_out
    ORDER BY S.data_check_out ASC
  `;
  db.all(sql, [oggi], (err, rows): any => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

export const getStatoPulizie = (req: Request, res: Response) => {
  const db = getDb();
  db.all(`SELECT id_alloggio, nome_alloggio, stato_pulizia FROM ALLOGGIO`, [], (err, rows): any => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

// =========================================================================
// 3. CONTROLLER GESTIONALI HOST (Aggiornamento Stati e Storico Ricerca)
// =========================================================================

export const aggiornaPulizie = (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { stato_pulizia } = req.body;

  db.run(`UPDATE ALLOGGIO SET stato_pulizia = ? WHERE id_alloggio = ?`, [stato_pulizia, id], (err): any => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Stato pulizia aggiornato!' });
  });
};

export const azionaCheckIn = (req: Request, res: Response) => {
  const db = getDb();
  db.run(`UPDATE SOGGIORNI SET stato_osservatorio_in = 1 WHERE id_soggiorno = ?`, [req.params['id']], (err): any => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Check-in registrato internamente.' });
  });
};

export const azionaCheckOut = (req: Request, res: Response) => {
  const db = getDb();
  db.run(`UPDATE SOGGIORNI SET stato_osservatorio_out = 1 WHERE id_soggiorno = ?`, [req.params['id']], (err): any => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Check-out registrato internamente.' });
  });
};

export const storicoPrenotazioni = (req: Request, res: Response) => {
  const db = getDb();
  const { id_alloggio } = req.query;

  let sql = `SELECT S.*, A.nome_alloggio FROM SOGGIORNI S JOIN ALLOGGIO A ON S.id_alloggio = A.id_alloggio`;
  const params: any[] = [];

  if (id_alloggio) {
    sql += ` WHERE S.id_alloggio = ?`;
    params.push(id_alloggio);
  }
  sql += ` ORDER BY S.data_check_in DESC`;

  db.all(sql, params, (err, rows): any => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};