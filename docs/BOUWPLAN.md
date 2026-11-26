# Podiumradar — Bouwplan

> Werktitel: **Podiumradar**. Versie 0.10 · status **AKKOORD** (Ralf: "Start de bouw", 25 november 2026; fase 1 gestart zonder Ticketmaster)
> Dit document is de bron van waarheid voor wát er gebouwd wordt. `CLAUDE.md` beschrijft hóé Claude Code werkt.
> Wijzigingen 0.9 → 0.10 (26 nov 2026): fase 3 uitgewerkt zonder inlog en zonder Ticketmaster (B42–B44), theaters (B45), Melkweg/Paradiso via Uit in Amsterdam (B46), Crawl-delay (B47), agenda in twee delen (B48).
> Wijzigingen t.o.v. 0.4: zalen achter een bot-blokkade via de culturele stadsagenda (B23); Ziggo Dome en gedeelde platforms via hun eigen JSON (B24); Ticketmaster wacht op goedkeuring (B25).
> Wijzigingen 0.3 → 0.4: Ticketmaster-sleutel nog niet beschikbaar → venue-sites eerst (B19), Eventim-API niet bruikbaar (B20), venue-namen bijgewerkt (B21), adapter-aanpak (B22).
> Wijzigingen 0.2 → 0.3: verificaties fase 0 verwerkt (B15–B17, §17); `verified`-veld in Venue.
> Wijzigingen 0.1 → 0.2: antwoorden Ralf verwerkt (volgen via klikken, eigen favorieten per persoon, middelgrote zalen erbij, radar NL/BE/DE/VK/FR, meldingen naar later) en venue-sites als volwaardige bron (B3 herzien → B9).

---

## 1. Probleem en doel

**Aanleiding:** de Backstreet Boys speelden een paar weken geleden in het buitenland en we wisten het niet. Agenda's zijn verspreid over tientallen venue-sites en ticketshops; niemand checkt die allemaal.

**Doel:** één website waarop je in één oogopslag ziet wie er de komende ~12 maanden speelt in de grote en middelgrote zalen en stadions in Nederland en de grensregio (BE/DE), plus een **artiest-radar**: volg artiesten met één klik en zie al hun shows in NL, BE, DE, VK en FR.

**Succes is (toetsbaar):**
1. Elke venue op de lijst heeft minstens één werkende bron, en de site toont **≥ 95%** van de events op de officiële venue-agenda (steekproef, §11 fase 1).
2. Een nieuw aangekondigde show van een gevolgde artiest staat binnen **24 uur** in "Mijn radar" (mits de show in een van onze bronnen staat).
3. Vanaf openen van de site tot "ik zie of artiest X hier speelt": **≤ 2 tikken** en **≤ 10 seconden**.
4. Een artiest volgen kost **1 tik** vanaf een eventkaart of artiestpagina, ook als de artiest op dit moment niet toert.

## 2. Gebruikers en scope

| Onderwerp | Keuze |
|---|---|
| Gebruikers | Ralf + maximaal 10 vrienden, elk met eigen favorieten |
| Venue-agenda | NL + grensregio BE/DE, arena's, stadions én middelgrote zalen (startlijst §8, ~32 venues) |
| Artiest-radar | Shows van gevolgde artiesten in **NL, BE, DE, VK, FR** |
| Tijdshorizon | Vandaag t/m 365 dagen vooruit |
| Eventtypes | Muziek standaard; schakelaar "alles tonen" voor shows/sport (B2) |
| Meldingen | **Niet in deze versie** (Later-lijst §18); het datamodel houdt er wel rekening mee |
| Taal UI | Nederlands |
| Kosten | € 0 per maand |
| Hosting | Gratis, online, bereikbaar op telefoon |

**Buiten scope (nu):** meldingen, ticketverkoop, prijsvergelijking, publieke lancering, native app.

## 3. Kernconcept: twee lagen

1. **Venue-agenda** — "Wat staat er in de zalen hier in de buurt?" Ophalen per venue, uit venue-sites én Ticketmaster.
2. **Artiest-radar** — "Waar speelt mijn favoriet, ook in Londen of Parijs?" Ophalen per gevolgde artiest via Ticketmaster.

Alleen laag 1 had het Backstreet Boys-geval niet opgevangen als ze buiten de regio speelden; laag 2 wel.

## 4. Databronnen

Er is geen enkele gratis bron die alles dekt. Daarom per venue de beste bron kiezen en bronnen combineren.

### 4.1 Overzicht

| Bron | Rol | Status / voorwaarden | Beslissing |
|---|---|---|---|
| **Officiële venue-sites** | Hoofdbron venue-agenda: de venue-agenda is per definitie compleet, ongeacht ticketverkoper | Per site uitlezen; kan breken als de site verandert | **Gebruiken** waar haalbaar (fase 1–2) |
| **Ticketmaster Discovery API v2** | Hoofdbron artiest-radar; aanvulling/verrijking venue-agenda | Gratis API-key; standaard 5.000 calls/dag en 5 calls/seconde; paginering tot 1.000 resultaten. Ticketmaster mag apps beperken die veel calls doen die niet uit gebruikersacties komen | **Gebruiken** |
| **Eventim** (vooral DE) | Eventuele aanvulling | Geen publieke API; alleen onofficiële endpoints/scraping, kan zonder waarschuwing breken | Alleen als venue-site én Ticketmaster tekortschieten |
| **Bandsintown API** | Betere artiest-dekking radar | `app_id` alleen na schriftelijke toestemming | Ralf vraagt aan; inbouwen als toestemming komt |
| **Songkick API** | — | Geen hobby-keys; licentie vanaf ca. $500/maand | **Niet gebruiken** |

### 4.2 Venue-sites uitlezen: aanpak in drie niveaus

