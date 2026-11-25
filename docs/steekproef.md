# Steekproef dekking (fase 2)

Gecontroleerd op 25 november 2026: de eerste 15–24 events op de officiële agenda van de zaal (zoals een bezoeker die ziet) vergeleken met `data/events.json` van dezelfde dag. Een event telt als gevonden als wij op dezelfde dag in dezelfde zaal een event met een woord uit dezelfde titel hebben. Script: vergelijking met `norm()` uit `src/app/search.ts`.

| Zaal | Gecontroleerd | Gevonden | Opmerking |
|---|---|---|---|
| AFAS Live | 14 | 12 | De 2 missers waren shows van vandaag die al begonnen waren toen de run draaide; de site haalt die dan weg. De nachtelijke run (04:17 UTC) neemt ze wel mee |
| 013 | 15 | 14 | Idem: middagshow van vandaag die al voorbij was |
| Effenaar | 15 | 15 | |
| Westfalenhalle | 15 | 15 | |
| GelreDome | 24 | 24 | Hele agenda |
| Rudolf Weber-Arena | 14 | 14 | |
| PSD Bank Dome | 6 | 6 | |
| Grugahalle | 1 | 1 | Startpagina toont de rest zonder titel |
| LANXESS arena | 16 | 16 | |
| Mitsubishi Electric Halle | 3 | 3 | De startpagina toont ook een show van PSD Bank Dome (zelfde eigenaar); die staat bij ons correct bij PSD Bank Dome |
| **Totaal** | **123** | **120** | **97,6 %**; zonder de al begonnen shows van vandaag 100 % |

Niet automatisch te controleren (de pagina laadt de agenda met JavaScript of weigert de controle): Ziggo Dome, Johan Cruijff ArenA, AFAS Dome, Lotto Arena, Vorst Nationaal, ING Arena, Trixxo Arena, Merkur Spiel-Arena, Veltins-Arena, RheinEnergieStadion, Sparkassenpark. Rotterdam Ahoy en TivoliVredenburg blokkeren automatische bezoekers (B23); die komen via de stadsagenda's en zijn daar niet tegen de eigen site te leggen. TivoliVredenburg: de UITagenda loopt ongeveer 5–7 maanden vooruit, de eigen site verder.

Voorstel: Ralf (of een vriend) controleert deze zalen een keer met de hand: open de zaalpagina op Podiumradar naast de officiële agenda en tel de eerste 15.
