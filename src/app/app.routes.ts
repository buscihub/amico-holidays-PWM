import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';

export const routes: Routes = [
  // Quando andiamo su /login, mostra la Cassiera
  { path: 'login', component: LoginComponent },
  
  // Se l'indirizzo è vuoto, rimanda subito al login
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];