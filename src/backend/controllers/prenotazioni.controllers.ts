import { Request, Response } from 'express';
import { getDb } from '../db-config'; 
import { RunResult } from 'sqlite3';

// =========================================================================
// INTERFACCE DI TIPIZZAZIONE (CONTRATTI DATI)
// =========================================================================

/**
 * Rappresenta la struttura dei dati richiesti nel corpo (body) 
 * per la creazione o l'inserimento di un nuovo soggiorno dal sito.
 */
interface INuovoSoggiornoBody {
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
interface IModificaSoggiornoBody {
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


// =========================================================================
// 1. OPERAZIONI CRUD UTENTE / HOST (Gestione Prenotazioni e Blocchi)
// =========================================================================

/**
 * @API POST /api/aggiungi-soggiorno
 * @Descrizione Registra una nuova prenotazione inserita manualmente dal sito, 
 * effettuando controlli di overbooking e inserendo i dati in transazione 
 * sia nella tabella SOGGIORNI che nella tabella CLIENTE.
 */
export const aggiungiSoggiorno = (
  req: Request<{}, {}, INuovoSoggiornoBody>, 
  res: Response
): void => {
  const db = getDb();
  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } = req.body;

  // VERIFICA PRELIMINARE: Controllo presenza campi obbligatori
  if (!id_alloggio || !data_check_in || !data_check_out) {
    res.status(400).json({ error: 'Dati obbligatori mancanti. Impossibile procedere.' });
    return;
  }

  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);

  // VALIDAZIONE: Controllo consistenza formati data
  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
    res.status(400).json({ error: 'Formato data non valido.' });
    return;
  }

  // VALIDAZIONE REGOLA DI BUSINESS: Impedire check-in retroattivi
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0); 
  if (inizio < oggi) {
    res.status(400).json({ error: 'Non puoi effettuare un check-in nel passato!' });
    return;
  }

  // VALIDAZIONE REGOLA DI BUSINESS: Calcolo e vincolo notti minime (Permanenza)
  const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));
  if (permanenza <= 0) {
    res.status(400).json({ error: 'La data di check-out deve essere successiva al check-in.' });
    return;
  }
  if (permanenza < 2) {
    res.status(400).json({ error: 'Filtro di business: Bisogna prenotare almeno per 2 notti.' });
    return;
  }

  // QUERY DI CONTROLLO ANTI-OVERBOOKING: Verifica intersezioni di date per lo stesso alloggio
  const sqlCheck = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ?`;

  db.get(sqlCheck, [id_alloggio, data_check_out, data_check_in], (errCheck, row) => {
    if (errCheck) {
      res.status(500).json({ error: 'Errore controllo disponibilità: ' + errCheck.message });
      return;
    }
    if (row) {
      res.status(409).json({ error: 'Overbooking! Date già occupate in questa struttura.' });
      return;
    }

    // ACID TRANSAZIONALE: Avvio transazione per garantire atomicità tra le due tabelle
    db.run('BEGIN TRANSACTION;');

    const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'PrenotazioneSito')`;

    db.run(sqlSoggiorno, [id_alloggio, data_check_in, data_check_out], function (this: RunResult, err) {
      if (err) { 
        db.run('ROLLBACK;'); 
        res.status(500).json({ error: 'Errore inserimento soggiorno: ' + err.message }); 
        return; 
      }

      // Recupero l'ID autoincrementale appena generato da SQLite per collegare il cliente
      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      db.run(sqlCliente, [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza], (errCliente) => {
        if (errCliente) { 
          db.run('ROLLBACK;'); 
          res.status(500).json({ error: 'Errore inserimento anagrafica cliente: ' + errCliente.message }); 
          return; 
        }
        
        // Se entrambe le INSERT vanno a buon fine, salviamo permanentemente nel file DB
        db.run('COMMIT;');
        res.status(200).json({ message: 'Registrazione completata con successo!', id_soggiorno: nuovoIdSoggiorno });
      });
    });
  });
};

/**
 * @API PUT /api/:id
 * @Descrizione Modifica le date di check-in e check-out di un soggiorno esistente, 
 * ricalcolando i giorni di permanenza ed escludendo l'id corrente 
 * dal controllo di overbooking.
 */
