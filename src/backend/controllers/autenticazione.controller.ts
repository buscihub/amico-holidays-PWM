import { Request, Response } from 'express';
import * as AutenticazioneService from '../services/autenticazione.service';

export const loginHost = async (req: Request, res: Response): Promise<void> => {
  // Il "try/catch" è fondamentale con async/await. 
  // Se qualcosa va storto nel blocco "try", si salta subito al blocco "catch".
  try {
    // 1. IL CAMERIERE PRENDE L'ORDINE
    // Estraiamo email e password dal "corpo" (body) della richiesta arrivata da internet.
    const { email, password } = req.body;

    // 2. CONTROLLO DI BASE
    if (!email || !password) {
       // Se mancano i dati, fermiamo tutto (return) e mandiamo errore 400 (Bad Request)
       res.status(400).json({ error: 'Email e password sono obbligatorie.' });
       return;
    }

    // 3. IL CAMERIERE CHIAMA LO CHEF
    // Passiamo i dati puliti al Service. Usiamo "await" per aspettare che finisca i controlli.
    const datiUtente = await AutenticazioneService.verificaCredenziali(email, password);

    // 4. IL CAMERIERE SERVE IL PIATTO
    // Se lo Chef non ha lanciato errori, il login è ok. Mandiamo stato 200 (OK).
    res.status(200).json({
      message: 'Login effettuato.',
      utente: datiUtente
    });

  } catch (error: any) {
    // 5. GESTIONE DEGLI ERRORI
    // Se lo Chef nel Service ha fatto "throw new Error()", cadiamo in questo blocco.
    
    // Decidiamo il codice HTTP. Se l'errore è "Utente non trovato" o "Password errata", 
    // lo stato è 401 (Unauthorized). Altrimenti è un errore del server 500.
    const statusCode = error.message.includes('Utente non trovato') || error.message.includes('Password errata') ? 401 : 500;
    
    res.status(statusCode).json({ error: error.message });
  }
};

export const logoutHost = async (req: Request, res: Response): Promise<void> => {
  try {
    // Il logout di base non ha bisogno del database, quindi il Cameriere fa tutto da solo.
    res.status(200).json({ 
      message: 'Logout effettuato con successo. A presto!' 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};