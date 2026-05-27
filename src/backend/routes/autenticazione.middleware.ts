import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// DEVE essere la stessa chiave usata nel file autenticazione.service.ts
const CHIAVE_SEGRETA = "token_pwd"; 

// Siccome TypeScript è rigoroso, creiamo un'interfaccia personalizzata
// per dire che la nostra Request conterrà anche i dati dell'utente.
export interface CustomRequest extends Request {
    utente?: any;
}

export const verificaToken = (req: CustomRequest, res: Response, next: NextFunction): void => {
    // 1. Cerchiamo il token nell'header della richiesta HTTP
    // Lo standard web prevede che si trovi in un header chiamato "Authorization"
    const authHeader = req.headers.authorization;

    // Se l'header non c'è, o non inizia con "Bearer " (standard per i JWT), blocchiamo l'accesso
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Accesso negato. Autenticazione richiesta.' });
        return; 
    }

    // 2. Estraiamo il token puro (es: "Bearer eyJhbGciOiJIUzI1Ni...")
    const token = authHeader.split(' ')[1];

    try {
        // 3. Verifica del token. Se è manomesso o scaduto, questa riga lancia un Errore!
        const decoded = jwt.verify(token, CHIAVE_SEGRETA);

        // 4. Salviamo i dati decodificati (id, email, ruolo) dentro la richiesta.
        // Così i Controller che verranno DOPO sapranno esattamente quale host sta facendo l'azione.
        req.utente = decoded;

        // 5. Tutto regolare, fai passare l'Host!
        next();
        
    } catch (error) {
        // Se cadiamo qui, il token è finto, scaduto (passate le 8 ore) o corrotto
        res.status(403).json({ error: 'Timeout autenticazione, effettuare nuovamente il login.' });
    }
};