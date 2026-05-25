import { Request, Response } from 'express';
import { getDb } from '../db-config'; // Importa getDb da qui
import bcrypt from 'bcrypt'; // Servirà per verificare la password

export const loginHost = (req: Request, res: Response): any => {
    const db = getDb();

    //recuperiamo email e password dal database
    const {email, password} = req.body;

    //verifichiamo che email e password siano state fornite
    if(!email || !password){
        return res.status(400).json({error: 'Email e password sono obbligatorie.'});
    }

    //cerchiamo l'host nel database tramite l'email
    const sql = `SELECT * FROM STAFF WHERE email = ?`;
    db.get(sql, [email], async(err, staff: any) => {
        if(err){
            return res.status(500).json({error: 'Errore durante l\'accesso al database:' + err.message});
        }

        //controlliamo se l'utente esiste 
        if(!staff){
            return res.status(401).json({error: 'Utente non trovato.'});
        }

        try{
            //verifichiamo la password confrontando l'hash memorizzato nel db con la password fornita
            const pwdValida = await bcrypt.compare(password, staff.password_hash);
            if(!pwdValida){
                return res.status(401).json({error: 'Password errata.'});
            }
            return res.status(200).json({
                message: 'Login effettuato.',
                utente: {
                    id: staff.id_staff,
                    email: staff.email,
                    ruolo: staff.ruolo
                }
            });
        }
        catch(error: any){
            return res.status(500).json({error: `Errore durante la verifica della password: ${error.message}`});
        }
    });
}

export const logoutHost = (req: Request, res: Response): any => {
    // Se in futuro userai i cookie per salvare un Token JWT, qui scriverai:
    // res.clearCookie('token');

    // Per ora, restituiamo semplicemente un messaggio di successo.
    // Sarà compito del Frontend (React/Vue) cancellare i dati dell'utente dal LocalStorage.
    return res.status(200).json({ 
        message: 'Logout effettuato con successo. A presto!' 
    });
};