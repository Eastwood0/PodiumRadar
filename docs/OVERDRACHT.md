# Overdracht naar een nieuwe sessie — 26 november 2026 (avond)

Lees eerst `CLAUDE.md` en `docs/BOUWPLAN.md` (v0.10, B1–B47). Dit bestand zegt wat er na Ralfs verzoeken van 26 nov (16:51) gedaan is en wat nog openstaat.

## Branch en uitrol
- Al het werk staat op branch `claude/brave-albattani-488ljp`, **nog niet op main**. Pas na samenvoegen naar main rolt Cloudflare het uit en draait de nachtelijke run met de nieuwe bronnen.
- Bij de eerste uitrol maakt Cloudflare de D1-database zelf aan (B42). Controle: `docs/ACCOUNTS.md` stap 5.

## Gedaan (26 nov 2026)
1. **Theaters (B45):**
   - Gebouwd: Munttheater (131), Maaspoort (230), PLT met Theater Heerlen, Theater Kerkrade en Toon Hermans Theater (574), De Oranjerie Roermond (103), Carré (221), DeLaMar (318), Stadsschouwburg Utrecht (428), Schouwburg & Concertzaal Tilburg (371), Musis (274) en Theater Rotterdam (155, via Uitagenda Rotterdam). Tussen haakjes het aantal voorstellingen in de proefrun.
   - Geen bron: Parktheater (botcontrole) en Theater aan het Vrijthof (zoekapp, verkooplijst alleen op het ticketplatform).
2. **MartiniPlaza en Paradiso:**
   - Paradiso: via Uit in Amsterdam (±57 shows, onvolledig).
   - MartiniPlaza: geen bron. Zelfde platform als Munttheater, maar de sitemap is verouderd en "meer laden" is verboden in robots.txt; Visit Groningen heeft geen lijst per locatie.
3. **Geblokkeerde zalen:**
   - Melkweg: via Uit in Amsterdam (±242 shows; de eigen bron gaf 0 door de botcontrole).
   - Theater Rotterdam: via Uitagenda Rotterdam.
   - Brabanthallen, Nieuwe Nor en Chassé: geen officiële stads- of regio-agenda gevonden (alleen aggregators, B34).
4. **Fase 3 (B42–B44):** gebouwd en lokaal getest met `wrangler dev` en Playwright:
   - Volgen kost ~60 ms en blijft na herladen bewaard.
   - Een tweede apparaat ziet via de koppellink dezelfde lijst.
   - Nieuw: 15 labels na een oud bezoek, 0 bij het volgende bezoek.
   - 360 px zonder horizontaal scrollen.
   - API-tests (`tests/worker.test.ts`): eigen lijst per code, ongeldige codes en te grote lijsten geweigerd.
5. **Clubplan:** `docs/clubplan.md`. Wacht op Ralfs keuze (advies: route A, eigen sites; eerst Complex en Lofi).
6. **Review:** handmatig volgens de aislop-catalogus. De aislop-CLI mocht in de cloudsessie niet draaien (veiligheidscheck tegen het uitvoeren van een extern npm-pakket). Codex was niet bereikbaar (geen agent bridge in deze sessie). Gevonden en opgelost:
   - klassennaam-botsing `.link`;
   - kop op 360–480 px;
   - `Origin: null` gaf een 503;
   - offline wijziging werd overschreven;
   - `as any` in Effenaar;
   - zwakke suggesties in een lege radar;
   - Utrecht vroeg 12 pagina's op die een 404 geven.
7. **Skills:** `.claude/skills/be-ambitious` en `.claude/skills/aislop` (bron en licentie in de README daar).

## Open
- Ralf: branch naar main laten samenvoegen (of toestemming geven om dat te doen), daarna live controleren (ACCOUNTS.md stap 5).
- Ralf: keuze clubplan.
- Theaters Tilburg heeft geen genre op de voorstellingspagina; indeling gaat op titel (veel "gok muziek").
- Theater aan het Vrijthof, Parktheater, MartiniPlaza, Chassé, Nieuwe Nor, Brabanthallen: zonder bron. Opties staan in de uitleg aan Ralf.
- Optioneel: meer Amsterdamse zalen uit Uit in Amsterdam (Concertgebouw 330 events, Bimhuis, Muziekgebouw, Stadsschouwburg Amsterdam). Is een productkeuze voor Ralf.
