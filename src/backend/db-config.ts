import sqlite3, { Database } from 'sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';

let db: sqlite3.Database;

export const initDb = () => {
  // 1. SCUDO: Evita che venga inizializzato due volte
  // (Presuppone che 'db' sia la tua variabile globale dichiarata fuori da questa funzione)
  if (db) {
    console.log('⚠️ Il database è già stato inizializzato in precedenza.');
    return;
  }

  // Definiamo il percorso del file database (sarà creato nella root del progetto)
  const dbPath = path.resolve(process.cwd(), 'amicos_holidays.db');

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Errore critico durante la connessione al DB:', err.message);
      return; // 2. SCUDO: Blocca l'esecuzione se non c'è il file o non ha i permessi
    }
    console.log('✅ Database SQLite connesso con successo!');
  });

  db.serialize(() => {
    // 3. SCUDO: Abilita i vincoli delle chiavi esterne (FONDAMENTALE)
    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) console.error('❌ Errore attivazione Foreign Keys:', err.message);
      else console.log('🔐 Chiavi esterne (Foreign Keys) abilitate con successo.');
    });

    // Tabella STAFF
    db.run(`CREATE TABLE IF NOT EXISTS STAFF (
              id_staff INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              ruolo TEXT CHECK(ruolo IN ('host', 'cohost')) NOT NULL
          )`, 
          () => {
              // SEEDING STAFF: Creiamo l'account admin di default (se non esiste già)
              const emailAdmin = 'giuseppelia250728@gmail.com';
              const passwordInChiaro = 'admin123';
              
              // Generiamo l'hash crittografato della password
              const passwordHash = bcrypt.hashSync(passwordInChiaro, 10);

              // Inseriamo l'utente ignorando l'errore se esiste già (grazie a UNIQUE su email)
              const stmtStaff = db.prepare(`INSERT OR IGNORE INTO STAFF (email, password_hash, ruolo) VALUES (?, ?, 'host')`);
              stmtStaff.run(emailAdmin, passwordHash);
              stmtStaff.finalize();
              
              console.log('👤 Account Host verificato/creato (admin@amicos.it)');
          });

    // Tabella ALLOGGIO (Pretoria, Massimo, Cattedrale)
    db.run(
      `CREATE TABLE IF NOT EXISTS ALLOGGIO (
              id_alloggio INTEGER PRIMARY KEY AUTOINCREMENT,
              nome_alloggio TEXT UNIQUE NOT NULL,
              stato_pulizia INTEGER DEFAULT 1, 
              kit_benvenuto INTEGER DEFAULT 1,
              link_airbnb TEXT,
              link_ical TEXT
          )`,
      () => {
        // Dati di base del B&B (Seeding)
        const alloggiData = [
          { nome: 'Pretoria', link: 'https://www.airbnb.it/calendar/ical/1351449804460967040.ics?t=c5c9cc2fcd9d45828da2d7b558af5b46' },
          { nome: 'Massimo', link: 'https://www.airbnb.it/calendar/ical/1351425467263385688.ics?t=ef631863d1094c499ee86b22b011b270' },
          { nome: 'Cattedrale', link: 'https://www.airbnb.it/calendar/ical/1351363221212129968.ics?t=990ce98b3b4f4bcb8041853444263682' },
        ];

        // 1. Assicuriamoci che la stanza esista
        const stmtInsert = db.prepare(`INSERT OR IGNORE INTO ALLOGGIO (nome_alloggio) VALUES (?)`);
        // 2. Assicuriamoci che il link sia sempre aggiornato
        const stmtUpdate = db.prepare(`UPDATE ALLOGGIO SET link_ical = ? WHERE nome_alloggio = ?`);

        alloggiData.forEach((alloggio) => {
          stmtInsert.run(alloggio.nome);
          // Se il link non è vuoto, lo aggiorniamo
          if (alloggio.link !== '') {
            stmtUpdate.run(alloggio.link, alloggio.nome);
          }
        });

        stmtInsert.finalize();
        stmtUpdate.finalize();
      },
    );

    // Tabella SOGGIORNI
    // data_creazione_record: memorizza la data di creazione del record per risolvere un conflitto col cron job
    // stato_prenotazione: indica se una prenotazione fatta dal sito è già stata confermata o meno
    db.run(`CREATE TABLE IF NOT EXISTS SOGGIORNI (
              id_soggiorno INTEGER PRIMARY KEY AUTOINCREMENT,
              id_alloggio INTEGER,
              data_check_in TEXT NOT NULL,
              data_check_out TEXT NOT NULL,
              segnato_osservatorio INTEGER DEFAULT 0,
              stato_prenotazione TEXT,
              data_creazione_record DATETIME,
              sorgente TEXT DEFAULT 'airbnb',
              FOREIGN KEY(id_alloggio) REFERENCES ALLOGGIO(id_alloggio)
          )`);

    // Tabella CLIENTE (Dati Osservatorio Turistico)
    db.run(`CREATE TABLE IF NOT EXISTS CLIENTE (
              id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
              id_soggiorno INTEGER,
              sesso TEXT,
              cittadinanza TEXT,
              luogo_residenza TEXT,
              permanenza INTEGER,
              FOREIGN KEY(id_soggiorno) REFERENCES SOGGIORNI(id_soggiorno)
          )`);

    console.log('🚀 Tabelle del database create/verificate.');
  });
};
export const getDb = (): Database => {
  if (!db) {
    throw new Error(
      '⚠️ ERRORE CRITICO: Il database non è stato ancora inizializzato! Assicurati che initDb() sia stato eseguito prima di chiamare getDb().',
    );
  }
  return db;
};
