// src/backend/controllers/contabilita.controller.ts
import { Request, Response } from 'express';
import * as ContabilitaService from '../services/contabilità.service';

/**
 * 1. ENDPOINT: CARICAMENTO REPORT CSV AIRBNB
 * Riceve il file da multer e lo passa al service per l'elaborazione protetta da duplicati
 */
export const postUploadReportAirbnb = async (req: Request, res: Response): Promise<void> => {
    const requestConFile = req as any
        try {
    // Verifichiamo se multer ha effettivamente intercettato e salvato il file
    if (!requestConFile.file) {
      res.status(400).json({ error: 'Nessun file CSV caricato o formato non valido.' });
      return;
    }

    // Passiamo il percorso fisico del file temporaneo al service
    const risultato = await ContabilitaService.elaboraCSV(requestConFile.file.path);

    res.status(200).json({
      success: true,
      message: 'File di Airbnb elaborato con successo.',
      data: {
        transazioni_inserite: risultato.inserite,
        duplicati_saltati: risultato.saltate
      }
    });
  } catch (error: any) {
    // Se il parsing crasha a metà, ripuliamo il file temporaneo per non lasciare spazzatura sul server
    if (requestConFile.file && requestConFile.file.path) {
      try { require('fs').unlinkSync(requestConFile.file.path); } catch (e) {}
    }
    res.status(500).json({ error: error.message || 'Errore durante l\'elaborazione del report Airbnb.' });
  }
};

/**
 * 2. ENDPOINT: INSERIMENTO MANUALE SPESE/RICAVI EXTRA
 * Riceve i dati dal form dell'Host su Angular e inserisce un movimento offline
 */
export const postTransazioneManuale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id_alloggio, data_transazione, tipo, categoria, importo, descrizione } = req.body;

    // Validazione minima dei campi obbligatori
    if (!data_transazione || !tipo || !categoria || importo === undefined) {
      res.status(400).json({ error: 'Dati obbligatori mancanti (data, tipo, categoria o importo).' });
      return;
    }

    const risultato = await ContabilitaService.inserisciTransazioneManuale({
      id_alloggio: id_alloggio ? Number(id_alloggio) : null,
      data_transazione,
      tipo,
      categoria,
      importo: Number(importo),
      descrizione: descrizione || ''
    });

    res.status(201).json({
      success: true,
      message: 'Movimento contabile registrato con successo.',
      data: { id_transazione: risultato.id_inserito }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante l\'inserimento manuale.' });
  }
};

/**
 * 3. ENDPOINT: DATI COMPLETI DASHBOARD (RENDIMENTO, MATRICE, PERCENTUALI)
 * Fornisce ad Angular in un'unica chiamata tutti i blocchi dati necessari a popolare la dashboard e i grafici
 */
export const getDatiDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    // Chiamiamo in parallelo le tre funzioni di aggregazione per essere super veloci
    const [performance, matricePivot, impattoCategorie] = await Promise.all([
      ContabilitaService.recuperaPerformanceAlloggi(),
      ContabilitaService.recuperaMatriceCostiIncrociati(),
      ContabilitaService.recuperaImpattoCategorieCosti()
    ]);

    res.status(200).json({
      success: true,
      data: {
        performance_alloggi: performance,
        matrice_costi: matricePivot,
        incidenza_spese: impattoCategorie
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante il recupero dei dati dashboard.' });
  }
};

/**
 * 4. ENDPOINT: RICERCA E FILTRI INCROCIATI DINAMICI
 * Gestisce i filtri avanzati incrociando l'id_alloggio e/o un array di categorie
 */
export const getTransazioniFiltrate = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAlloggioParam = req.query['id_alloggio'];
    const idAlloggio = idAlloggioParam !== undefined ? (idAlloggioParam === 'null' ? null : Number(idAlloggioParam)) : undefined;
    
    // Su Express le query string con array arrivano come stringhe o array a seconda di come le spara Angular.
    // Gestiamo entrambi i casi (es: "Tasse,Colazione" o un array reale)
    const categorieParam = req.query['categorie'];
    let categorie: string[] | undefined = undefined;
    
    if (typeof categorieParam === 'string') {
      categorie = categorieParam.split(',');
    } else if (Array.isArray(categorieParam)) {
      categorie = categorieParam as string[];
    }

    const movimenti = await ContabilitaService.filtraTransazioniIncrociate(idAlloggio, categorie);

    res.status(200).json({
      success: true,
      count: movimenti.length,
      data: movimenti
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante il filtraggio delle transazioni.' });
  }
};

/**
 * 5. ENDPOINT: STORICO GENERALE MOVIMENTI
 * Sputa fuori l'elenco cronologico completo di tutte le righe a database
 */
export const getTuttiIMovimenti = async (req: Request, res: Response): Promise<void> => {
  try {
    const storico = await ContabilitaService.recuperaTuttiIMovimenti();

    res.status(200).json({
      success: true,
      count: storico.length,
      data: storico
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Errore durante il recupero dello storico movimenti.' });
  }
};