import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrenotazioniService } from '../../services/prenotazioni.service';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './homepage.component.html',
  styleUrls: ['./homepage.component.scss']
})
export class HomepageComponent implements OnInit {
  statistiche: any = null;
  errore: string = '';

  constructor(private prenotazioniService: PrenotazioniService) {}

  ngOnInit() {
    this.caricaStatistiche();
  }

  caricaStatistiche() {
    // Ho lasciato getDashboardStats() ipotizzando che l'API si chiami ancora così,
    // ma puoi rinominare anche quello nel servizio se preferisci.
    this.prenotazioniService.getDashboardStats().subscribe({
      next: (dati) => {
        this.statistiche = dati;
      },
      error: (err) => {
        console.error('Errore nel recupero delle statistiche', err);
        this.errore = 'Impossibile caricare le statistiche della homepage.';
      }
    });
  }
}