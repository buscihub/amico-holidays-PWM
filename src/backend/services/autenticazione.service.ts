import bcrypt from 'bcrypt';
import { dbGet } from '../utils/db.util';

// INTERFACCIA: Definisce la struttura della riga del DB
export interface IUtenteStaff {
  id_staff: number;
  email: string;
  ruolo: string;
  password_hash: string;
}

// FUNZIONE PRINCIPALE DEL SERVICE
export const verificaCredenziali = async (email: string, password_in_chiaro: string) => {
  
  // 1. Prepariamo la query SQL
  const sql = `SELECT * FROM STAFF WHERE email = ?`;
  
  // 2. Chiamiamo il DB. Il <IUtenteStaff> dice a TS che il risultato avrà quella forma.
  const staff = await dbGet<IUtenteStaff>(sql, [email]);

  // 3. Se il DB non trova l'email, "staff" sarà vuoto. Lanciamo un Errore.
  // Questo errore fermerà l'esecuzione qui e verrà "catturato" dal Controller più tardi.
  if (!staff) {
    throw new Error('Utente non trovato.');
  }

  // 4. Se l'utente esiste, confrontiamo la password inviata col l'hash salvato nel DB.
  // Anche bcrypt.compare ci mette qualche millisecondo, quindi usiamo "await".
  const pwdValida = await bcrypt.compare(password_in_chiaro, staff.password_hash);
  
  if (!pwdValida) {
    throw new Error('Password errata.');
  }

  // 5. Se arriviamo qui, il login è un successo! 
  // Restituiamo un oggetto pulito (NON restituiamo mai l'hash della password al frontend!)
  return {
    id: staff.id_staff,
    email: staff.email,
    ruolo: staff.ruolo
  };
};