Claude Code inventariseert in fase 1 per venue welk niveau mogelijk is en kiest het goedkoopste betrouwbare niveau:

| Niveau | Wat | Onderhoud |
|---|---|---|
| 1. **Gestructureerde data** | Agenda bevat schema.org `Event`-gegevens (JSON-LD, veel sites doen dit voor Google), een iCal-feed of een JSON-endpoint achter de agenda | Laag: één generieke lezer werkt voor alle sites van dit type |
| 2. **Gedeeld platform** | Meerdere venues draaien op hetzelfde systeem (bijv. één exploitant met meerdere zalen) | Middel: één adapter voor meerdere venues |
| 3. **Losse HTML-scraper** | Alleen de zichtbare pagina | Hoog: per site, breekt bij redesign |
| — | Site blokkeert uitlezen (robots.txt, anti-bot, alleen via JavaScript-zware app) | Niet scrapen → Ticketmaster als enige bron |

**Combineren:** voor elke venue worden alle beschikbare bronnen opgehaald en samengevoegd (§7 ontdubbelen). Venue-site levert compleetheid, Ticketmaster levert vaak extra velden (voorverkoopdatum, status, afbeelding, attraction-ID voor volgen).

**Volgorde van bouwen:** eerst Ticketmaster (snel werkend geheel), dan venue-sites op niveau 1, dan 2, en niveau 3 alleen voor venues waar Ticketmaster < 80% dekt.

**API-budget Ticketmaster per dag (schatting):** venue-agenda ~32 venues × ~2 pagina's ≈ 65 calls; radar ≤ 11 personen × ~30 artiesten, ontdubbeld ≈ 200 artiesten × 1–2 calls ≈ 400 calls; zoekopdrachten uit de site (volgen) ≈ 50. **Totaal < 600 per dag**, ruim onder 5.000.

## 5. Architectuur

```
 ┌──────────── GitHub (privé repo) ─────────────┐
 │ GitHub Actions, dagelijks                     │
 │  1. lees favorieten (read-only export, §10)   │
 │  2. haal op: venue-sites + Ticketmaster       │
 │  3. normaliseer, ontdubbel, valideer (Zod)    │
 │  4. schrijf data/events.json + data/radar.json│
 │  5. commit → deploy                           │
 └──────────────────────┬────────────────────────┘
                        │
        Cloudflare Pages (statische site)
        + Pages Functions (kleine server-functies):
          · /api/favorites   lezen/zetten/verwijderen eigen favorieten
          · /api/artist-search  artiest zoeken via Ticketmaster (sleutel blijft op server)
          · /api/favorites-export  alleen voor de dagelijkse run (service-token)
        + Cloudflare D1 (database) met favorieten per persoon
        alles achter Cloudflare Access → wie inlogt = wie je bent
                        │
                 telefoon / laptop
```

Ontwerpprincipes:
- **Agenda statisch, favorieten dynamisch.** De zware data wordt vooraf opgehaald; alleen favorieten zitten in een kleine database.
- **Geen eigen inlogsysteem.** Cloudflare Access laat alleen genodigden binnen (e-mailcode) en geeft de server het e-mailadres van de bezoeker. Dat e-mailadres is de sleutel voor "mijn favorieten". **Te verifiëren** in fase 0.
- **API-sleutels nooit in de browser.** Ophalen gebeurt in GitHub Actions of in Pages Functions met secrets.
- **Git als archief.** `data/*.json` wordt elke run gecommit; zo blijft zichtbaar wat er wanneer veranderde (basis voor latere meldingen).

## 6. Techstack

| Laag | Keuze | Motivatie |
|---|---|---|
| Taal | TypeScript (overal) | Eén taal voor pipeline, server-functies en site |
| Runtime | Node.js (huidige LTS) | Standaard in GitHub Actions |
| Site | Astro (statische output) + React-eilandjes voor filters/zoeken/volgen | Snel, weinig JavaScript |
| Styling | Tailwind CSS | Snel consistent, mobiel-eerst |
| Zoeken | Eigen typfout-tolerante zoekfunctie in de browser (`src/app/search.ts`, B28) | Typo's moeten werken; dataset is klein |
| Validatie | Zod | Brondata wijkt af; valideren voorkomt kapotte site |
| HTML/JSON-LD uitlezen | Cheerio (HTML-parser); Playwright alleen als een site echt JavaScript nodig heeft | Lichtgewicht eerst |
| Server-functies | Cloudflare Pages Functions | Zelfde platform als hosting |
| Database favorieten | Cloudflare D1 | Klein, SQL, gratis tier (**te verifiëren**) |
| Toegang | Cloudflare Access (e-mailcode) | Alleen genodigden + identiteit voor favorieten (**gratis tier te verifiëren**) |
| Scheduler | GitHub Actions `schedule` | Gratis |
| Hosting | Cloudflare Pages | Gratis, deploy uit privé-repo |
| Tests | Vitest | Normaliseren, ontdubbelen, adapters, API-functies |

## 7. Datamodel

