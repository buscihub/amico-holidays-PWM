import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FiltriOsservatorio, OsservatorioService, OspiteFrontend } from '../../services/osservatorio.service';

@Component({
  selector: 'app-osservatorio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './osservatorio.component.html',
  styleUrl: './osservatorio.component.scss'
})

export class OsservatorioComponent implements OnInit {
  ospiti: OspiteFrontend[] = [];
  ospitiSelezionati = new Set<number>(); /* conterrà gli id soggiorno perché il backend
                                         conferma i record aggiornando la tabella soggiorni */
  caricamento = false;
  confermaInCorso = false;
  messaggioErrore = '';
  messaggioSuccesso = '';

  filtroStato = 0;
  filtroMese = '';
  filtroAnno = '';

  constructor(private osservatorioService: OsservatorioService) {}

  ngOnInit(): void {
    this.caricaOspiti();
  }

  get numeroSelezionati(): number {
    return this.ospitiSelezionati.size;
  }

  get tuttiSelezionati(): boolean {
    return this.ospiti.length > 0 && this.ospiti.every((ospite) =>
      this.ospitiSelezionati.has(ospite.id_soggiorno)
    );
  }

  caricaOspiti(): void {
    this.caricamento = true;
    this.messaggioErrore = '';
    this.messaggioSuccesso = '';

    this.osservatorioService.getOspitiOsservatorio(this.creaFiltri()).subscribe({
      next: (ospiti) => {
        this.ospiti = ospiti;
        this.ospitiSelezionati.clear();
        this.caricamento = false;
      },
      error: (errore) => {
        console.error('Errore recupero ospiti osservatorio:', errore);
        this.messaggioErrore = 'Impossibile recuperare gli ospiti per l\'osservatorio.';
        this.caricamento = false;
      }
    });
  }

  applicaFiltri(): void {
    this.caricaOspiti();
  }

  mostraDaSegnare(): void {
    this.filtroStato = 0;
    this.caricaOspiti();
  }

  mostraStorico(): void {
    this.filtroStato = 1;
    this.caricaOspiti();
  }

  cambiaSelezione(idSoggiorno: number, event: Event): void {
    const selezionato = (event.target as HTMLInputElement).checked;

    if (selezionato) {
      this.ospitiSelezionati.add(idSoggiorno);
      return;
    }

    this.ospitiSelezionati.delete(idSoggiorno);
  }

  selezionaTutti(event: Event): void {
    const selezionato = (event.target as HTMLInputElement).checked;

    this.ospitiSelezionati.clear();

    if (selezionato) {
      this.ospiti.forEach((ospite) => {
        this.ospitiSelezionati.add(ospite.id_soggiorno);
      });
    }
  }

  isSelezionato(idSoggiorno: number): boolean {
    return this.ospitiSelezionati.has(idSoggiorno);
  }

  confermaSelezionati(): void {
    const ids = Array.from(this.ospitiSelezionati);

    if (ids.length === 0) {
      this.messaggioErrore = 'Seleziona almeno un ospite da confermare.';
      this.messaggioSuccesso = '';
      return;
    }

    this.confermaInCorso = true;
    this.messaggioErrore = '';
    this.messaggioSuccesso = '';

    this.osservatorioService.confermaSelezionati(ids).subscribe({
      next: (risposta) => {
        this.messaggioSuccesso = risposta.message;
        this.confermaInCorso = false;
        this.caricaOspiti();
      },
      error: (errore) => {
        console.error('Errore conferma ospiti osservatorio:', errore);
        this.messaggioErrore = 'Impossibile confermare gli ospiti selezionati.';
        this.confermaInCorso = false;
      }
    });
  }

  private creaFiltri(): FiltriOsservatorio {
    return {
      stato: this.filtroStato,
      mese: this.filtroMese || undefined,
      anno: this.filtroAnno || undefined
    };
  }
}
