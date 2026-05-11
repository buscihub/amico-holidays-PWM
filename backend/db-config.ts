const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Percorso del file database
const dbPath = path.resolve(__dirname, "database.sqlite");

const db = new sqlite3.Database(dbPath, (err: { message: any; }) => {
    if (err) console.error("Errore connessione DB:", err.message);
    else console.log("Connesso a SQLite per Amico's Holidays");
});

db.serialize(() => {
    // Tabella STAFF [cite: 48, 88]
    db.run(`CREATE TABLE IF NOT EXISTS STAFF (
        ID_Staff INTEGER PRIMARY KEY AUTOINCREMENT,
        Email TEXT UNIQUE NOT NULL,
        Password_Hash TEXT NOT NULL,
        Ruolo TEXT CHECK(Ruolo IN ('host', 'cohost')) NOT NULL
    )`);

    // Tabella ALLOGGIO [cite: 53, 88]
    db.run(`CREATE TABLE IF NOT EXISTS ALLOGGIO (
        ID_Alloggio INTEGER PRIMARY KEY AUTOINCREMENT,
        Nome TEXT CHECK(Nome IN ('massimo', 'cattedrale', 'pretoria')) NOT NULL,
        Stato_Pulizia BOOLEAN DEFAULT 1,
        Kit_Benvenuto BOOLEAN DEFAULT 1,
        Airbnb_URL_ID TEXT,
        iCal_URL TEXT
    )`);

    // Tabella SOGGIORNI_SINCRONIZZATI [cite: 68, 88]
    db.run(`CREATE TABLE IF NOT EXISTS SOGGIORNI_SINCRONIZZATI (
        ID_Soggiorno INTEGER PRIMARY KEY AUTOINCREMENT,
        ID_Alloggio INTEGER,
        Data_CheckIn DATE,
        Data_CheckOut DATE,
        Stato_Osservatorio_Turistico_Check_In BOOLEAN DEFAULT 0,
        Stato_Osservatorio_Turistico_Check_Out BOOLEAN DEFAULT 0,
        Sorgente TEXT,
        FOREIGN KEY(ID_Alloggio) REFERENCES ALLOGGIO(ID_Alloggio)
    )`);

    // Tabella CLIENTE [cite: 60, 88]
    db.run(`CREATE TABLE IF NOT EXISTS CLIENTE (
        ID_Cliente INTEGER PRIMARY KEY AUTOINCREMENT,
        ID_Alloggio INTEGER,
        ID_Soggiorno INTEGER,
        Sesso TEXT CHECK(Sesso IN ('Uomo', 'Donna', 'Non specificato')),
        Cittadinanza TEXT,
        Luogo_Residenza TEXT,
        Permanenza INTEGER,
        FOREIGN KEY(ID_Alloggio) REFERENCES ALLOGGIO(ID_Alloggio),
        FOREIGN KEY(ID_Soggiorno) REFERENCES SOGGIORNI_SINCRONIZZATI(ID_Soggiorno)
    )`);
});

module.exports = db;