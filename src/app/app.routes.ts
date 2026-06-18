import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { LayoutComponent } from './components/layout/layout.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AlloggiComponent } from './components/alloggi/alloggi.component';
import { OsservatorioComponent } from './components/osservatorio/osservatorio.component';
import { AutenticazioneGuard } from './guards/autenticazione.guard';

export const routes: Routes = [
  // Rotta pubblica per il login
  { path: 'login', component: LoginComponent },
  
  // Rotta "Contenitore" per tutte le pagine private
  { 
    path: 'app', // Le URL protette inizieranno con /app (es. /app/dashboard)
    component: LayoutComponent,
    canActivate: [AutenticazioneGuard], // Il buttafuori protegge il contenitore e tutti i suoi figli
    children: [
      { path: 'dashboard', component: DashboardComponent },
      // Se l'utente va su /app, lo rimandiamo di default alla dashboard
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  // Se l'indirizzo è vuoto, rimanda subito al login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {path : 'alloggi', component: AlloggiComponent},
  {path : 'osservatorio', component: OsservatorioComponent}

];