```ts
Venue {                       // config/venues.yml
  id: string                  // slug, bijv. "ziggo-dome"
  name: string
  aliases: string[]           // oude namen, sponsornamen
  city: string
  country: "NL" | "BE" | "DE"
  tier: "A" | "B"             // A = arena/stadion, B = middelgroot
  verified: boolean           // false tot fase 1 naam, locatie en bronnen controleert; dan zijn lat/lng/website verplicht
  lat?: number; lng?: number  // verplicht zodra verified
  website?: string            // verplicht zodra verified; alleen http(s)
  sources: {
    ticketmasterVenueIds: string[]
    site?: { level: 1 | 2 | 3; adapter: string; url: string }
  }
}

Event {                       // data/events.json en data/radar.json
  id: string                  // stabiel: hash(venue + datum + genormaliseerde artiest)
  title: string
  artists: { name: string; ticketmasterAttractionId?: string }[]
  venueId: string | null      // null = radar-event buiten venue-lijst
  venueName: string; city: string; country: "NL"|"BE"|"DE"|"GB"|"FR"
  start: string               // ISO 8601 met offset
  hasTime: boolean            // false = alleen datum bekend
  status: "gepland" | "uitverkocht" | "verplaatst" | "geannuleerd"
  onSaleStart?: string
  category: "muziek" | "overig"
  ticketUrl: string           // officiële verkoop of venue-pagina
  imageUrl?: string
  sources: { name: string; sourceId: string; url: string }[]
  firstSeen: string; lastSeen: string
}

Favorite {                    // Cloudflare D1, tabel favorites
  userEmail: string           // uit Cloudflare Access
  artistKey: string           // Ticketmaster attraction-ID, of genormaliseerde naam als die ontbreekt
  artistName: string
  createdAt: string
  // UNIQUE(userEmail, artistKey)
}
```

**Ontdubbelen:** twee events zijn hetzelfde als venue gelijk is, startdatum (lokale dag) gelijk is en de genormaliseerde artiestennaam een gelijkenis van **≥ 0,85** heeft (token-set-vergelijking, kleine letters, zonder leestekens en woorden als "live", "tour", jaartallen). Bij samenvoegen: velden aanvullen, venue-site wint bij titel/tijd, Ticketmaster wint bij status/voorverkoop. Twijfelgevallen loggen in `docs/ontdubbel-twijfel.md`.

**Tijden:** NL/BE/DE/FR in CET/CEST, VK in GMT/BST. Opslaan als ISO met offset, tonen in Europe/Amsterdam met lokale tijd erbij voor VK ("20:00 lokale tijd"). Zonder tijd: alleen datum, nooit "00:00".

## 8. Venue-startlijst (~32 venues)

> Alle namen, steden, URL's en Ticketmaster-ID's worden in fase 1 door Claude Code **geverifieerd** (venues worden regelmatig hernoemd). Resultaat in `config/venues.yml`; Ralf keurt goed.

**Nederland A:** Ziggo Dome, Johan Cruijff ArenA, AFAS Live (Amsterdam) · Rotterdam Ahoy, De Kuip (Rotterdam) · GelreDome (Arnhem) · Goffertpark (Nijmegen, openlucht) · MECC en Vrijthof (Maastricht) · Brabanthallen (Den Bosch) · Megaland (Landgraaf)
**Nederland B:** TivoliVredenburg (Utrecht), 013 (Tilburg), Effenaar (Eindhoven)
**België A:** Sportpaleis en Lotto Arena (Antwerpen) · Vorst Nationaal, Palais 12 (huidige naam verifiëren), Koning Boudewijnstadion (Brussel) · arena Hasselt (voorheen Ethias Arena, huidige naam verifiëren)
**Duitsland A:** LANXESS arena, RheinEnergieStadion, Palladium (Keulen) · PSD Bank Dome, Merkur Spiel-Arena, Mitsubishi Electric Halle (Düsseldorf) · Westfalenhalle, Signal Iduna Park (Dortmund) · Veltins-Arena (Gelsenkirchen) · arena Oberhausen (huidige naam verifiëren) · Grugahalle (Essen) · Sparkassenpark (Mönchengladbach, openlucht)

Venue toevoegen of verwijderen = één blok in `config/venues.yml`, geen code (tenzij een nieuwe niveau-3-scraper nodig is).

## 9. Website: schermen

Mobiel-eerst (vanaf 360 px). Bovenaan elk scherm een **zoekbalk** ("Zoek artiest of zaal").

1. **Overzicht (startscherm)** — tijdlijn: rijen = venues (per land, vlag; filter A/B), kolommen = 12 maanden (horizontaal scrollen). Elk event is een stip, events van gevolgde artiesten vallen op (eigen kleur). Tik op een cel → lijst van die events.
2. **Agenda** — chronologische lijst met vaste maandkoppen. Filters: land, venue, A/B, maand, "alleen mijn artiesten", "alles tonen". Filters onthouden per browser.
3. **Artiest** — alle shows van één artiest: eerst in de venue-agenda, dan "Elders (NL/BE/DE/VK/FR)". Grote knop **☆ Volgen / ★ Volgend**.
4. **Venue** — agenda van één zaal, link naar officiële site.
5. **Mijn radar** — mijn gevolgde artiesten (ontvolgen met één tik) + al hun komende shows chronologisch, met label **Nieuw** voor shows die sinds mijn vorige bezoek zijn verschenen.

**Volgen werkt overal:**
- Op elke eventkaart een ☆ per artiest.
- Zoekt iemand een artiest die niet in de agenda staat (bijv. omdat die nu niet toert), dan toont de zoekbalk ook resultaten uit Ticketmaster ("Artiest niet in agenda — wel volgen?"). Zo kun je de Backstreet Boys volgen vóórdat ze een tour aankondigen.
- Na volgen verschijnen nieuwe shows uiterlijk na de volgende dagelijkse run in "Mijn radar"; de knop zegt dat ook ("Gevolgd — nieuwe shows verschijnen binnen 24 uur").

**Eventkaart:** artiest(en) met ☆ · datum ("za 13 mrt 2027") · venue, stad, vlag · labels **Nieuw**, **Voorverkoop start [datum]**, **Uitverkocht**, **Verplaatst**, **Geannuleerd** · knop "Tickets" naar officiële verkoop · afstand hemelsbreed vanaf Weert (instelbaar per persoon, B-prioriteit).

