# Geverifieerde externe feiten

Elke regel: wat, bron, datum gecontroleerd. Niet uit het hoofd aanvullen; bij twijfel opnieuw controleren.

## Fase 0 — gecontroleerd 25 november 2026

| Onderwerp | Bevinding | Gevolg voor het plan | Bron |
|---|---|---|---|
| Cloudflare Zero Trust (Access), gratis plan | Gratis plan is bedoeld voor teams onder 50 gebruikers; Zero Trust Network Access is inbegrepen | ✅ 11 gebruikers past ruim | [Cloudflare plans](https://www.cloudflare.com/plans/sase-zero-trust.md) |
| Inloggen met e-mailcode (one-time PIN) | Code per mail, 10 minuten geldig, eenmalig te gebruiken; mail komt alleen als een Access-regel het adres toestaat. Docs noemen **niet expliciet** dat dit op het gratis plan zit | ⚠️ Controleren bij instellen (ACCOUNTS.md stap 4). Link-scanners in mailprogramma's kunnen een code "opgebruiken" → gebruiker vraagt nieuwe code | [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) |
| Identiteit uitlezen in server-functies | Cloudflare adviseert de ondertekende token in header `Cf-Access-Jwt-Assertion` te valideren (sleutels via `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, RS256) en `iss`, `aud`, `exp`, `nbf` te controleren. Sleutels roteren ongeveer elke 6 weken, dus niet vastzetten | ⚠️ Aanscherping: e-mailadres alleen uit gevalideerde token halen (B15) | [Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) |
| `*.pages.dev` en preview-adressen | Een Access-applicatie beschermt alleen de adressen waaraan hij gekoppeld is; het `<project>.pages.dev`-adres en preview-adressen zijn aparte adressen. Een beveiligingsreview vond hier een omweg | ⚠️ Ook `*.<project>.pages.dev` afschermen (B15) | [Hardened admin auth on Cloudflare Pages](https://jamieede.com/posts/hardened-admin-auth-cloudflare-pages/) (praktijkartikel, geen officiële docs) |
| Pages Functions, gratis | Pages Functions worden afgerekend als Workers: 100.000 verzoeken per dag, 10 ms CPU-tijd per verzoek | ✅ Ruim voldoende; tokencontrole is licht | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1, gratis | 5 miljoen gelezen rijen per dag, 100.000 geschreven rijen per dag, 5 GB opslag | ✅ Ruim voldoende (favorieten: hooguit ~1.100 rijen) | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Cloudflare Pages blijft ondersteund | Pages en Workers groeien naar één platform; bestaande Pages-projecten blijven werken. Geen aankondiging dat Pages stopt | ✅ Pages houden; bij overstap later is een migratiegids beschikbaar | [Blog: convergence](https://blog.cloudflare.com/pages-and-workers-are-converging-into-one-experience/), [Migratiegids](https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/) |
| GitHub geplande runs | In **publieke** repo's worden geplande workflows na 60 dagen zonder activiteit uitgeschakeld. Over privé-repo's zeggen de docs niets | ✅ Repo is privé en de dagelijkse run commit data; gele balk in de site blijft als vangnet | [GitHub docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows) |
| GitHub Actions-versies | Nieuwste hoofdversies: `actions/checkout@v7`, `actions/setup-node@v7` | In `.github/workflows/ci.yml` | `git ls-remote` op github.com/actions/* |
| Node.js | Astro 7.4 vereist Node ≥ 22.23.4 | `.nvmrc` = 22, `engines` in package.json | `node_modules/astro/package.json` |

## Fase 1 — gecontroleerd 25 november 2026

| Onderwerp | Bevinding | Gevolg | Bron |
|---|---|---|---|
| Ticketmaster-limiet | FAQ noemt nu standaard 2 verzoeken/seconde en 5.000/dag (eerder 5/s genoteerd) | Onze grens van 4/s gaat omlaag naar **max 2/s** zodra Ticketmaster erin komt | [Ticketmaster FAQ](https://developer.ticketmaster.com/support/faq/) |
| Eventim | Geen officiële API. De zoek-API die websites en pyventim gebruiken (`public-api.eventim.com`) staat in robots.txt dicht voor bots | Niet gebruiken (B20) | [pyventim: no public API](https://openevent.codeberg.page/pyventim/latest/explanation/no-public-api/), eigen probe |
| Skiddle (VK) | Gratis sleutel op aanvraag, alleen-lezen, alleen niet-commercieel; kan bij veel verkeer beperkt worden | Optie voor radar VK (Ralf moet aanvragen) | [Skiddle API](https://www.skiddle.com/api/) |
| UiTdatabank (BE) | Doorzoekbare database met evenementen in Vlaanderen en Brussel; hoe je toegang krijgt staat niet op de gelezen pagina's | Optie voor BE, toegang uitzoeken | [publiq docs](https://docs.publiq.be/docs/uitdatabank/search-api/introduction) |
| OpenAgenda (FR) | Open evenementendatabase met API | Optie voor radar FR, dekking grote concerten onbekend | [OpenAgenda developers](https://developers.openagenda.com/en/) |
| Bandsintown | API-documentatie zegt niet wie een `app_id` krijgt | Aanvraag blijft optioneel | [Bandsintown API docs](https://help.artists.bandsintown.com/en/articles/9186477-api-documentation) |
| Sportpaleis → AFAS Dome | sportpaleis.be verwijst door naar afas-dome.be | Naam aangepast (B21) | eigen probe |
| Palais 12 → ING Arena | Officiële stadssite noemt ING Arena "het voormalige Palais 12"; site ing.arena.brussels | Naam aangepast (B21) | [brussels.be](https://www.brussels.be/ing-arena) |
| Trixxo Arena (Hasselt) | Voorheen Ethias Arena | Naam aangepast (B21) | [Wikipedia](https://en.wikipedia.org/wiki/Trixxo_Arena) |
| Rudolf Weber-Arena (Oberhausen) | Huidige naam van de arena in Oberhausen | Naam aangepast (B21) | [Wikipedia](https://en.wikipedia.org/wiki/Rudolf_Weber-Arena) |

## Fase 1, tweede ronde — gecontroleerd 25 november 2026

| Onderwerp | Bevinding | Gevolg | Bron |
|---|---|---|---|
| Rotterdam Ahoy | Elke pagina (ook robots.txt) geeft een Cloudflare-challenge (`cf-mitigated: challenge`) | Niet omzeilen; via Uitagenda Rotterdam (B23) | eigen test |
| TivoliVredenburg | Sinds 25 nov 2026 Cloudflare-challenge op agenda, sitemap en WordPress-API; robots.txt staat alles toe | Idem, via UITagenda Utrecht | eigen test |
| Brabanthallen | SiteGround-captcha (`/.well-known/sgcaptcha/`) op de agenda | Geen bron; toegang vragen | eigen test |
| Uitagenda Rotterdam | JSON-endpoint `/umbraco/api/Entity/GetProductions` per locatie; robots.txt verbiedt alleen de ICS-export en `/locaties/type/` | Bron voor Ahoy + RTM Stage | robots.txt + eigen test |
| UITagenda Utrecht | Agenda in datumvolgorde, 40 per pagina, ~52 pagina's (± 7 maanden vooruit) | Bron voor TivoliVredenburg; dekt minder dan de zaal zelf (196 vs 748 events) | eigen test |
| Ziggo Dome | De site laadt zijn agenda uit `/api/agenda/aankomend/?limit=&offset=` (JSON, met status en voorverkoopdatum) | Niveau 1 | eigen test |
| d.live (Düsseldorf) | `/events-tickets/eventkalender/dates?total=` geeft JSON; tijden staan als lokale tijd met een foutieve "Z" | Tijd gelezen als Düsseldorfse tijd (gecontroleerd tegen de eventpagina) | eigen test |
| be•at (AFAS Dome e.a.) | Eventpagina's hebben de tickets (datum, tijd, link) in gecodeerde page data; sitemap noemt ~100 events per zaal | Eén adapter voor vier zalen | eigen test |
| 013 | Publiceert het hele programma als Markdown (`/programma.md`) | Niveau 1 | eigen test |
| Megaland | megaland.nl staat te koop | Geen eigen agenda | eigen test |
| Ticketmaster | Ontwikkelaarsaccount van Ralf nog niet goedgekeurd | Wachten (B25) | Ralf |

## Fase 2 — gecontroleerd 25 november 2026

| Onderwerp | Bevinding | Gevolg | Bron |
|---|---|---|---|
| Cloudflare Pages, builds | Gratis plan: 500 builds per maand, build stopt na 20 minuten; max 20.000 bestanden, max 25 MiB per bestand | Dagelijkse run + pushes ≈ 40–80 builds/maand; agenda.json is ~0,5 MB | [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) |
| Cloudflare Workers static assets | Statische bestanden zonder Worker-script via `assets.directory` in `wrangler.jsonc`; `_headers` wordt ondersteund (max 100 regels); verzoeken naar statische bestanden zijn gratis en onbeperkt. Zonder config probeert `wrangler deploy` het project om te bouwen ("astro add cloudflare"), wat bij ons de build brak (26 nov 2026) | `wrangler.jsonc` in de repo | [Static assets](https://developers.cloudflare.com/workers/static-assets/), [Headers](https://developers.cloudflare.com/workers/static-assets/headers/), [Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) |
| Cloudflare Pages, Node-versie | Build image v3 gebruikt standaard Node 22.23.4; versie is in te stellen met `.nvmrc`, `.node-version` of `NODE_VERSION` | `.nvmrc` (22) in de repo volstaat, geen extra instelling | [Build image](https://developers.cloudflare.com/pages/configuration/build-image/) |
| Backstreet Boys | Speelden in sep/okt 2026 een reeks in de Merkur Spiel-Arena (Düsseldorf); die is voorbij, er staan nu geen shows in de zalen van Podiumradar | Acceptatietest "backstreet boy" draait op testdata; live pas te zien zodra ze weer in een agenda staan of via Ticketmaster (fase 3) | [Visit Düsseldorf](https://www.visitduesseldorf.de/en/calendar-of-events/backstreet-boys-into-the-millennium-homecoming-live-in-germany-ccc735ad0c) |

## Genres en extra zalen — gecontroleerd 26 november 2026

| Onderwerp | Bevinding | Gevolg | Bron |
|---|---|---|---|
| MusicBrainz API | Max gemiddeld 1 verzoek per seconde per IP; elk verzoek moet een User-Agent met contactgegevens hebben; daarboven HTTP 503 | `scripts/genres.ts` gebruikt de wachtrij van 1 verzoek/s, User-Agent met repo-link, max 400 opzoekingen per run met een extra pauze (ongeveer 1 per 2 seconden), wacht bij 503 en stopt na 15 fouten. GitHub-machines delen IP-adressen; op 26 nov gaven ze na 20–50 verzoeken 503 | [Rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) |
| DJguide | robots.txt: "Content-Usage: ai=n", lange lijst geblokkeerde bots en scrapers; geen API, RSS of iCal gevonden | Niet als bron gebruikt (B33) | [djguide.nl](https://www.djguide.nl/) |
| Gashouder | Ging begin 2025 ongeveer anderhalf jaar dicht voor verbouwing (bericht 5 dec 2024) | Eigen site gashouder.nl; agenda via probe/snapshot controleren | [NH Nieuws](https://www.nhnieuws.nl/nieuws/343470/verbouwing-gashouder-jaar-dicht-amsterdam) |
| Warehouse Elementenstraat | Geen eigen agenda-site gevonden; staat bij ADE, I amsterdam en ticketplatforms | Geen bron; komt mogelijk via Ticketmaster | [I amsterdam](https://www.iamsterdam.com/uit/agenda/nachtleven/clubbing/warehouse-elementenstraat) |
| Maassilo | Staat in de Uitagenda Rotterdam als locatie | Via de bestaande Uitagenda Rotterdam-adapter | [Uitagenda Rotterdam](https://uitagendarotterdam.nl/en/locations/location/maassilo) |
| Probe nieuwe zalen | JSON-LD: Muziekgieterij, De Oosterpoort (Spot), Paard; sitemap + JSON-LD: Paradiso, Doornroosje; HTML: MartiniPlaza, Hedon, Mezz, Patronaat; JavaScript: De Bosuil, Grenswerk, Gashouder, Klokgebouw, Maassilo; 403: Nieuwe Nor; 202 (mogelijk botcontrole): Melkweg | Adapters in die volgorde | probe-results, 26 nov 2026 |

## Zalen zonder bron, Melkweg — gecontroleerd 26 november 2026

| Onderwerp | Bevinding | Gevolg | Bron |
|---|---|---|---|
| Melkweg | Controlescherm van AWS WAF (HTTP 202, `gokuProps`/`awsWafCookieDomainList`), niet bij elk verzoek | Herhaalpogingen zonder het controlescherm uit te voeren (B37) | snapshot 26 nov 2026 |
| koeln.de | robots.txt: `Disallow: /*?` (dus geen API met parameters), venuepagina's en `/seite/N/` toegestaan; venuepagina Palladium heeft JSON-LD, 16 events per pagina | Palladium via `/veranstaltungsort/palladium-koeln/seite/N/` | [koeln.de Palladium](https://www.koeln.de/veranstaltungsort/palladium-koeln/) |
| De Kuip | Locatie "Stadion Feyenoord De Kuip" in Uitagenda Rotterdam, locatie-id 209292 (uit de afbeeldingspaden van de locatiepagina) | Via de Uitagenda Rotterdam-adapter | [Uitagenda Rotterdam](https://www.uitagendarotterdam.nl/en/locations/location/stadion-feyenoord-de-kuip) |
| Pinkpop / Megaland | Pinkpop 2027: 18–20 juni 2027, Megaland Landgraaf; line-up met dag per act op de homepage; robots.txt staat het toe | Megaland via pinkpop.nl (B34) | [pinkpop.nl](https://www.pinkpop.nl/) |
| MECC | robots.txt: crawl-delay 10; agenda laadt via JavaScript (admin-ajax) | Nog geen bron | [mecc.nl](https://www.mecc.nl/bezoeken/agenda/) |
| I amsterdam | Locatiepagina's tonen geen eventlijst; agenda-filters met parameters verboden in robots.txt | Geen bron voor Melkweg/Warehouse | [iamsterdam.com](https://www.iamsterdam.com/robots.txt) |
| André Rieu / Vrijthof | robots.txt staat alles toe; de homepage /nl/ toont alle tourdata als `li[data-date-ordering]` met stad en locatie; 12 Vrijthof-concerten in juli 2027 | Vrijthof via andrerieu.com (B34) | [andrerieu.com](https://www.andrerieu.com/nl/) |
| Mezz | robots.txt staat alles toe; de programmapagina laadt `/wp-json/wp/v2/event` (100 per pagina) | Mezz via de eigen API (B24) | [mezz.nl](https://www.mezz.nl/programma/) |
| Paradiso | Programma- en homepage bevatten maar ±27 uitgelichte events; de rest laadt via JavaScript van een niet-zichtbare API | Nog geen bron | snapshot 26 nov 2026 |
| MartiniPlaza | Agenda toont ±20 events; `?page=2` geeft dezelfde lijst (verder laden via JavaScript) | Nog uitzoeken | snapshot 26 nov 2026 |

## Theaters — gecontroleerd 26 november 2026

| Onderwerp | Bevinding | Gevolg | Bron |
|---|---|---|---|
| De Kattendans | WordPress met de plugin "Theater for WordPress"; programmapagina met alle voorstellingen (datum "do 26 nov ‘26", tijd, categorie, uitverkocht); robots.txt staat het toe | Generieke adapter `wp-theatre.ts` | [kattendans.nl](https://kattendans.nl/programma/) |
| Spot Groningen | Programmapagina met per voorstelling `data-location`, `data-genres` en `<time datetime>`; JSON-LD bevat sjabloontekst | Oosterpoort + Stadsschouwburg via HTML | [spotgroningen.nl](https://www.spotgroningen.nl/programma) |
| cabaretinfo.nl | HTTP 403 voor onze bot | Geen landelijke cabaretagenda als bron | snapshot 26 nov 2026 |
| Chassé, Theater Rotterdam | HTTP 403 voor onze bot | Geen bron; eventueel in verzoekbrief | snapshot 26 nov 2026 |
| Theater aan het Vrijthof | Programma is een JavaScript-app; de lijst voor zoekmachines heeft maar 109 toekomstige datums en mist voorstellingen met één datum | Nog geen bron | snapshot 26 nov 2026 |

## Uit de planfase (9 oktober 2026, nog niet opnieuw gecontroleerd)

| Onderwerp | Bevinding | Bron |
|---|---|---|
| Ticketmaster Discovery API | Gratis key; standaard 5.000 calls/dag, 5/seconde; paginering tot 1.000 resultaten | [Ticketmaster getting started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) |
| Bandsintown API | `app_id` alleen na schriftelijke toestemming | [Jentic](https://jentic.com/apis/bandsintown.com/bandsintown) |
| Songkick API | Geen hobby-keys; licentie vanaf ca. $500/maand | [Wikipedia](https://en.wikipedia.org/wiki/Songkick) |
| Eventim | Geen publieke API | [pyventim](https://pypi.org/project/pyventim) |
