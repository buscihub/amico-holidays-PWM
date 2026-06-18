import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AlloggiComponent } from './components/alloggi/alloggi.component';
import { OsservatorioComponent } from './components/osservatorio/osservatorio.component';

export const routes: Routes = [
  // Quando andiamo su /login, mostra la Cassiera
  { path: 'login', component: LoginComponent },
  
  // Se l'indirizzo è vuoto, rimanda subito al login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {path : 'alloggi', component: AlloggiComponent},
  {path : 'osservatorio', component: OsservatorioComponent}

];