**Lege en foutstaten:** geen resultaten → "Volg deze artiest, dan zie je het zodra er iets bijkomt"; nog geen favorieten → uitleg + 5 populaire artiesten uit de agenda om te volgen; data ouder dan 36 uur → gele balk "Gegevens niet actueel, laatst bijgewerkt [tijd]"; favorieten-database onbereikbaar → agenda werkt gewoon, ☆-knoppen tonen "Volgen tijdelijk niet beschikbaar". Onderaan: "Laatst bijgewerkt" + bronvermelding.

## 10. Favorieten en radar

- **Opslag:** favorieten per persoon in D1, sleutel = e-mailadres uit Cloudflare Access. Geen wachtwoorden, geen eigen accounts.
- **Identiteit (B15):** het e-mailadres komt alleen uit de gevalideerde Access-token (header `Cf-Access-Jwt-Assertion`: handtekening, `iss`, `aud`, `exp`, `nbf`), nooit uit een losse header. Ontbreekt de configuratie of is de token ongeldig: weigeren (401). Access schermt zowel `<project>.pages.dev` als `*.<project>.pages.dev` af.
- **Artiest koppelen:** volgen gebeurt bij voorkeur op Ticketmaster attraction-ID (voorkomt verwarring met tributebands). Komt de artiest alleen van een venue-site zonder ID, dan op genormaliseerde naam; de dagelijkse run probeert die later aan een ID te koppelen. Meerdere kandidaten → de gebruiker kiest bij volgen uit een kort lijstje (naam + afbeelding).
- **Radar-run:** dagelijks leest GitHub Actions via `/api/favorites-export` (beveiligd met een Cloudflare Access service-token, alleen-lezen) de **unieke** lijst gevolgde artiesten — zonder e-mailadressen — en haalt hun shows in NL/BE/DE/GB/FR op. Resultaat in `data/radar.json`.
- **"Nieuw sinds vorig bezoek":** de browser onthoudt per persoon wanneer "Mijn radar" voor het laatst geopend is (lokaal); shows met `firstSeen` daarna krijgen het label.
- **Limieten:** max 100 gevolgde artiesten per persoon; `/api/artist-search` max 1 verzoek per seconde per persoon en alleen na ≥ 2 getypte tekens.
- **Verwijderen:** ontvolgen verwijdert de rij direct. Verlaat een vriend de groep, dan verwijdert Ralf hem uit Cloudflare Access en Claude Code levert een script `favorites:remove-user <e-mail>`.
- **Klaar voor meldingen later:** `firstSeen` per event + favorieten per persoon is precies wat meldingen nodig hebben; er hoeft dan niets aan het datamodel te veranderen.

## 11. Fases en acceptatiecriteria

Claude Code start pas aan de volgende fase na akkoord van Ralf. Elke fase eindigt met een korte demo-instructie in gewoon Nederlands.

### Fase 0 — Opzet en verificatie
- Repo-structuur, Astro-skelet, TypeScript, Vitest, lint; GitHub Actions draait tests.
- `docs/ACCOUNTS.md` met stap-voor-stap instructies voor Ralf (§15).
- **Verificatie** in `docs/BRONNEN.md`: gratis tiers van Cloudflare Access, Pages Functions en D1 voor 11 gebruikers; dat Pages Functions het e-mailadres van een Access-gebruiker betrouwbaar kunnen uitlezen; of GitHub geplande runs pauzeert bij inactiviteit.
**Klaar als:** `npm test` en `npm run build` slagen lokaal en in GitHub Actions; geen geheimen in de repo; elk te-verifiëren punt heeft een bron en datum, en afwijkingen zijn aan Ralf voorgelegd.

### Fase 1 — Data-fundament
- `venues:resolve`: zoekt Ticketmaster-venue-ID's op; twijfelgevallen in rapport.
- **Bron-inventarisatie** `docs/bronnen-per-venue.md`: per venue welk niveau (§4.2) mogelijk is, robots.txt-status en aantal events op de officiële agenda (komende 3 maanden).
- `fetch` met Ticketmaster-adapter + generieke niveau-1-lezer (JSON-LD / iCal / JSON); normaliseren, ontdubbelen, valideren; schrijft `data/events.json`.
- **Dekkingsrapport** `docs/dekking.md`: per venue aantal events per bron en samen, afgezet tegen de officiële agenda.
- Beveiliging: bron levert < 50% van het vorige aantal → storing: vorige data blijft, gemeld in run-log en statusbestand.
**Klaar als:** alle venues staan in de inventarisatie; ≥ 90% van de bronnen draait zonder fout; < 200 Ticketmaster-calls voor de venue-agenda; run < 10 minuten; unit-tests voor normaliseren, ontdubbelen, niveau-1-lezer en 50%-beveiliging; dekkingsrapport opgeleverd.

### Fase 2 — Website MVP + venue-dekking
- Schermen 1, 2, 3 (zonder volgen en zonder "Elders"), 4 en zoeken uit §9.
- Deploy op Cloudflare Pages achter Access; dagelijkse run ververst data en site.
- Niveau-2- en niveau-3-adapters voor venues die na fase 1 onder de 95% blijven, in volgorde die Ralf kiest; elke adapter met test op een opgeslagen voorbeeldpagina.
**Klaar als:** Lighthouse mobiel Performance ≥ 90 en Accessibility ≥ 90; "backstreet boy" (typfout) vindt "Backstreet Boys" binnen 2 tikken; 360 px zonder horizontaal scrollen van de pagina (tijdlijn mag scrollen); niet-genodigden zien een inlogscherm; ≥ 95% dekking op de steekproef voor alle venues met een bruikbare site.

