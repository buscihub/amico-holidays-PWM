import sqlite3, { Database } from 'sqlite3';
import path from 'path';

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
          )`);

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
        // Popoliamo subito le tre stanze se non esistono
        const stmt = db.prepare(`INSERT OR IGNORE INTO ALLOGGIO (nome_alloggio) VALUES (?)`);
        ['Pretoria', 'Massimo', 'Cattedrale'].forEach((nome) => stmt.run(nome));
        stmt.finalize();
      },
    );

    // Tabella SOGGIORNI_SINCRONIZZATI
    db.run(`CREATE TABLE IF NOT EXISTS SOGGIORNI (
              id_soggiorno INTEGER PRIMARY KEY AUTOINCREMENT,
              id_alloggio INTEGER,
              data_check_in TEXT NOT NULL,
              data_check_out TEXT NOT NULL,
              stato_osservatorio_in INTEGER DEFAULT 0,
              stato_osservatorio_out INTEGER DEFAULT 0,
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
  if(!db){
    throw new Error('⚠️ ERRORE CRITICO: Il database non è stato ancora inizializzato! Assicurati che initDb() sia stato eseguito prima di chiamare getDb().')
  }
  return db
};
