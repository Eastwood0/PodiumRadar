# CLAUDE.md — Podiumradar

## Wat is dit project
Een privé-website voor Ralf en maximaal 10 vrienden met de concertagenda's (komende 12 maanden) van grote en middelgrote zalen en stadions in Nederland en de grensregio België/Duitsland. Iedereen kan met één klik artiesten volgen en ziet in "Mijn radar" al hun shows in NL, BE, DE, VK en FR. Meldingen komen later.

**Bron van waarheid voor de inhoud: `docs/BOUWPLAN.md`.** Lees dat bestand volledig vóór elke taak. Bij tegenstrijdigheid tussen dit bestand en het bouwplan: stop en vraag het aan Ralf.

## Over Ralf (de opdrachtgever)
- Geen programmeerachtergrond. Leg keuzes en resultaten uit in gewoon Nederlands, zonder jargon, en geef bij alles wat hij zelf moet doen (accounts, secrets, instellingen) genummerde stappen.
- Wil eerst grondig plannen, dan bouwen. Doe geen productkeuzes die niet in het bouwplan staan: leg ze voor met 2–3 opties en een advies.
- Werkt met dit bestand om context tussen sessies te bewaren: houd de sectie "Huidige stand" hieronder bij.

## Werkwijze
0. Er wordt in de cloud gebouwd, niet op Ralfs pc (B18). Repo: `Eastwood0/PodiumRadar`. De bouwomgeving mag externe sites (Ticketmaster, zalen) vaak niet bereiken: test ophalen dan via een GitHub Actions-workflow met `workflow_dispatch` en lees de uitvoer met `gh run view --log`.
1. Werk strikt per fase uit `docs/BOUWPLAN.md` §11. Begin een nieuwe fase pas na expliciet akkoord van Ralf.
2. Begin elke fase met een korte takenlijst; sluit af door elk acceptatiecriterium af te vinken met bewijs (testuitvoer, Lighthouse-score, screenshot-beschrijving, aantal API-calls).
3. Externe feiten (API-limieten, endpoints, venue-namen, gratis tiers) altijd zelf verifiëren in de officiële documentatie; nooit uit het hoofd aannemen. Leg wat je vond vast in `docs/BRONNEN.md` met datum.
4. Nieuwe beslissingen toevoegen aan het beslissingslog in het bouwplan (volgnummer + één regel motivatie).
5. Twijfel over een artiest-koppeling, venue-ID of ontdubbeling: niet gokken, in een rapport voor Ralf zetten.

## Harde regels
- **Nooit** API-sleutels of e-mailadressen in de repo, in `data/` of in frontend-code. Sleutels alleen via GitHub-/Cloudflare-secrets; e-mailadressen alleen in D1 en Cloudflare Access; `.env` staat in `.gitignore`.
- Elke `/api/*`-functie haalt het e-mailadres **alleen** uit de gevalideerde Access-token (`Cf-Access-Jwt-Assertion`: handtekening, `iss`, `aud`, `exp`, `nbf`), nooit uit een losse header, en geeft alleen data van die gebruiker terug (bouwplan B15). De export voor de dagelijkse run bevat geen e-mailadressen.
- Alle links uit brondata gaan door `HttpUrl` in `src/lib/schema.ts` (alleen http/https, B16).
- Ticketmaster-API: max 2 calls per seconde (FAQ nov 2026), < 1.000 calls per dag; respecteer de `Rate-Limit`-headers.
- Venue-sites: robots.txt en gebruiksvoorwaarden respecteren, max 1 verzoek per seconde per site, eigen User-Agent. Kies altijd het laagste niveau uit bouwplan §4.2 (gestructureerde data vóór HTML-scraping).
- Een bron die < 50% van het vorige aantal events teruggeeft = storing: oude data behouden, melding sturen, niets verwijderen.
- Gebruikerstekst in de site is Nederlands; code, bestandsnamen en commits in het Engels.
- Geen nieuwe externe diensten of betaalde onderdelen zonder akkoord.

## Techstack (details in bouwplan §6)
TypeScript · Node.js LTS · Astro (statisch) + React-eilandjes · Tailwind · eigen zoekfunctie (B28) · Zod · Cheerio (Playwright alleen indien nodig) · Vitest · GitHub Actions · Cloudflare Pages + Pages Functions + D1 + Access

## Mappenstructuur (doel)
```
config/venues.yml          venue-lijst (bewerkbaar zonder code)
data/events.json           venue-agenda (gecommit door de dagelijkse run)
data/radar.json            shows van gevolgde artiesten (zonder e-mailadressen)
scripts/                   fetch, venues:resolve, coverage, favorites:remove-user
scripts/adapters/          één adapter per bron/platform, met test
src/                       Astro-site
functions/api/             Pages Functions (favorites, artist-search, favorites-export)
docs/BOUWPLAN.md           wat er gebouwd wordt
docs/ACCOUNTS.md           stappen voor Ralf
docs/BRONNEN.md            geverifieerde externe feiten
docs/bronnen-per-venue.md  inventarisatie: welk niveau per venue
docs/dekking.md            dekkingsrapport per venue
docs/steekproef.md         steekproef: onze data naast de officiële agenda
```

## Commando's (bijwerken zodra ze bestaan)
Bestaan al:
- `npm run dev` — site lokaal op http://localhost:4321
- `npm run verify` — alles in één keer: lint, typecheck, tests, geheimen-check, build (zelfde als CI)
- `npm test` — unit-tests (Vitest, map `tests/`)
- `npm run lint` · `npm run check` (Astro/TypeScript) · `npm run check:secrets` · `npm run build`

