// src/models/types.ts

/**
 * Utenti abilitati all'accesso della Dashboard (Host e CoHost)
 */
export interface Staff {
  id_staff?: number; 
  email: string;
  password_hash?: string; // Opzionale perché NON lo inviamo mai al frontend
  ruolo: 'host' | 'cohost'; 
  token?: string; // Utile da avere qui, dato che il login restituisce il JWT!
}

/**
 * Le tre unità immobiliari del B&B
 */
export interface Alloggio {
  id_alloggio?: number;
  nome_alloggio: 'Pretoria' | 'Massimo' | 'Cattedrale' | string;
  stato_pulizia: boolean; // Il Controller li mappa da 0/1 a boolean
  kit_benvenuto: boolean; // Il Controller li mappa da 0/1 a boolean
  link_airbnb?: string | null; 
  link_ical?: string | null; 
}

/**
 * I periodi di occupazione delle stanze
 */
export interface Soggiorno {
  id_soggiorno?: number;
  id_alloggio: number; 
  data_check_in: string; // Formato ISO ('YYYY-MM-DD')
  data_check_out: string; // Formato ISO ('YYYY-MM-DD')
  segnato_osservatorio: number | boolean; // Backend usa 0/1, il frontend può trattarlo come boolean
  stato_prenotazione?: 'pending' | 'confirmed'; 
  data_creazione_record?: string;
  sorgente: 'PrenotazioneAirbnb' | 'PrenotazioneSito' | 'BloccatoAirbnb' | 'BloccatoSito'; 
}

/**
 * I dati statistici raccolti per l'Osservatorio Turistico 
 * (Anonimizzati senza nome e cognome come da DB)
 */
export interface Cliente {
  id_cliente?: number;
  id_soggiorno: number; 
  sesso: 'M' | 'F' | string; // Allineato col frontend
  cittadinanza: string;
  luogo_residenza: string;
  permanenza: number; 
}

/**
 * Interfaccia extra utile per i dati della Dashboard (che avevamo nel Service!)
 */
export interface DashboardStats {
  camereOccupate: number;
  inArrivo: number;
  inPartenza: number;
  checkOutDaFare: number;
}

// Enum per mappare in modo pulito i tipi di transazione
export enum TipoTransazione {
  ENTRATA = 'Entrata',
  USCITA = 'Uscita'
}

// Enum per la provenienza del dato
export enum SorgenteTransazione {
  AIRBNB_CSV = 'Import_Airbnb',
  MANUALE = 'Manuale'
}

// L'interfaccia principale della Transazione che useremo in tutto il backend
export interface Transazione {
  id_transazione?: number; // Opzionale perché lo genera SQLite (Autoincrement)
  id_alloggio: number | null; // Nullable perché alcune spese potrebbero essere generali per il B&B
  data_transazione: string; // Formato YYYY-MM-DD
  tipo: TipoTransazione;
  categoria: string; // Es. 'Prenotazione', 'Ritenuta Fiscale', 'Pulizie', 'Bollette'
  importo: number;
  descrizione: string; // Es. Nome ospite e codice conferma, o nota spesa
  sorgente: SorgenteTransazione;
  codice_conferma_airbnb?: string; // Utile per non importare due volte lo stesso soggiorno
}