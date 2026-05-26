import { Request, Response } from 'express';
import * as OsservatorioService from '../services/osservatorio.service';

export const getOspitiOsservatorio = async (req: Request, res: Response): Promise<void> => {
  try {
    // Estraiamo i filtri dall'URL. Di default lo stato è 0 (Da Segnare)
    const stato = req.query['stato'] ? Number(req.query['stato']) : 0;
    let mese = req.query['mese'] as string | undefined; // Es: '05'
    const anno = req.query['anno'] as string | undefined; // Es: '2026'

    if (mese && mese.length === 1) {
      mese = '0' + mese;
    }

    const dati = await OsservatorioService.recuperaOspitiFiltrati(stato, mese, anno);
    res.status(200).json(dati);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante il recupero dei dati.' });
  }
};

export const confermaSelezionati = async (
  req: Request<{}, {}, { ids: number[] }>,
  res: Response,
): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Nessun ID soggiorno selezionato.' });
      return;
    }

    const ospitiAggiornati = await OsservatorioService.selezionati(ids);

    res.status(200).json({
      message: "Ospiti inviati all'osservatorio con successo!",
      ospiti_elaborati: ospitiAggiornati,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
