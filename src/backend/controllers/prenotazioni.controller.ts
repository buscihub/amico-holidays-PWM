import { Request, Response } from 'express';
import * as PrenotazioniService from '../services/prenotazioni.service';
import { eseguiSincronizzazioneCore } from '../services/sincronizzazione.service';

export const aggiungiSoggiorno = async (req: Request<{}, {}, PrenotazioniService.INuovoSoggiorno>, res: Response): Promise<void> => {
  try {
    const { id_alloggio, data_check_in, data_check_out } = req.body;

    if (!id_alloggio || !data_check_in || !data_check_out) {
      res.status(400).json({ error: 'Dati obbligatori mancanti. Impossibile procedere.' });
      return;
    }

    const inizio = new Date(data_check_in);
    const fine = new Date(data_check_out);

    if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
      res.status(400).json({ error: 'Formato data non valido.' });
      return;
    }

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    if (inizio < oggi) {
      res.status(400).json({ error: 'Non puoi effettuare un check-in nel passato!' });
      return;
    }

    const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));
    if (permanenza <= 0 || permanenza < 2) {
      res.status(400).json({ error: 'Filtro di business: Bisogna prenotare almeno per 2 notti.' });
      return;
    }

    const nuovoIdSoggiorno = await PrenotazioniService.creaSoggiorno(req.body, permanenza);

    res.status(200).json({
      success: true,
      message: 'Pre-prenotazione registrata! In attesa di pagamento su Airbnb.',
      id_soggiorno: nuovoIdSoggiorno,
      stato_prenotazione: 'pending'
    });
  } catch (error: any) {
    const statusCode = error.message.includes('Overbooking') ? 409 : 500;
    res.status(statusCode).json({ error: error.message });
  }
};

export const modificaSoggiorno = async (req: Request<{ id: string }, {}, PrenotazioniService.IAggiornaSoggiornoBody>, res: Response): Promise<void> => {
  try {
    const { data_check_in, data_check_out } = req.body;

    if (!data_check_in || !data_check_out) {
      res.status(400).json({ error: 'Date obbligatorie per la modifica.' });
      return;
    }

    const inizio = new Date(data_check_in);
    const fine = new Date(data_check_out);
    const permanenza = Math.ceil((fine.getTime() - inizio.getTime()) / (1000 * 60 * 60 * 24));

    if (permanenza <= 0 || permanenza < 2) {
      res.status(400).json({ error: 'Date non valide o inferiori al minimo di 2 notti.' });
      return;
    }

    const nuovaPermanenza = await PrenotazioniService.aggiornaSoggiorno(Number(req.params.id), req.body, permanenza);

    res.status(200).json({
      message: 'Prenotazione modificata correttamente!',
      nuova_permanenza: nuovaPermanenza,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rimuoviSoggiorno = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    await PrenotazioniService.eliminaSoggiorno(req.params.id);
    res.status(200).json({ message: 'Prenotazione rimossa con successo dal sistema.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bloccaDate = async (req: Request<{}, {}, PrenotazioniService.IBloccoDateBody>, res: Response): Promise<void> => {
  try {
    const { id_alloggio, data_check_in, data_check_out } = req.body;
    const nuovoId = await PrenotazioniService.inserisciBloccoDate({ id_alloggio, data_check_in, data_check_out });
    
    res.status(201).json({ message: 'Alloggio bloccato correttamente.', id_blocco: nuovoId });
  } catch (error: any) {
    const status = error.message.includes('occupato') ? 409 : 500;
    res.status(status).json({ error: error.message });
  }
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const oggi = new Date().toISOString().split('T')[0];
    const stats = await PrenotazioniService.calcolaStatistiche(oggi);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSoggiorniAttivi = async (req: Request, res: Response): Promise<void> => {
  try {
    const oggi = new Date().toISOString().split('T')[0];
    const soggiorni = await PrenotazioniService.recuperaSoggiorniAttivi(oggi);
    res.json(soggiorni);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sincronizzaManuale = async (req: Request, res: Response): Promise<void> => {
  try {
    await eseguiSincronizzazioneCore();
    res.status(200).json({ success: true, message: 'Sincronizzazione calendari completata con successo!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore interno durante la sincronizzazione.' });
  }
};

export const azionaCheckIn = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    await PrenotazioniService.segnaCheckInDigitale(req.params.id);
    res.json({ message: 'Check-in registrato internamente nel PMS.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const storicoPrenotazioni = async (req: Request<{}, {}, {}, { id_alloggio?: string }>, res: Response): Promise<void> => {
  try {
    const storico = await PrenotazioniService.cercaStorico(req.query.id_alloggio);
    res.json(storico);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};