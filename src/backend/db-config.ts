import sqlite3 from 'sqlite3';
import path from 'path';

let db: sqlite3.Database;

export const initDb = () => { 

// Definiamo il percorso del file database (sarà creato nella root del progetto)
const dbPath = path.resolve(process.cwd(), 'amicos_holidays.db');

db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ Errore durante la connessione al DB:', err.message);
  else console.log('✅ Database SQLite connesso con successo!');
});

db.serialize(() => {
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
}

export const getDb = () => db;
