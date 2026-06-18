import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AutenticazioneService {
  // L'indirizzo del nostro backend che abbiamo completato!
  private apiUrl = 'http://localhost:4000/api/auth/login';

  // Chiamiamo in causa il "Postino" di Angular (HttpClient)
  constructor(private http: HttpClient) { }

  // La funzione che useremo dalla pagina grafica
  login(emailHost: string, passwordHost: string) {
    const credenziali = {
      email: emailHost,
      password: passwordHost
    };
    
    // Spediamo la richiesta POST al server
    return this.http.post(this.apiUrl, credenziali);
  }
}