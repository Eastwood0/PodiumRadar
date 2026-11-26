# Wat Ralf zelf moet doen

Alles hieronder is gratis. Sleutels en wachtwoorden zet je **alleen** in de genoemde instellingen, nooit in een bestand of in een chat.
Stappen 1–3 zijn nodig vóór fase 1. Stap 4 en 5 kunnen wachten tot fase 2 en 3; stap 6 is optioneel.

## 1. GitHub: privé-repository

1. Log in op github.com (of maak een account aan).
2. Klik rechtsboven op **+** → **New repository**.
3. Naam: `podiumradar`. Kies **Private**. Vink niets anders aan (geen README, geen .gitignore).
4. Klik **Create repository**.
5. Geef Claude toegang tot de repo; Claude zet de code erin.
6. Controleer het tabblad **Actions**: de workflow **CI** moet groen worden. Dat is het bewijs dat tests en build ook bij GitHub slagen.

✅ Gedaan op 25 november 2026: repo `Eastwood0/PodiumRadar`, CI groen.

## 2. Ticketmaster: API-sleutel

1. Ga naar developer.ticketmaster.com en maak een account aan.
2. Open na het inloggen **My Apps**. Er staat een standaard-app met een **Consumer Key**. Dat is de API-sleutel.
3. Ga in GitHub naar je repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
4. Name: `TICKETMASTER_API_KEY`, Secret: plak de Consumer Key. Klik **Add secret**.
5. Meer hoeft niet: het ophalen draait in GitHub Actions en leest de sleutel daar. (Alleen als je ooit lokaal wilt testen: kopieer `.env.example` naar `.env` en plak de sleutel achter het `=`-teken; `.env` wordt nooit geüpload.)

## 3. Cloudflare: account

1. Maak een gratis account aan op dash.cloudflare.com.
2. Meer hoeft nu niet. De rest volgt in stap 4 en 5.

## 4. Cloudflare: website online (nu)

Geen inlog (B40): de site is open voor wie het adres heeft, maar niet vindbaar in zoekmachines.

1. Log in op dash.cloudflare.com en klik links op **Workers & Pages**.
2. Klik **Create application** → tabblad **Pages** → **Connect to Git**.
3. Kies **GitHub**, log in als dat gevraagd wordt en kies bij de toegang voor de repository **PodiumRadar** (alleen deze is genoeg). Klik **Install & Authorize** en daarna **Begin setup**.
4. Vul in bij **Set up builds and deployments**:
   - **Project name**: bijvoorbeeld `podiumradar` (dit wordt het adres: `podiumradar.pages.dev`; is de naam bezet, kies iets anders)
   - **Production branch**: `main`
   - **Framework preset**: **Astro**
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - Verder niets invullen.
5. Klik **Save and Deploy**. Wacht tot de bouw klaar is (een paar minuten) en klik **Continue to project**. Daar staat het adres van de site.
6. Zet testversies uit (scheelt bouwbeurten): in het project → **Settings** → **Builds** (of **Builds & deployments**) → **Branch control** → zet **Preview branch** op **None**. Opslaan.
7. Open het adres op je telefoon en computer en stuur het naar je vrienden. Stuur het ook naar Claude Code, dan controleer ik de live site.

Vanaf nu zet Cloudflare elke wijziging op main automatisch online, ook de nieuwe agenda van de nachtelijke run.

Let op: Cloudflare maakt hier tegenwoordig een "Worker" van met als deploy-opdracht `npx wrangler deploy`. Dat is goed: het bestand `wrangler.jsonc` in de repo zegt dat alleen de map `dist` online moet (statische site, geen code op de server). Laat de deploy-opdracht zoals hij is.

## 5. Cloudflare: database voor de koppelcodes (vóór fase 3, volgt nog)

Claude Code geeft je in fase 3 de exacte stappen; globaal gaat het om:
1. Een D1-database aanmaken en koppelen aan het Pages-project.
2. `TICKETMASTER_API_KEY` ook als geheime variabele in het Pages-project zetten.
3. Een **service token** maken in Zero Trust, zodat de dagelijkse run (alleen-lezen) de lijst gevolgde artiesten mag ophalen.

## 6. Optioneel: Bandsintown

1. Vraag via help.bandsintown.com een `app_id` aan voor persoonlijk, niet-commercieel gebruik door een kleine vriendengroep.
2. Krijg je toestemming, zet de `app_id` dan als GitHub-secret `BANDSINTOWN_APP_ID` en meld het aan Claude Code.
