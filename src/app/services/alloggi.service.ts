import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AlloggioFrontend {

  id_alloggio: number;
  nome: string;
  stato_pulizia: boolean;
  kit_benvenuto: boolean;
  airbnb_url_id: string | null;
  ical_url: string | null;

}

export interface ListaAlloggiResponse {

  success: boolean;
  count: number;
  data: AlloggioFrontend[];

}

export interface AlloggioResponse {
  success: boolean;
  message: string;
  data: AlloggioFrontend;

}

@Injectable({

  providedIn: 'root'

})

export class AlloggiService {

  private apiUrl = 'http://localhost:4000/api/alloggi';

  constructor(private http: HttpClient) {}

  getAlloggi(): Observable<ListaAlloggiResponse> {

    return this.http.get<ListaAlloggiResponse>(this.apiUrl, {

      headers: this.creaHeadersAutenticati()

    });
  }

  cambiaStatoPulizia(idAlloggio: number): Observable<AlloggioResponse> {

    return this.http.put<AlloggioResponse>(

      `${this.apiUrl}/clean/${idAlloggio}`,
      {},
      { headers: this.creaHeadersAutenticati() }

    );
  }

  cambiaKitBenvenuto(idAlloggio: number): Observable<AlloggioResponse> {

    return this.http.put<AlloggioResponse>(

      `${this.apiUrl}/kit/${idAlloggio}`,
      {},
      { headers: this.creaHeadersAutenticati() }

    );
  }

  private creaHeadersAutenticati(): HttpHeaders {

    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    
  }
}
