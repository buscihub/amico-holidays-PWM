// src/models/types.ts

/**
 * Utenti abilitati all'accesso della Dashboard (Host e CoHost)
 */
export interface Staff {
  id_staff?: number; // Opzionale perché quando crei un utente non hai ancora l'ID dal DB
  nome: string;
  cognome: string;
  email: string;
  password_hash: string; // Mai salvare le password in chiaro!
  ruolo: 'host' | 'cohost'; // TypeScript impedirà di inserire ruoli non validi
}

/**
 * Le tre unità immobiliari: Casa Pretoria, Stanza Massimo, Stanza Cattedrale
 */
export interface Alloggio {
  id_alloggio?: number;
  nome_alloggio: 'Pretoria' | 'Massimo' | 'Cattedrale';
  stato_pulizia: boolean; // true = pulito, false = da pulire
  kit_benvenuto: boolean; // true = presente, false = da rimpiazzare
  link_airbnb?: string; // Opzionale, serve per il redirect
  link_ical?: string;   // Opzionale, serve per la sincronizzazione del backend
}

/**
 * I periodi di occupazione delle stanze, importati da Airbnb o generati
 */
export interface Soggiorno {
  id_soggiorno?: number;
  id_alloggio: number; // Foreign Key verso Alloggio
  data_check_in: string; // Formato ISO ('YYYY-MM-DD')
  data_check_out: string; // Formato ISO ('YYYY-MM-DD')
  stato_osservatorio_check_in: boolean;  // Per la burocrazia (0/1 nel DB, boolean in TS)
  stato_osservatorio_check_out: boolean; // Per la burocrazia
  sorgente: 'airbnb' | 'manuale'; // Da dove arriva la prenotazione
}

/**
 * I dati anagrafici raccolti per l'Osservatorio Turistico (Comune di Palermo)
 */
export interface Cliente {
  id_cliente?: number;
  id_soggiorno: number; // Foreign Key verso Soggiorno (per collegare l'anagrafica alle date)
  nome: string;
  cognome: string;
  sesso: 'Uomo' | 'Donna' | 'Non specificato';
  cittadinanza: string;
  luogo_residenza: string;
  permanenza: number; // Calcolato in automatico (differenza notti)
}