import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { initDb, getDb } from './backend/db-config';
import express, { Request, Response } from 'express';
import { join } from 'node:path';
import { RunResult } from 'sqlite3';
import { config } from 'node:process';
import { error } from 'node:console';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());
const angularApp = new AngularNodeAppEngine();

// AGGIUNTO ": any" QUI per risolvere l'errore TS(7030)
app.post('/api/registra-cliente', (req: Request, res: Response): any => {
  const db = getDb();

  const { id_alloggio, data_check_in, data_check_out, sesso, cittadinanza, luogo_residenza } =
    req.body;

  if (!id_alloggio || !data_check_in || !data_check_out) {
    return res.status(400).json({ error: 'Dati mancanti. Impossibile procedere.' });
  }

  const fine = new Date(data_check_out);
  const inizio = new Date(data_check_in);

  if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) {
    return res.status(400).json({ error: 'Formato data non valido.' });
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  if (inizio < oggi) {
    return res.status(400).json({ error: 'Non puoi effettuare un check-in nel passato!' });
  }

  const diffInMs = fine.getTime() - inizio.getTime();
  const permanenza = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

  if (permanenza <= 0) {
    return res
      .status(400)
      .json({ error: 'La data di check-out deve essere successiva al check-in.' });
  }

  if (permanenza < 2) {
    return res.status(400).json({ error: 'Bisogna prenotare almeno per 2 notti' });
  }

  const sqlSoggiorno = `INSERT INTO SOGGIORNI (id_alloggio, data_check_in, data_check_out, sorgente) VALUES (?, ?, ?, 'manuale')`;

  // AGGIUNTO ": any" ANCHE QUI per il primo db.run
  db.run(
    sqlSoggiorno,
    [id_alloggio, data_check_in, data_check_out],
    function (this: RunResult, err: Error | null): any {
      if (err) {
        return res.status(500).json({ error: 'Errore salvataggio soggiorno: ' + err.message });
      }

      const nuovoIdSoggiorno = this.lastID;
      const sqlCliente = `INSERT INTO CLIENTE (id_soggiorno, sesso, cittadinanza, luogo_residenza, permanenza) VALUES (?, ?, ?, ?, ?)`;

      // AGGIUNTO ": any" ANCHE QUI per il secondo db.run
      db.run(
        sqlCliente,
        [nuovoIdSoggiorno, sesso, cittadinanza, luogo_residenza, permanenza],
        (errCliente: Error | null): any => {
          if (errCliente) {
            return res
              .status(500)
              .json({ error: 'Errore salvataggio cliente: ' + errCliente.message });
          }

          return res.status(200).json({
            message: 'Registrazione completata con successo!',
            id_soggiorno: nuovoIdSoggiorno,
          });
        },
      ); // 1. CHIUSURA DEL SECONDO DB.RUN (Quello del Cliente)
    },
  ); // 2. CHIUSURA DEL PRIMO DB.RUN (Questo mancava e spaccava la sintassi!)
}); // 3. CHIUSURA DELLA ROTTA APP.POST

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  initDb();
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
