import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule], // RouterModule è fondamentale per far funzionare i routerLink!
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  constructor(private router: Router) {}

  eseguiLogout() {
    // 1. L'utente vuole uscire: strappiamo il token!
    localStorage.removeItem('token');
    
    // 2. Rimandiamo forzatamente l'utente alla schermata di accesso
    this.router.navigate(['/login']);
  }
}