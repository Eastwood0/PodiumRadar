# Bevindingen proefpagina (25 november 2026)

Agenda's van 12 zalen handmatig opgehaald (via een webfetch-hulpmiddel, niet met code). Dit is **geen** volledige bron-inventarisatie: of een site gestructureerde data (JSON-LD/iCal/JSON) heeft, is hier niet vastgesteld. Gebruik dit als startpunt voor `docs/bronnen-per-venue.md` in fase 1.

| Venue | Resultaat | Opmerking |
|---|---|---|
| AFAS Live | Volledig | ~93 events (na samenvoegen tijdsloten), t/m december 2027, statussen (uitverkocht/verplaatst/nieuw) zichtbaar |
| GelreDome | Gedeeltelijk | Eerste pagina, 24 events t/m juli 2027; er is een "Volgende"-pagina. Statussen kwamen er onbetrouwbaar uit (alles "uitverkocht") |
| Effenaar | Gedeeltelijk | 59 van ~104 events gelezen; teller "Toon resultaten (104)" op de pagina |
| 013 (`/programma`) | Gedeeltelijk | Eerste 49 events, pagina loopt door 2027 |
| Palladium Köln | Gedeeltelijk | Alleen 6 "anstehende Termine" op home én `/events` |
| Mitsubishi Electric Halle | Gedeeltelijk | Alleen uitgelichte events; datums alleen uit URL-slugs; "Alle Events ansehen" leidt naar kalender |
| Ziggo Dome | Mislukt | `/agenda` toont "0 Resultaten": agenda wordt client-side geladen → JSON-endpoint achter de pagina zoeken of Ticketmaster |
| Rotterdam Ahoy | Mislukt | Verzoek geweigerd (client error) |
| TivoliVredenburg | Mislukt | Verzoek geweigerd (client error) |
| LANXESS arena | Mislukt | Verzoek geweigerd (client error) |
| Sportpaleis | Mislukt | Serverfout |
| Lotto Arena | Mislukt | Serverfout |

Conclusies voor fase 1:
1. Zeker de helft van de grote zalen is niet "even" uit te lezen; Ticketmaster als eerste bron (bouwplan §4.2, volgorde van bouwen) blijft de juiste start.
2. Weigeringen kunnen aan het hulpmiddel liggen (andere User-Agent/IP); opnieuw testen met de eigen fetch-code en robots.txt per site vastleggen.
3. Paginering komt veel voor (GelreDome, Effenaar, 013): adapters moeten "volgende pagina" volgen tot 365 dagen vooruit.
4. Statussen uit HTML zijn foutgevoelig (GelreDome): pas tonen als een adapter-test ze aantoont.

Steekproef op juistheid (zoekmachine, 25 nov 2026): Take That AFAS Live 27-06-2027, Stray Kids GelreDome 2027 (RUN IT-tour), Enrique Iglesias GelreDome: alle drie bevestigd door een tweede bron.
