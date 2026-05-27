import { Request, Response } from 'express';
import * as AlloggiService from '../services/alloggi.service';

export const getAlloggi = async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await AlloggiService.recuperaTuttiAlloggi();

    // Mappatura e formattazione dei dati trasformando 0/1 in booleani
    const alloggi = rows.map((row) => ({
      id_alloggio: row.id_alloggio,
      nome: row.nome_alloggio,
      stato_pulizia: Boolean(row.stato_pulizia),
      kit_benvenuto: Boolean(row.kit_benvenuto),
      airbnb_url_id: row.link_airbnb || null,
      ical_url: row.link_ical || null,
    }));

    res.status(200).json({
      success: true,
      count: alloggi.length,
      data: alloggi
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante il recupero degli alloggi.' });
  }
};

export const putClean = async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params['id'] || req.body.id_alloggio || req.body.id;
    const idAlloggio = Number(idParam);

    if (!idAlloggio || Number.isNaN(idAlloggio)) {
      res.status(400).json({ error: 'ID alloggio mancante o non valido.' });
      return;
    }

    // Chiamata al servizio
    const alloggioAggiornato = await AlloggiService.aggiornaStatoPulizia(idAlloggio);

    if (!alloggioAggiornato) {
      res.status(404).json({ error: 'Alloggio non trovato.' });
      return;
    }

    // Risposta strutturata e formattata per il frontend
    res.status(200).json({
      success: true,
      message: 'Stato pulizia invertito con successo.',
      data: {
        id_alloggio: alloggioAggiornato.id_alloggio,
        nome: alloggioAggiornato.nome_alloggio,
        stato_pulizia: Boolean(alloggioAggiornato.stato_pulizia),
        kit_benvenuto: Boolean(alloggioAggiornato.kit_benvenuto),
        airbnb_url_id: alloggioAggiornato.link_airbnb || null,
        ical_url: alloggioAggiornato.link_ical || null
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante l\'aggiornamento dello stato pulizia.' });
  }
};
    
export const putKit = async(req: Request, res: Response):Promise<void> =>{
  
  try{
  
    const idParam = req.params['id'] || req.body.id_alloggio || req.body.id;
    const idAlloggio = Number(idParam);
  
  
    if (!idAlloggio || Number.isNaN(idAlloggio)) {
      
      res.status(400).json({ error: 'ID alloggio mancante o non valido.' });
      return;
    }
    const KitAggiornato = await AlloggiService.aggiornaKitBenvenuto(idAlloggio);

    if(!KitAggiornato){
      
      res.status(404).json({ error: 'Alloggio non trovato.' });
      return;
    
    }

    res.status(200).json({

      success: true,
      message: "kit_benvenuto aggiornato con successo.",

      data:{
        id_alloggio: KitAggiornato.id_alloggio,
        nome: KitAggiornato.nome_alloggio,
        stato_pulizia: Boolean(KitAggiornato.stato_pulizia),
        kit_benvenuto: Boolean(KitAggiornato.kit_benvenuto),
        airbnb_url_id: KitAggiornato.link_airbnb || null,
        ical_url: KitAggiornato.link_ical || null
      },
    });
  }catch(error: any) {
    res.status(500).json({ error: error.message || 'Errore durante l\'aggiornamento del kit benvenuto.' });
  }
}