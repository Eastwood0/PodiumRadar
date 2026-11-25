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
- `npm run build` maakt eerst `public/data/agenda.json` (prebuild: `scripts/build-site-data.ts`), daarna de site in `dist/`. `npm run dev` doet hetzelfde vooraf.
- Site-code: `src/app/` (React: `App.tsx`, `Overview.tsx`, `Pages.tsx`, `EventCard.tsx`, `search.ts`, `lib.ts`); stijl en kleuren in `src/styles/global.css` (licht/donker via tokens).

Workflows: `ci.yml` (elke push; incl. Lighthouse mobiel ≥ 90 op 3 pagina's via `scripts/lighthouse-check.mjs`), `fetch.yml` (dagelijks 04:17 UTC, bij adapterwijziging, handmatig; commit data naar main), `probe.yml`.

Nieuwe venue toevoegen: adapter in `scripts/adapters/` met `parseX(html)`-functie + ingekorte fixture in `tests/fixtures/` + test in `tests/adapters.test.ts`, daarna opnemen in `scripts/adapters/index.ts`.

Komt later: `npm run venues:resolve` (Ticketmaster-ID's, zodra de sleutel werkt).

## Definitie van klaar (elke taak)
- Tests groen, build groen, geen lint-fouten.
- Acceptatiecriteria van de fase aantoonbaar gehaald.
- "Huidige stand" hieronder bijgewerkt.
- Korte uitleg voor Ralf: wat is er veranderd, hoe kan hij het zien, wat moet hij eventueel zelf doen.

## Huidige stand
- Fase: **2 bezig** (gestart 25 november 2026 op verzoek van Ralf). Fase 1 grotendeels af; open: Ticketmaster (B25), Palladium.
- Bouwplan: versie 0.6, beslissingen t/m B29.
- Website staat: Overzicht (zaal × maand, B27), Agenda met filters (onthouden in de browser), Artiest, Zaal, Bronnen, zoeken (B28), gele balk bij data > 36 uur. Lighthouse lokaal mobiel 94–99 performance, 100 accessibility; 360 px zonder horizontaal scrollen (Playwright-controle).
- Bronnen actief (zie `scripts/adapters/index.ts`, dekking in `docs/dekking.md`):
  - NL: Ziggo Dome (eigen JSON-API), Johan Cruijff ArenA, AFAS Live, Rotterdam Ahoy (via Uitagenda Rotterdam), GelreDome, 013 (Markdown), Effenaar, TivoliVredenburg (via UITagenda Utrecht, ~5–7 maanden vooruit).
  - BE: AFAS Dome, Lotto Arena, Vorst Nationaal, Trixxo Arena (één be•at-adapter), ING Arena.
  - DE: LANXESS arena, RheinEnergieStadion, PSD Bank Dome, Merkur Spiel-Arena, Mitsubishi Electric Halle (één d.live-adapter), Westfalenhalle, Veltins-Arena, Rudolf Weber-Arena, Grugahalle, SparkassenPark.
- Geen bron (redenen in `src/lib/no-source.ts`, ook zichtbaar op de site): Brabanthallen (captcha), De Kuip, Goffertpark, Megaland, Vrijthof, Koning Boudewijnstadion (geen eigen agenda → Ticketmaster), MECC, Palladium, Signal Iduna Park.
- Nooit bot-blokkades omzeilen (B23). Ahoy en Tivoli lopen vast via de stadsagenda's. Verzoekbrief alleen nog nodig voor Brabanthallen: `docs/verzoek-toegang.md`.
- Categorieën (B26): correcties in `config/categorie-correcties.yml`; twijfelgevallen in `docs/categorie-twijfel.md`.
- Fase 2 open: Cloudflare Pages + Access koppelen (Ralf, `docs/ACCOUNTS.md` stap 4) en daarna inlogscherm testen; 95%-steekproef tegen de officiële agenda's; "backstreet boy"-eis alleen op testdata aantoonbaar (BSB staan in geen agenda, BRONNEN.md).
- Openstaand voor Ralf: ACCOUNTS stap 3–4 (Cloudflare); Ticketmaster-goedkeuring afwachten; brief Brabanthallen.
