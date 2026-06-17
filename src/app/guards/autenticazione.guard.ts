import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const autenticazioneGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Controlliamo se c'è un token salvato nel localStorage (il "braccialetto" VIP)
  const token = localStorage.getItem('token');

  if (token) {
    return true; // Token presente: la porta si apre, lascia passare l'utente
  } else {
    // Niente token: il buttafuori interviene! Rimanda forzatamente al login
    router.navigate(['/login']);
    return false;
  }
};