### Fase 3 — Volgen en radar
> Herzien 26 nov 2026 volgens B39/B42–B44 (geen inlog, geen Ticketmaster). De oorspronkelijke tekst (D1 per e-mailadres, `/api/artist-search`, `/api/favorites-export`, radar-run, `favorites:remove-user`) vervalt.
- ☆/★ per artiest op eventkaarten en de artiestpagina; zoekbalk biedt "Volg “naam”" voor artiesten die niet in de agenda staan.
- Gevolgde artiesten in de browser; koppelcode zet ze over naar een ander apparaat (Worker `src/worker.ts` + D1, routes `/api/sync`).
- Scherm "Mijn radar" (`#radar`) met label **Nieuw**; markering in het overzicht.
**Klaar als:** twee koppelcodes zien elk alleen hun eigen lijst; een artiest zonder geplande shows is te volgen; volgen/ontvolgen ≤ 1 seconde en blijft na herladen en op een ander apparaat (via de code) behouden; een in testdata nieuw verschenen show staat in "Mijn radar" met **Nieuw**; de API weigert ongeldige codes en te grote lijsten (max 100 artiesten); er worden geen e-mailadressen of andere persoonsgegevens opgeslagen; Lighthouse mobiel ≥ 90 en 360 px zonder horizontaal scrollen blijven gehaald.

### Fase 4 — Afwerking
- Afstand vanaf thuis, statuslabels, alle lege/foutstaten, bronvermelding.
- Statuspagina: per bron laatste succesvolle run en aantal events.
**Klaar als:** alle staten uit §9 handmatig getest op telefoon; statuspagina toont elke bron; een bewust kapotgemaakte adapter verschijnt binnen één run als storing.

## 12. Niet-functionele eisen

| Eis | Grens |
|---|---|
| Actualiteit data | ≤ 24 uur; waarschuwing in UI bij > 36 uur |
| Laadtijd | Lighthouse mobiel Performance ≥ 90 |
| Toegankelijkheid | Lighthouse Accessibility ≥ 90 |
| Volgen/ontvolgen | Reactie ≤ 1 seconde |
| Kosten | € 0 per maand |
| Ticketmaster-gebruik | < 1.000 calls/dag totaal, max 4 calls/seconde |
| Scrapen | max 1 verzoek/seconde per site, robots.txt gevolgd |
| Privacy | E-mailadressen alleen in D1 en Cloudflare Access; nooit in repo, export of browser van anderen |
| Beheer | Venue toevoegen zonder code (behalve nieuwe niveau-3-scraper) |

## 13. Risico's en afhankelijkheden

| Risico | Gevolg | Maatregel / alternatief |
|---|---|---|
| Venue-site verandert of blokkeert | Bron valt weg | 50%-beveiliging, adapter-tests, statuspagina; Ticketmaster blijft als tweede bron |
| Veel sites alleen op niveau 3 | Hoog onderhoud | Inventarisatie in fase 1 maakt dit vooraf zichtbaar; Ralf beslist per venue of het de moeite waard is |
| Ticketmaster wijzigt voorwaarden of blokkeert key | Radar valt weg, agenda deels | Venue-sites dragen de agenda; Bandsintown als alternatief voor radar |
| Radar mist shows die niet via Ticketmaster lopen (bijv. Eventim in DE/FR) | Gevolgde artiest lijkt niet te spelen | In regio vangt de venue-site dit op; buiten regio bekende beperking; Bandsintown verkleint gat |
| Verkeerde artiest gekoppeld | Verkeerde shows in radar | Volgen op attraction-ID; keuzelijstje bij meerdere kandidaten |
| Cloudflare Access geeft identiteit niet zoals verwacht | Geen eigen favorieten | Verificatie in fase 0; alternatief: magic-link-login (bijv. Supabase Auth), apart voorleggen |
| Gratis tiers veranderen | Kosten | Verificatie fase 0; data en favorieten exporteerbaar (JSON) |
| Geplande GitHub-runs gepauzeerd | Data veroudert | Docs noemen 60 dagen inactiviteit voor publieke repo's; onze repo is privé en commit dagelijks. Gele balk in UI als vangnet |

## 14. Voorwaarden en netjes gebruik

- Ticketmaster: bronvermelding en link naar officiële eventpagina; branding-richtlijnen volgen (**te verifiëren** fase 1); geen verkoop of doorverkoop.
- Venue-sites: robots.txt respecteren, max 1 verzoek/seconde, eigen User-Agent met contactadres, alleen agenda-pagina's, bronlink bij elk event, niet scrapen als de gebruiksvoorwaarden het verbieden.
- Site blijft achter Cloudflare Access zolang het een vriendenproject is.

## 15. Wat Ralf zelf moet doen

Claude Code schrijft hiervoor `docs/ACCOUNTS.md` met genummerde stappen.
1. GitHub-account + privé-repository.
2. Ticketmaster developer-account → API-key → als GitHub-secret én Cloudflare-secret `TICKETMASTER_API_KEY`.
3. Cloudflare-account → Pages-project koppelen aan repo → D1-database aanmaken → Access instellen met de e-mailadressen van max 10 vrienden → service-token voor de dagelijkse run.
4. Optioneel: Bandsintown `app_id` aanvragen voor persoonlijk, niet-commercieel gebruik.

## 16. Beslissingslog

