# Overdracht naar een nieuwe sessie — 26 november 2026

Lees eerst `CLAUDE.md` en `docs/BOUWPLAN.md` (v0.9, B1–B41). Dit bestand vat samen wat Ralf op 26 nov 2026 (16:51) vroeg en hoe ver het is.

## Stand bij overdracht
- Fase 2 loopt. Site live op https://podiumradar.eastwood.workers.dev (Cloudflare Workers static assets, `wrangler.jsonc`; elke push naar main rolt uit). Niet vindbaar: `X-Robots-Tag: noindex` + robots `Disallow: /` (gecontroleerd 26 nov).
- Data: ~3.200 events, 51 venues. 148 tests groen.
- Laatste wijziging (deze commit): uitlegtekstjes weg (zie punt 6 hieronder).

## Wat Ralf vroeg (26 nov 2026, 16:51) en status

1. **Theaters in de regio**: Munttheater Weert, Maaspoort Venlo, PLT Heerlen, Parktheater Eindhoven. Status: **nog niet gebouwd**.
2. **Grote theaters NL**: Carré, DeLaMar, Stadsschouwburg Utrecht, Theaters Tilburg, Musis Arnhem, Oranjerie Roermond, Theater aan het Vrijthof. Status: **nog niet gebouwd**.
3. **MartiniPlaza en Paradiso**: agenda laadt via JavaScript. Status: **bron nog niet gevonden**.
4. **"Vraag Codex om 5 uit te zoeken. Ik ga geen brieven sturen en wil toch de data hebben."** Het gaat om Brabanthallen (captcha), Melkweg (AWS-botcontrole), Nieuwe Nor (403), en eventueel Chassé en Theater Rotterdam (403).
   - Aan Ralf gemeld: blokkades worden **niet** omzeild (B23).
   - De route is een officiële alternatieve bron, zoals bij Ahoy/Tivoli (B23/B34). Ideeën om te controleren (robots.txt!):
     - Uit in Amsterdam / I amsterdam-agenda voor Melkweg en Paradiso.
     - Uitagenda Rotterdam voor Theater Rotterdam. De adapter `uitagenda-rotterdam.ts` bestaat al; alleen location-ID's toevoegen.
     - Uit in Breda voor Chassé.
     - Regionale Limburgse uitagenda voor Nieuwe Nor.
     - Bossche uitagenda voor Brabanthallen.
5. **Grondige review samen met Codex** van site, code, UI, UX en visualisatie. Ralf noemde ook de skills "BeAmbitious" en "AIslop".
   - Die skills bestaan niet in de vorige cloudsessie. Controleer of ze in de nieuwe sessie wel bestaan.
   - De review is nog niet gedaan. Een gestarte reviewer is gestopt vóór er resultaat was.
6. **Uitlegtekstjes weghalen**, zoals "Een privé-site voor een kleine vriendenkring…". Status: **gedaan**.
   - Footer is nu alleen "Laatst bijgewerkt … · Bronnen".
   - Agenda- en Bronnen-kop hebben geen ondertitel meer.
   - Overzicht-uitleg ingekort tot "Tik op een vakje voor de shows."
   - Nog over: "Straks kun je artiesten volgen…" in `src/app/Pages.tsx` (ArtistPage, lege staat). Die verdwijnt met fase 3.
7. **Fase 3: akkoord van Ralf** ("Ga verder met fase 3"). Status: **nog niet begonnen**.
8. **Meer clubs voor een goed gevulde DJ-kalender** ("Complex, Pixl, etc. … flink wat extra stappen").
   - Status: niet begonnen.
   - Afspraak bij Ralf: eerst een clublijst + bronaanpak voorleggen (2–3 opties met advies). DJguide valt af (B33: robots ai=n).
   - Mogelijke routes:
     - eigen agenda's van clubs;
     - een aggregator die het toestaat (Partyflock? robots/voorwaarden controleren);
     - ticketplatform-pagina's van clubs (Weeztix/Eventix/Paylogic; voorwaarden controleren).
   - Resident Advisor eerst op voorwaarden controleren.

## Bevindingen theaters (uit branch `snapshots`)
Uitpakken: `git archive origin/snapshots snapshots | tar x`.