export const modificaSoggiorno = (
  req: Request<{ id: string }, {}, IModificaSoggiornoBody>, 
  res: Response
): void => {
  const db = getDb();
  const id_soggiorno = req.params.id;
  const { data_check_in, data_check_out } = req.body;

  if (!data_check_in || !data_check_out) {
    res.status(400).json({ error: 'Date obbligatorie per la modifica.' });
    return;
  }

  const inizio = new Date(data_check_in);
  const fine = new Date(data_check_out);
  const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));

  if (permanenza <= 0 || permanenza < 2) {
    res.status(400).json({ error: 'Date non valide o inferiori al minimo di 2 notti.' });
    return;
  }

  // Recupero l'alloggio associato per poter fare il controllo di sovrapposizione date
  db.get(`SELECT id_alloggio FROM SOGGIORNI WHERE id_soggiorno = ?`, [id_soggiorno], (err, row: { id_alloggio: number } | undefined) => {
    if (err || !row) {
      res.status(404).json({ error: 'Soggiorno non trovato nel database.' });
      return;
    }

    // Escludiamo "id_soggiorno != ?" dalla query per evitare che il record vada in conflitto con se stesso
    const sqlCheckDisponibilita = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND id_soggiorno != ? AND data_check_in < ? AND data_check_out > ?`;

    db.get(sqlCheckDisponibilita, [row.id_alloggio, id_soggiorno, data_check_out, data_check_in], (errCheck, overlap) => {
      if (overlap) {
        res.status(409).json({ error: 'Impossibile modificare: le nuove date sono già occupate.' });
        return;
      }

      // Transazione per aggiornare coerentemente date del soggiorno e giorni di permanenza dell'anagrafica
      db.run('BEGIN TRANSACTION;');
      db.run(`UPDATE SOGGIORNI SET data_check_in = ?, data_check_out = ? WHERE id_soggiorno = ?`, [data_check_in, data_check_out, id_soggiorno], (errUp) => {
        if (errUp) { db.run('ROLLBACK;'); res.status(500).json({ error: errUp.message }); return; }

        db.run(`UPDATE CLIENTE SET permanenza = ? WHERE id_soggiorno = ?`, [permanenza, id_soggiorno], (errCli) => {
          if (errCli) { db.run('ROLLBACK;'); res.status(500).json({ error: errCli.message }); return; }
          
          db.run('COMMIT;');
          res.status(200).json({ message: 'Prenotazione modificata correttamente!', nuova_permanenza: permanenza });
        });
      });
    });
  });
};

/**
 * @API DELETE /api/:id
 * @Descrizione Elimina una prenotazione rimuovendo in cascata prima i dati del cliente 
 * e successivamente la riga del soggiorno, rispettando i vincoli di integrità.
 */
export const rimuoviSoggiorno = (req: Request<{ id: string }>, res: Response): void => {
  const db = getDb();
  const id_soggiorno = req.params.id;

  db.run('BEGIN TRANSACTION;');
  
  // Rimozione record figlio (CLIENTE)
  db.run('DELETE FROM CLIENTE WHERE id_soggiorno = ?', [id_soggiorno], (err) => {
    if (err) { db.run('ROLLBACK;'); res.status(500).json({ error: err.message }); return; }
    
    // Rimozione record padre (SOGGIORNI)
    db.run('DELETE FROM SOGGIORNI WHERE id_soggiorno = ?', [id_soggiorno], (errSogg) => {
      if (errSogg) { db.run('ROLLBACK;'); res.status(500).json({ error: errSogg.message }); return; }
      
      db.run('COMMIT;');
      res.status(200).json({ message: 'Prenotazione rimossa con successo dal sistema.' });
    });
  });
};

/**
 * @API POST /api/blocca-date
 * @Descrizione Permette all'Host di bloccare manualmente un range di date 
 * (es. per manutenzione straordinaria) impostando la sorgente su 'BloccatoSito'.
 */
export const bloccaDate = (
  req: Request<{}, {}, IBloccoDateBody>, 
  res: Response
): void => {
  const db = getDb();
  const { id_alloggio, data_check_in, data_check_out } = req.body;

  const sqlCheckOccupato = `SELECT id_soggiorno FROM SOGGIORNI WHERE id_alloggio = ? AND data_check_in < ? AND data_check_out > ?`;
  
  db.get(sqlCheckOccupato, [id_alloggio, data_check_out, data_check_in], (err, row) => {
    if (row) {
      res.status(409).json({ error: "L'alloggio risulta già occupato o bloccato in questo periodo." });
      return;
    }

    const sqlInsertBlocco = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'BloccatoSito')`;
    db.run(sqlInsertBlocco, [id_alloggio, data_check_in, data_check_out], function(this: RunResult, errInsert) {
      if (errInsert) {
        res.status(500).json({ error: errInsert.message });
        return;
      }
      res.status(201).json({ message: 'Alloggio bloccato correttamente.', id_blocco: this.lastID });
    });
  });
};


// =========================================================================
// 2. CONTROLLER DATA ACQUISITION & MONITORING (Aggregazione Dati Dashboard)
// =========================================================================

/**
 * @API GET /api/dashboard/stats
 * @Descrizione Elabora i conteggi statistici in tempo reale per i 4 Box in alto 
 * della Dashboard analizzando la data odierna (YYYY-MM-DD).
 */