| # | Beslissing | Motivatie |
|---|---|---|
| B1 | Twee lagen: venue-agenda (regio) + artiest-radar | Alleen regio-agenda had het Backstreet Boys-geval niet opgevangen |
| B2 | Muziek standaard, "alles tonen" als schakelaar | Kerndoel is concerten; schakelaar kost vrijwel niets |
| ~~B3~~ | ~~Ticketmaster primair, scrapers alleen < 80%~~ | Vervangen door B9 |
| B4 | Agenda statisch, Git als archief | Gratis, geen server voor de zware data |
| ~~B5~~ | ~~Watchlists als bestanden, beheer door Ralf~~ | Vervangen door B10 (Ralf: zelf aanklikken) |
| ~~B6~~ | ~~Contactgegevens in GitHub-secret~~ | Vervalt: geen meldingen in deze versie |
| B7 | Songkick niet gebruiken | Geen hobby-keys, licentie te duur |
| B8 | Site achter Cloudflare Access | Kleine kring, geen publieke herpublicatie van brondata |
| B9 | Venue-sites als volwaardige bron naast Ticketmaster, drie niveaus, bronnen samenvoegen | Venue-agenda is compleet ongeacht ticketverkoper; niveau 1 is goedkoop te onderhouden (vraag Ralf) |
| B10 | Volgen met één klik, favorieten per persoon in Cloudflare D1, identiteit via Access | Ralf: zelf aanklikken, eigen favorieten, max 10 vrienden; geen eigen inlogsysteem nodig |
| B11 | Middelgrote zalen (B) vanaf start mee | Antwoord Ralf |
| B12 | Radar beperkt tot NL, BE, DE, VK, FR | Antwoord Ralf |
| B13 | Meldingen naar Later-lijst, datamodel er wel op voorbereid | Antwoord Ralf |
| B14 | Volgen ook mogelijk voor artiesten zonder geplande shows (zoeken via Ticketmaster) | Kern van het Backstreet Boys-probleem: volgen vóór de aankondiging |
| B15 | Identiteit alleen uit gevalideerde Access-token; ook `*.pages.dev` achter Access | Cloudflare-docs adviseren tokenvalidatie; pages.dev-adressen zijn anders onbeschermd (BRONNEN.md, 25 nov 2026) |
| B16 | Alle links in data alleen `http(s)` (schema-validatie) | Voorkomt `javascript:`-links uit brondata in de site; bleek nodig in test |
| B18 | Bouwen in de cloud (Claude-sessie + GitHub), niet op Ralfs pc; ophalen van externe data testen via GitHub Actions | Geen installatie op werk-pc nodig; Actions is ook de omgeving waar de dagelijkse run draait (Ralf, 25 nov 2026) |
| B19 | Fase 1 start met de venue-sites zelf; Ticketmaster wordt toegevoegd zodra de sleutel werkt (dan vooral voor de radar) | Ralf: Ticketmaster lukt nog niet, onderzoek andere manieren (25 nov 2026). Inventarisatie: 26 van 32 venue-sites bereikbaar |
| B20 | Eventim-zoek-API niet gebruiken | robots.txt van public-api.eventim.com verbiedt het (probe 25 nov 2026); harde regel: robots.txt respecteren |
| B21 | Venue-namen bijgewerkt: Sportpaleis → AFAS Dome, Palais 12 → ING Arena, Arena Hasselt → Trixxo Arena, Arena Oberhausen → Rudolf Weber-Arena; id's blijven gelijk | Oude sites verwijzen door / officiële stadssite (BRONNEN.md) |
| B22 | Eén adapter per site of platform met eigen fixture-test; adapters zonder resultaat of met < 50% worden als storing gemeld en houden de vorige data | Uitwerking §4.2 en storingsregel fase 1 |
| B23 | Zalen die elke bot blokkeren (Cloudflare-challenge / captcha) worden nooit omzeild. Ahoy komt binnen via Uitagenda Rotterdam, TivoliVredenburg via UITagenda Utrecht; dit is de vaste route (Ralf, 25 nov 2026) | Ralf: Ahoy en Tivoli moeten erbij (25 nov 2026); de stadsagenda's staan bots toe in robots.txt en krijgen hun data van de zalen zelf |
| B24 | Waar een site zijn agenda zelf als JSON laadt (Ziggo Dome, d.live, be•at, Uitagenda Rotterdam) lezen we die JSON in plaats van de HTML | Niveau 1/2 uit §4.2: stabieler dan HTML-scraping |
| B25 | Ticketmaster-ontwikkelaarsaccount wacht op goedkeuring; tot dan geen radar buiten de venue-lijst | Ralf, 25 nov 2026 |
| B26 | Categorie per event: muziek/overig plus een genre (Concert, Dance, Klassiek, Festival, Comedy, Sport, Show, Familie, Beurs, Lezing). Bron: correctiebestand > categorie van de zaal > woorden in de titel > gok (muziek). Twijfelgevallen in `docs/categorie-twijfel.md` | Ralf: categorie-indeling verbeteren (25 nov 2026) |
| B27 | Overzicht: elk vakje (zaal × maand) toont het aantal events in vijf vaste kleurstappen (1, 2–3, 4–6, 7–10, 11+) in plaats van losse stippen; tikken opent een venster met de shows. Gevolgde artiesten krijgen in fase 3 een markering in het vakje | Drukke zalen hebben 15+ events per maand; losse stippen zijn op 360 px niet leesbaar of aan te tikken. Vaste stappen houden de cijfers leesbaar (contrast) |
| B28 | Zoeken met een eigen zoekfunctie (elk getypt woord moet op een woord van de naam lijken, max. 1–2 typfouten, accenten genegeerd) in plaats van Fuse.js | Proef op de echte agenda: Fuse gaf onzinnige treffers ("ed sheran" → Michael Jackson-tribute, "afas" → Olaf Schubert); de eigen functie niet, en is getest |
| B29 | De site laadt de agenda als apart bestand (`data/agenda.json`, ~85 kB gecomprimeerd) dat bij elke build uit `data/events.json` wordt gemaakt; pagina's zijn `#overzicht`, `#agenda`, `#artiest-<naam>`, `#zaal-<id>`, `#bronnen`. Cloudflare Pages bouwt bij elke push naar main, dus ook na de dagelijkse run | Eén pagina, snel (Lighthouse mobiel 94–99), links naar artiest of zaal zijn deelbaar |
| B30 | Nieuw uiterlijk in de stijl van een concertaffiche (papier, inkt, twee steunkleuren, één smalle letter voor artiesten en data). Overzicht opent met een "line-up" van de komende 30 dagen (grote zalen bovenaan, meeste avonden eerst); de artiestpagina toont de shows als de achterkant van een tourshirt | Ralf vroeg om een ontwerp dat indruk maakt; de vormtaal komt uit de wereld van concerten zelf. Puur weergave, geen nieuwe functie |
| B31 | Muziekgenres (vaste lijst van 11: Pop, Rock, Metal & punk, Hiphop & R&B, Dance & DJ, Nederlandstalig, Schlager, Folk & singer-songwriter, Jazz/soul/blues, Klassiek, Wereld & latin) uit het label van de zaal of woorden in de titel, anders uit de tags van de artiest in MusicBrainz (gratis open database, 1 verzoek/s, cache in `data/artist-genres.json`). Genrefilter in Overzicht en Agenda; geen genre = valt weg bij een genrefilter | Akkoord Ralf 26 nov 2026 (koos "Zalen + MusicBrainz"). Max 2 genres per event; geen gok bij twijfel |
| B32 | 17 Nederlandse zalen erbij: Limburg (De Bosuil, Grenswerk, Muziekgieterij, Nieuwe Nor), grote steden (Paradiso, Melkweg, MartiniPlaza, De Oosterpoort, Doornroosje, Paard, Hedon, Mezz, Patronaat) en dance-locaties (Gashouder, Klokgebouw, Maassilo, Warehouse Elementenstraat) | Akkoord Ralf 26 nov 2026. Bron per zaal volgens §4.2, zelfde regels (robots, 1 verzoek/s, geen blokkades omzeilen) |
| B33 | DJ-feesten via de eigen agenda's van clubs en dance-locaties (B32) en het genre "Dance & DJ"; niet via DJguide | DJguide's robots.txt verbiedt hergebruik door AI en scrapers (Content-Usage: ai=n) en er is geen API; Ralf koos om geen toestemming te vragen |
| B34 | Zalen zonder eigen agenda via een officiële stads- of organisatorbron, zoals al bij Ahoy/Tivoli (B23): De Kuip via Uitagenda Rotterdam, Palladium via koeln.de (stadsportaal), Megaland via de site van Pinkpop (één event per festivaldag met de acts van die dag), Vrijthof via de tourlijst van André Rieu | Ralf: "fix de zalen zonder bron". Alleen bronnen die robots.txt toestaan; geen ticketplatforms of aggregators |
| B35 | "Dance & DJ" krijgt een tweede filterrij met stijlen: Techno, House, Trance, Hardstyle & hardcore, Drum & bass, Disco, EDM (uit label/titel, anders MusicBrainz-tags; max 2) | Verzoek Ralf 26 nov 2026. Stijlen verfijnen alleen Dance; andere gekozen genres blijven gelden |
| B36 | Namen waarop je kunt klikken (acts, zalen) krijgen bij aanwijzen een felroze markeerstift-achtergrond | Verzoek Ralf: duidelijker zien waar je op klikt |
| B37 | Melkweg: bij een botcontrole (AWS-firewall, HTTP 202) vraagt de nachtelijke run het na 2 en na 9 minuten opnieuw; het controlescherm wordt nooit uitgevoerd of opgelost (B23). Lukt het niet, dan blijft de vorige stand staan. Melkweg staat in de verzoekbrief | Verzoek Ralf "lees Melkweg op een andere manier uit"; er is geen andere officiële bron (geen stadsagenda met Melkweg, geen feed) |
| B38 | Geen Ticketmaster voorlopig; de radar beperkt zich tot NL, BE en DE (VK en FR vervallen voor nu). B25 vervalt | Ralf 26 nov 2026: Ticketmaster overbodig voor nu |
| B39 | Geen inlog. Voorkeuren (gevolgde artiesten, filters) staan in de browser; wie ze op een ander apparaat wil, opent één keer zijn persoonlijke koppelcode/link. De server bewaart alleen code → artiesten, zonder e-mailadres. Vervangt de Access-inlog uit B15 | Ralf koos "Browser + koppelcode"; ook nodig voor latere meldingen |
| B40 | Site open maar niet vindbaar: noindex-header, robots.txt "Disallow: /", adres alleen delen met vrienden. Geen Cloudflare Access. Fase 2-eis "niet-genodigden zien een inlogscherm" wordt "de site staat niet in zoekmachines" | Ralf koos "Niet vindbaar, wel open"; er staat alleen openbare agenda-informatie op |
| B41 | Theaters erbij (cabaret, shows): zalen rond Weert/Limburg/Brabant (o.a. De Kattendans Bergeijk), de grote theaters van NL, en waar toegestaan één landelijke theater-/cabaretagenda als bron. Op de site een soortfilter "Theater & cabaret" naast muziek | Ralf 26 nov 2026 |
| B42 | Volgen zonder inlog: lijst in de browser; **koppelcode** van 26 tekens (128 bit willekeurig, zonder I/L/O/U) zet hem over. De server (Worker + D1, door Cloudflare zelf aangemaakt bij de eerste uitrol) bewaart alleen een hash van de code met de artiestnamen; wijzigen kan alleen voor een bestaande code; max 100 artiesten, 120 tekens per naam | Uitwerking B39; zonder hash is een gelekte database ook geen lijst met codes. Gratis: statische bestanden tellen niet mee, D1 100.000 schrijfacties/dag (BRONNEN.md) |
| B43 | Radar = de eigen agenda gefilterd op gevolgde artiesten (NL/BE/DE). Koppeling op de hele naam, dus "Golden Earring Tribute" telt niet als "Golden Earring". `data/radar.json`, `/api/artist-search`, `/api/favorites-export` en `favorites:remove-user` vervallen | Gevolg van B38 (geen Ticketmaster) en B39 (geen e-mail) |
| B44 | "Nieuw" in Mijn radar = eerst gezien ná het vorige bezoek aan Mijn radar (tijdstip lokaal bewaard); elders blijft "Nieuw" = laatste 7 dagen. Vakjes in het overzicht met een gevolgde artiest krijgen een roze rand en ster | Bouwplan §9/§10 en B27 |
| B45 | Theaters (B41) gebouwd: Munttheater, Maaspoort, Theater Heerlen + Theater Kerkrade + Toon Hermans Theater (één site, PLT), De Oranjerie (nieuwe site theaterroermond.nl), Carré, DeLaMar, Stadsschouwburg Utrecht, Schouwburg & Concertzaal Tilburg, Musis & Stadstheater, Theater Rotterdam (via Uitagenda Rotterdam). Geen bron: Parktheater (botcontrole), Theater aan het Vrijthof (zoekapp), Chassé (403, geen stadsagenda) | Verzoek Ralf 26 nov 2026; Kerkrade en Sittard horen bij dezelfde PLT-site en liggen in Limburg (B41) |
| B46 | Melkweg (tweede bron naast B37) en Paradiso via "Uit in Amsterdam" (iamsterdam.com, officiële stadsagenda): alleen de rubrieken concerten en nachtleven met `?page=`, zoals robots.txt toestaat. De GraphQL-sleutel in Paradiso's eigen site wordt niet gebruikt | B23/B34-route; Melkweg stond op 0 events door de botcontrole. Paradiso via deze bron is onvolledig (±57 shows) |
| B47 | De ophaler volgt `Crawl-delay` uit robots.txt (max 10 s) | Netjes gebruik (§14); o.a. Visit Groningen vraagt 2 s |
| B48 | De agenda gaat in twee bestanden naar de browser: `agenda.json` met de komende 30 dagen (eerste scherm) en `agenda-later.json` met de rest, direct daarna geladen. Events krijgen geen id meer in het bestand (de browser nummert ze) | Met de theaters groeide het bestand naar 6.000 events / 337 kB gecomprimeerd en zakte Lighthouse mobiel naar 87–89; de id's alleen waren 80 kB. Vervangt het "één bestand" uit B29 |
| B49 | Clubs: alle drie de routes uit `docs/clubplan.md` — (A) eigen sites van clubs, (B) ticketplatforms van clubs, waaronder TicketSwap (robots.txt verbiedt alleen accountpagina's), (C) Resident Advisor. Partyflock valt af: het weigert elke bot (403 op robots.txt), en dat wordt niet omzeild (B23). Vervangt voor clubs het "geen ticketplatforms of aggregators" uit B34 | Ralf 26 nov 2026: "A, B en C. Ticketswap kan ook een goede bron zijn net zoals Partyflock" |
| B50 | Geen extra Amsterdamse zalen uit Uit in Amsterdam (Concertgebouw, Bimhuis, Muziekgebouw, Stadsschouwburg Amsterdam) | Ralf 26 nov 2026: "Nee" |
| B51 | Uitwerking B49 na controle: (C) Resident Advisor eist vooraf schriftelijke toestemming voor bots (art. 4.4(f)) en valt daarom af zolang die er niet is; (B) TicketSwap toont een botcontrole en Paylogic verbiedt bots in robots.txt, dus alleen open organisatorfeeds zoals WeTicket. Eerste clubs: Complex, Lofi, BASIS, Garage Noord | Codex-onderzoek 26 nov 2026, door Claude nagecontroleerd; harde regel: robots.txt en voorwaarden respecteren, nooit blokkades omzeilen (B23) |
| B52 | Geen toestemming vragen aan Resident Advisor: route C blijft dicht. Wel: zeven clubs met alleen HTML (RADION, Shelter, Thuishaven, EKKO, Dynamo, Annabel, TOFFLER) en de gedeeltelijke stadsagenda's als aanvulling voor zalen zonder eigen bron | Ralf 26 nov 2026: "1. Ja 2. Ja 3. Nee" |
| B17 | Venue-gegevens die nog niet gecontroleerd zijn (`verified: false`) zonder coördinaten/website/ID's | Geen ongecontroleerde feiten in de config; fase 1 vult ze in |

## 17. Aannames (te valideren)

| Aanname | Validatiemoment |
|---|---|
| Een flink deel van de venue-sites biedt niveau-1-data (JSON-LD/iCal/JSON) | Bron-inventarisatie fase 1 |
| ~~Cloudflare Access, Pages Functions en D1 zijn gratis voor 11 gebruikers en dit gebruik~~ | ✅ Bevestigd 25 nov 2026 (BRONNEN.md) |
| Inloggen met e-mailcode (one-time PIN) zit in het gratis plan | Bij instellen Access (ACCOUNTS.md stap 4) |
| ~~Pages Functions kunnen het Access-e-mailadres betrouwbaar uitlezen~~ | ✅ Ja, via tokenvalidatie (B15) |
| ≤ 30 gevolgde artiesten per persoon gemiddeld | Na 4 weken gebruik |
| Eén dagelijkse run is vaak genoeg | Na 4 weken gebruik |

## 18. Later-lijst (bewust niet nu)

| Idee | Waarom later |
|---|---|
| **Meldingen** (e-mail, push, iCal-feed per persoon) | Ralf: later; datamodel is voorbereid (B13) |
| Favorieten importeren uit Spotify/Last.fm | Extra koppeling en toestemmingen |
| Festivals (line-ups) | Andere datastructuur (meerdaags, veel artiesten) |
| Prijzen en beschikbaarheid | Wisselt per uur, veel calls |
| Radar uitbreiden naar meer landen | Eerst ervaring met 5 landen |
| Publiek maken | Herziening voorwaarden, AVG, schaal |
| Archief afgelopen shows | Geen bijdrage aan kerndoel |

## 19. Open vragen

Geen. Antwoorden Ralf (9 okt 2026) verwerkt in B10–B14.
