import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrenotazioniService } from '../../services/prenotazioni.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  statistiche: any = null;
  errore: string = '';

  constructor(private prenotazioniService: PrenotazioniService) {}

  ngOnInit() {
    this.caricaStatistiche();
  }

  caricaStatistiche() {
    this.prenotazioniService.getDashboardStats().subscribe({
      next: (dati) => {
        this.statistiche = dati;
      },
      error: (err) => {
        console.error('Errore nel recupero delle statistiche', err);
        this.errore = 'Impossibile caricare le statistiche della dashboard.';
      }
    });
  }
}