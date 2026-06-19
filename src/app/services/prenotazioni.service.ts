import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PrenotazioniService {
  private apiUrl = 'http://localhost:4000/api/prenotazioni';

  constructor(private http: HttpClient) { }

  getDashboardStats(): Observable<any> {
    // Recuperiamo il token dal localStorage
    const token = localStorage.getItem('token');
    
    // Creiamo gli header con il token di autorizzazione (lo standard "Bearer")
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get(`${this.apiUrl}/dashboard/stats`, { headers });
  }
}