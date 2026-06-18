import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AlloggioFrontend, AlloggiService } from '../../services/alloggi.service';

@Component({
  selector: 'app-alloggi',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alloggi.component.html',
  styleUrl: './alloggi.component.scss'
})
export class AlloggiComponent implements OnInit {
  alloggi: AlloggioFrontend[] = [];
  caricamento = false;
  messaggioErrore = '';

  constructor(private alloggiService: AlloggiService) {}

  ngOnInit(): void {
    this.caricaAlloggi();
  }

  caricaAlloggi(): void {
    this.caricamento = true;
    this.messaggioErrore = '';

    this.alloggiService.getAlloggi().subscribe({
      next: (risposta) => {
        this.alloggi = risposta.data;
        this.caricamento = false;
      },
      error: (errore) => {
        console.error('Errore recupero alloggi:', errore);
        this.messaggioErrore = 'Impossibile recuperare gli alloggi.';
        this.caricamento = false;
      }
    });
  }

  aggiornaPulizia(idAlloggio: number): void {
    this.alloggiService.cambiaStatoPulizia(idAlloggio).subscribe({
      next: (risposta) => {
        this.aggiornaAlloggioInLista(risposta.data);
      },
      error: (errore) => {
        console.error('Errore aggiornamento pulizia:', errore);
        this.messaggioErrore = 'Impossibile aggiornare lo stato della pulizia.';
      }
    });
  }

  aggiornaKit(idAlloggio: number): void {
    this.alloggiService.cambiaKitBenvenuto(idAlloggio).subscribe({
      next: (risposta) => {
        this.aggiornaAlloggioInLista(risposta.data);
      },
      error: (errore) => {
        console.error('Errore aggiornamento kit:', errore);
        this.messaggioErrore = 'Impossibile aggiornare il kit di benvenuto.';
      }
    });
  }

  private aggiornaAlloggioInLista(alloggioAggiornato: AlloggioFrontend): void {
    this.alloggi = this.alloggi.map((alloggio) =>
      alloggio.id_alloggio === alloggioAggiornato.id_alloggio ? alloggioAggiornato : alloggio
    );
  }
}
