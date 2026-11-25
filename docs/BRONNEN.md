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

## Uit de planfase (9 oktober 2026, nog niet opnieuw gecontroleerd)

| Onderwerp | Bevinding | Bron |
|---|---|---|
| Ticketmaster Discovery API | Gratis key; standaard 5.000 calls/dag, 5/seconde; paginering tot 1.000 resultaten | [Ticketmaster getting started](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/) |
| Bandsintown API | `app_id` alleen na schriftelijke toestemming | [Jentic](https://jentic.com/apis/bandsintown.com/bandsintown) |
| Songkick API | Geen hobby-keys; licentie vanaf ca. $500/maand | [Wikipedia](https://en.wikipedia.org/wiki/Songkick) |
| Eventim | Geen publieke API | [pyventim](https://pypi.org/project/pyventim) |
