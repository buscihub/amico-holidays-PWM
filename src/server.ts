import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import { initDb } from './backend/db-config'; // rimosso getDb, non serve più qui
import express from 'express';
import { join } from 'node:path';

// IMPORTIAMO LE NOSTRE ROTTE
import { prenotazioniRoutes } from './backend/routes/prenotazioni.routes';
import { alloggiRoutes } from './backend/routes/alloggi.routes';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());
const angularApp = new AngularNodeAppEngine();

// ==========================================
// REGISTRAZIONE API
// Tutte le rotte di "prenotazioniRoutes" avranno "/api" davanti.
// Quindi intercetterà: POST /api/registra-cliente
// ==========================================
app.use('/api', prenotazioniRoutes);
app.use('/api', alloggiRoutes);

// Gestione Angular SSR e file statici
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

// Avvio Server e Database
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  
  initDb(); // Avvia il database in modo lazy
  
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);