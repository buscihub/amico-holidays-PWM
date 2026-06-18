import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OspiteFrontend{

    id_cliente: number;
    id_soggiorno: number;
    nome_alloggio: string;
    sesso: string;
    cittadinanza: string;
    luogo_residenza: string;
    data_check_in: string;
    permanenza: number;

}

export interface ConfermaOsservatorioResponse{

    message: string;
    ospiti_elaborati:number;

}

export interface FiltriOsservatorio {

    stato?: number;
    mese?: string;
    anno?: string;

}

@Injectable({

  providedIn: 'root'

})

export class OsservatorioService{

    private apiUrl = 'http://localhost:4000/api/osservatorio';

    constructor(private http: HttpClient){}

    getOspitiOsservatorio(filtri: FiltriOsservatorio = {}): Observable<OspiteFrontend[]> { 

        const params: Record<string, string | number> = {};

        if (filtri.stato !== undefined) {
            params['stato'] = filtri.stato;
        }

        if (filtri.mese) {
            params['mese'] = filtri.mese;
        }

        if (filtri.anno) {
            params['anno'] = filtri.anno;
        }

        return this.http.get<OspiteFrontend[]>(this.apiUrl,{
            
            headers: this.creaHeadersAutenticati(),
            params
        
        });
    }

    confermaSelezionati(ids: number[]): Observable<ConfermaOsservatorioResponse>{

        return this.http.put<ConfermaOsservatorioResponse>(
            `${this.apiUrl}/conferma-selezionati`,
            { ids },
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