export const getDashboardStats = (req: Request, res: Response): void => {
  const db = getDb();
  const oggi = new Date().toISOString().split('T')[0]; // Genera la data odierna in formato ISO YYYY-MM-DD

  // Query asincrone parallele per calcolare le metriche della giornata
  const qOccupate = `SELECT COUNT(DISTINCT id_alloggio) as conto FROM SOGGIORNI WHERE ? BETWEEN data_check_in AND data_check_out`;
  const qArrivi = `SELECT COUNT(*) as conto FROM SOGGIORNI WHERE data_check_in = ? AND sorgente != 'BloccatoSito' AND sorgente != 'BloccatoAirbnb'`;
  const qPartenze = `SELECT COUNT(*) as conto FROM SOGGIORNI WHERE data_check_out = ? AND sorgente != 'BloccatoSito' AND sorgente != 'BloccatoAirbnb'`;

  db.get(qOccupate, [oggi], (err, rowOccupate: { conto: number } | undefined) => {
    db.get(qArrivi, [oggi], (err2, rowArrivi: { conto: number } | undefined) => {
      db.get(qPartenze, [oggi], (err3, rowPartenze: { conto: number } | undefined) => {
        
        // Risposta unificata aggregando i singoli risultati dei conteggi
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

/**
 * @API GET /api/soggiorni/attivi
 * @Descrizione Estrae l'elenco di tutti i soggiorni in corso nella data odierna, 
 * effettuando una JOIN con la tabella ALLOGGIO per visualizzare il nome testuale della stanza.
 */
export const getSoggiorniAttivi = (req: Request, res: Response): void => {
  const db = getDb();
  const oggi = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT S.*, A.nome_alloggio 
    FROM SOGGIORNI S
    JOIN ALLOGGIO A ON S.id_alloggio = A.id_alloggio
    WHERE ? BETWEEN S.data_check_in AND S.data_check_out
    ORDER BY S.data_check_out ASC
  `;
  
  db.all(sql, [oggi], (err, rows: ISoggiornoAttivo[]) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
};

/**
 * @API GET /api/alloggi/stato-pulizie
 * @Descrizione Recupera lo stato corrente delle pulizie di ciascun alloggio presente 
 * nel sistema per popolare il widget di destra della Dashboard.
 */
export const getStatoPulizie = (req: Request, res: Response): void => {
  const db = getDb();
  
  db.all(`SELECT id_alloggio, nome_alloggio, stato_pulizia FROM ALLOGGIO`, [], (err, rows: IStatoPuliziaAlloggio[]) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
};


// =========================================================================
// 3. CONTROLLER GESTIONALI HOST ( Flussi Operativi e Ricerca)
// =========================================================================

/**
 * @API PUT /api/alloggi/:id/pulizie
 * @Descrizione Permette all'Host o al Co-Host di cambiare lo stato di pulizia 
 * di una stanza (0 = Da Pulire, 1 = Pulita).
 */
export const aggiornaPulizie = (req: Request<{ id: string }, {}, { stato_pulizia: number }>, res: Response): void => {
  const db = getDb();
  const { id } = req.params;
  const { stato_pulizia } = req.body;

  db.run(`UPDATE ALLOGGIO SET stato_pulizia = ? WHERE id_alloggio = ?`, [stato_pulizia, id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Stato pulizia alloggio aggiornato con successo!' });
  });
};

/**
 * @API PUT /api/:id/checkin
 * @Descrizione Esegue il "Check-in Digitale" dell'ospite in struttura, marcando 
 * il flag stato_osservatorio_in a 1 (Pronto per l'esportazione burocratica).
 */
export const azionaCheckIn = (req: Request<{ id: string }>, res: Response): void => {
  const db = getDb();
  
  db.run(`UPDATE SOGGIORNI SET stato_osservatorio_in = 1 WHERE id_soggiorno = ?`, [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Check-in registrato internamente nel PMS.' });
  });
};

/**
 * @API PUT /api/:id/checkout
 * @Descrizione Registra il "Check-out Digitale" al momento della partenza fisica dell'ospite,
 * impostando il flag stato_osservatorio_out a 1.
 */
export const azionaCheckOut = (req: Request<{ id: string }>, res: Response): void => {
  const db = getDb();
  
  db.run(`UPDATE SOGGIORNI SET stato_osservatorio_out = 1 WHERE id_soggiorno = ?`, [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Check-out completato e archiviato.' });
  });
};

/**
 * @API GET /api/storico/ricerca
 * @Descrizione Gestisce la pagina dello Storico delle Prenotazioni, permettendo 
 * all'Host di filtrare i risultati per un alloggio specifico tramite Query Parameter opzionale (?id_alloggio=X).
 */
export const storicoPrenotazioni = (
  req: Request<{}, {}, {}, { id_alloggio?: string }>, 
  res: Response
): void => {
  const db = getDb();
  const { id_alloggio } = req.query; // Estrazione del filtro opzionale dall'URL

  // Query base di selezione con JOIN per mostrare il nome dell'alloggio
  let sql = `SELECT S.*, A.nome_alloggio FROM SOGGIORNI S JOIN ALLOGGIO A ON S.id_alloggio = A.id_alloggio`;
  const params: any[] = [];

  // APPLICAZIONE DINAMICA DEL FILTRO SQL: Se l'host ha selezionato una stanza specifica, aggiungo la clausola WHERE
  if (id_alloggio) {
    sql += ` WHERE S.id_alloggio = ?`;
    params.push(id_alloggio);
  }
  
  // Ordiniamo le prenotazioni partendo dalle più recenti in assoluto
  sql += ` ORDER BY S.data_check_in DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
};