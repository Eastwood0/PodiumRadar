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

## Uit de planfase (9 oktober 2026, nog niet opnieuw gecontroleerd)

| Onderwerp | Bevinding | Bron |
|---|---|---|
| Ticketmaster Discovery API | Gratis key; standaard 5.000 calls/dag, 5/seconde; paginering tot 1.000 resultaten | [Ticketmaster getting started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) |
| Bandsintown API | `app_id` alleen na schriftelijke toestemming | [Jentic](https://jentic.com/apis/bandsintown.com/bandsintown) |
| Songkick API | Geen hobby-keys; licentie vanaf ca. $500/maand | [Wikipedia](https://en.wikipedia.org/wiki/Songkick) |
| Eventim | Geen publieke API | [pyventim](https://pypi.org/project/pyventim) |