- **Geen enkele theaterpagina heeft Event-JSON-LD.**
- **Theaters Tilburg en Stadsschouwburg Utrecht** draaien op hetzelfde ASP.NET-platform met Ticketmatic.
  - HTML: `ul.events-list > li.paging-container[data-current-page] > div.event`.
  - Per event: `h3.title a[href]` (titel), `p.subtitle`, `time[datetime="dd-MM-yyyy HH:mm:ss"]` in `p.sr-only`, `span.tag` (soort, bijv. "Muziektheater"), `p.location` (zaal) en `data-detail-link` (id).
  - Pagina 1 heeft maar 19–30 events. Het pagina-endpoint moet nog gevonden worden: de site laadt meer pagina's na. Kijk naar netwerkverzoeken of een `?page=`-parameter.
  - Waarschijnlijk één adapter voor beide (niveau 2).
- **Munttheater Weert en Theater aan het Vrijthof**: ook Ticketmatic, maar er staan geen events in de HTML (alles via JavaScript). JSON-endpoint zoeken.
- **DeLaMar**: Umbraco, structuur nog bekijken.
- **Carré**: alleen JavaScript (9 kB HTML).
- **Maaspoort, PLT, Musis**: HTML bekijken. PLT noemt "next".
- **Oranjerie Roermond**: het URL verwijst door naar theaterhotelroermond.nl, de homepage. Juiste agenda-URL zoeken.
- **Parktheater Eindhoven**: verbinding mislukte vanuit GitHub Actions.
- Snapshots maken van nieuwe pagina's:
  `gh api -X POST repos/Eastwood0/PodiumRadar/actions/workflows/snapshot.yml/dispatches -f ref=main -f "inputs[urls]=<url1> <url2>"` → branch `snapshots`.
- Classificatie van theater staat al: `scripts/lib/categorize.ts` (Comedy, Toneel, Musical, Dans, Show, Familie) en het soortfilter op de site (Muziek / Theater & cabaret / Alles).

## Fase 3 — uitwerking volgens B39 (nog vastleggen als B42+ in het bouwplan)
- Geen inlog, geen e-mail.
  - Gevolgde artiesten staan in `localStorage`.
  - Een **koppelcode** (willekeurig, niet te raden; bijv. 128 bit, leesbaar weergegeven) zet ze over naar een ander apparaat.
  - De server bewaart alleen code → lijst artiestnamen.
- Hosting is een Worker met static assets. Fase 3 heeft daarom een Worker-script (`main` in `wrangler.jsonc`) nodig met routes `/api/sync`, plus opslag: D1 (bouwplan) of KV.
  - Eerst in de Cloudflare-docs verifiëren of Workers Builds een D1-database automatisch aanmaakt als `database_id` ontbreekt. Zo niet, dan genummerde stappen voor Ralf in `docs/ACCOUNTS.md`.
  - Gratis limieten vastleggen in `docs/BRONNEN.md`.
- Geen Ticketmaster (B38). De radar = de eigen agenda gefilterd op gevolgde artiesten (alleen NL/BE/DE). `data/radar.json`, `/api/artist-search` en `/api/favorites-export` zijn dan niet nodig. Leg dat vast als beslissing.
- Volgen moet ook kunnen voor een artiest die nu niet in de agenda staat (zoekbalk: "Volg '<naam>'"). Koppeling op genormaliseerde naam; let op tributebands.
- ☆/★ per artiest op eventkaarten en de artiestpagina.
- Scherm "Mijn radar" met label **Nieuw** (shows met `firstSeen` na het vorige bezoek; tijdstip lokaal bewaard).
- Gevolgde artiesten gemarkeerd in het overzicht (B27).
- Fase 3-criteria uit §11 aanpassen aan B39 en in het bouwplan vastleggen:
  - Twee koppelcodes zien elk alleen hun eigen lijst.
  - Volgen ≤ 1 s, blijft na herladen en op een ander apparaat via de code.
  - Een nieuw verschenen testshow staat in "Mijn radar" met Nieuw.
  - API weigert ongeldige codes en te grote lijsten (max 100 artiesten).
  - Geen e-mailadressen.
- Uitvoeren met de bekende werkwijze: takenlijst, tests, `npm run verify`, Lighthouse mobiel ≥ 90 behouden, 360 px zonder horizontaal scrollen.

## Volgorde zoals afgesproken met Ralf
1. Theaters (regio eerst).
2. MartiniPlaza/Paradiso.
3. Alternatieve bronnen voor de geblokkeerde zalen.
4. Fase 3.
5. Clubplan voorleggen.
6. Review (met Codex).
7. Afsluiten: CLAUDE.md "Huidige stand", bouwplan-beslissingen, korte uitleg voor Ralf in gewoon Nederlands.
