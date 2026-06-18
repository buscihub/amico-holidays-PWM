import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AutenticazioneService } from '../../services/autenticazione.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule], // Fondamentali per far funzionare i form HTML!
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  // Queste variabili si legano direttamente alle caselle di testo nell'HTML
  emailHost: string = '';
  passwordHost: string = '';
  
  // Variabile per mostrare errori (es. "Password sbagliata")
  messaggioErrore: string = '';

  // Chiamiamo il "Fattorino" (AuthService) e il "Navigatore" (Router)
  constructor(
    private autenticazione: AutenticazioneService,
    private router: Router
  ) {}

  // Funzione che scatta quando si preme il tasto "Accedi"
  eseguiLogin() {
    this.autenticazione.login(this.emailHost, this.passwordHost).subscribe({
      next: (risposta: any) => {
        console.log('Login OK!', risposta);
        
        // Magia: Salviamo il Token JWT nel browser, così l'Host rimane loggato!
        localStorage.setItem('token', risposta.utente.token);
        
        alert('Accesso eseguito con successo!');
        
        // Cambiamo pagina indirizzando l'utente alla dashboard
        this.router.navigate(['/app/dashboard']); 
      },
      error: (errore) => {
        console.error('Errore Login:', errore);
        this.messaggioErrore = 'Email o password errati. Riprova.';
      }
    });
  }
}