- `npm run probe` — bron-inventarisatie van alle venue-sites → `reports/` (workflow "Probe venue sources" zet het op branch `probe-results`)
- `npm run fetch` — alle adapters draaien → `data/events.json` + `data/status.json` (`FETCH_ONLY=afaslive.nl` voor één bron)
- `npm run coverage` — `docs/dekking.md` uit de data
- `npm run build` maakt eerst `public/data/agenda.json` (komende 30 dagen) en `agenda-later.json` (rest, B48) (prebuild: `scripts/build-site-data.ts`), daarna de site in `dist/`. `npm run dev` doet hetzelfde vooraf.
- Site-code: `src/app/` (React: `App.tsx`, `Overview.tsx`, `Pages.tsx`, `EventCard.tsx`, `search.ts`, `lib.ts`); stijl en kleuren in `src/styles/global.css` (licht/donker via tokens).

Workflows: `snapshot.yml` (handmatig: ruwe pagina's naar branch `snapshots` voor nieuwe adapters), `ci.yml` (elke push; incl. Lighthouse mobiel ≥ 90 op 3 pagina's via `scripts/lighthouse-check.mjs`), `fetch.yml` (dagelijks 04:17 UTC, bij adapterwijziging, handmatig; commit data naar main), `probe.yml`.

Nieuwe venue toevoegen: adapter in `scripts/adapters/` met `parseX(html)`-functie + ingekorte fixture in `tests/fixtures/` + test in `tests/adapters.test.ts`, daarna opnemen in `scripts/adapters/index.ts`.

Komt later: `npm run venues:resolve` (Ticketmaster-ID's, zodra de sleutel werkt).

## Definitie van klaar (elke taak)
- Tests groen, build groen, geen lint-fouten.
- Acceptatiecriteria van de fase aantoonbaar gehaald.
- "Huidige stand" hieronder bijgewerkt.
- Korte uitleg voor Ralf: wat is er veranderd, hoe kan hij het zien, wat moet hij eventueel zelf doen.

## Huidige stand
- **Overdracht: lees eerst `docs/OVERDRACHT.md`** (bijgewerkt 26 nov 2026, avond).
- Fase: **2 afgerond op de open punten na; fase 3 gebouwd** (26 nov 2026, wacht op uitrol naar main + controle door Ralf). Ticketmaster vervalt (B38); radar = eigen agenda NL/BE/DE (B43).
- Bouwplan: versie 0.10, beslissingen t/m B50. Geen inlog (B39/B42), site open maar niet vindbaar (B40).
- Hosting: Cloudflare Workers static assets via `wrangler.jsonc` (map `dist`) + Worker-script `src/worker.ts` alleen voor `/api/*` (`run_worker_first`), D1-binding `DB` zonder id (wordt bij uitrol automatisch aangemaakt, B42). Live op https://podiumradar.eastwood.workers.dev; elke push naar main rolt uit.
- Fase 3 (B42–B44): `src/app/follow.ts` (lijst in localStorage, sleutel `pr.follow`), `FollowButton.tsx` (☆ op kaarten en artiestpagina), `Radar.tsx` (`#radar`, Nieuw sinds vorig bezoek, koppelcode-UI, `#koppel-<code>`), `sync.ts` (client), `src/lib/sync-api.ts` (API: POST/GET/PUT/DELETE `/api/sync`, bewaart sha-256 van de code). Zoeken biedt "Volg “naam”". Overzicht: vakje met ster bij gevolgde artiest. Lokaal testen: `npm run build` en dan `npx wrangler dev` (lokale D1); Worker-modules mogen alleen de handler exporteren.
- Website: affiche-stijl (B30, Archivo); tabs Overzicht / Agenda / Mijn radar (op < 480 px "Radar" en logo zonder woord). Lighthouse lokaal mobiel 90–94, toegankelijkheid 96–100; 360 px zonder horizontaal scrollen.
- Genres (B31/B35): `scripts/lib/music-genre.ts`; MusicBrainz via `npm run genres`.
- Bronnen actief: zie `scripts/adapters/index.ts` en `docs/dekking.md`. Nieuw op 26 nov 2026:
  - Theaters (B45): `ticketmatic-theatre.ts` (Munttheater, Stadsschouwburg Utrecht, Schouwburg & Concertzaal Tilburg: sitemap + JSON-LD; Utrecht/Tilburg ±10 min per run), `maaspoort.ts`, `plt.ts` (Theater Heerlen, Theater Kerkrade, Toon Hermans Theater), `theater-roermond.ts` (De Oranjerie), `carre.ts` (eigen JSON), `delamar.ts`, `musis.ts` (eigen API), Theater Rotterdam via `uitagenda-rotterdam.ts`.
  - Melkweg (tweede bron) en Paradiso via `iamsterdam.ts` (B46).
  - `http.ts` volgt Crawl-delay (B47).
- Geen bron (`src/lib/no-source.ts`): Brabanthallen, Nieuwe Nor, Chassé, Parktheater (botcontroles/403, geen stadsagenda gevonden), Theater aan het Vrijthof (zoekapp), MartiniPlaza (sitemap verouderd, verder laden verboden in robots.txt), Goffertpark, Koning Boudewijnstadion, MECC, Signal Iduna Park, Warehouse Elementenstraat.
- Nooit bot-blokkades omzeilen (B23); geen sleutels uit andermans frontend gebruiken (Paradiso-GraphQL).
- Skills in het project: `.claude/skills/be-ambitious` en `.claude/skills/aislop` (zie README daar; de aislop-CLI mocht in de cloudsessie niet draaien → handmatige controle).
- Wacht op Ralf: keuze clubplan (`docs/clubplan.md`), samenvoegen naar main, live controle fase 3.
