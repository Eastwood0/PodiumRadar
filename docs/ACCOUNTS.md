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

## 4. Cloudflare: website online en afgeschermd (nu, voor fase 2)

1. In het Cloudflare-dashboard: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → kies de repo `podiumradar`.
2. Build-instellingen: framework **Astro**, production branch `main`, build command `npm run build`, output directory `dist`. Verder niets invullen (de Node-versie staat al in de repo). Klik **Save and Deploy**. Vanaf nu zet Cloudflare elke wijziging op main automatisch online, ook de nieuwe agenda van de dagelijkse run.
3. Noteer het adres dat je krijgt (`<naam>.pages.dev`).
4. Ga naar **Zero Trust** (links in het menu). Kies bij de vraag om een plan het **Free**-plan en een teamnaam. Noteer de teamnaam.
5. **Integrations** → **Identity providers** → voeg **One-time PIN** toe. *Controleer hier of dit op het gratis plan beschikbaar is; zo niet, meld het aan Claude Code.*
6. **Access** → **Applications** → **Add an application** → **Self-hosted**. Vul **twee** adressen in: `<naam>.pages.dev` én `*.<naam>.pages.dev`. Dat laatste schermt ook de testversies af.
7. Voeg een regel (policy) toe: **Allow**, **Emails**, met jouw e-mailadres en dat van maximaal 10 vrienden.
8. Open de applicatie opnieuw → **Additional settings** → kopieer de **Application Audience (AUD) Tag**. Claude Code vraagt hier in fase 3 om, samen met de teamnaam.
9. Test: open het adres in een privévenster. Je moet een inlogscherm zien. Na het invullen van je e-mailadres krijg je een code.

## 5. Cloudflare: database en sleutel voor de dagelijkse run (vóór fase 3)

Claude Code geeft je in fase 3 de exacte stappen; globaal gaat het om:
1. Een D1-database aanmaken en koppelen aan het Pages-project.
2. `TICKETMASTER_API_KEY` ook als geheime variabele in het Pages-project zetten.
3. Een **service token** maken in Zero Trust, zodat de dagelijkse run (alleen-lezen) de lijst gevolgde artiesten mag ophalen.

## 6. Optioneel: Bandsintown

1. Vraag via help.bandsintown.com een `app_id` aan voor persoonlijk, niet-commercieel gebruik door een kleine vriendengroep.
2. Krijg je toestemming, zet de `app_id` dan als GitHub-secret `BANDSINTOWN_APP_ID` en meld het aan Claude Code.
