# Verzoek om toegang voor Podiumradar

Drie zalen tonen elke geautomatiseerde bezoeker een controlescherm (Cloudflare of captcha). Podiumradar omzeilt dat niet. Ahoy en TivoliVredenburg lezen we vast via de culturele stadsagenda's (B23); deze brief is vooral nog nodig voor Brabanthallen. Voor Tivoli kan hij de dekking vergroten (de stadsagenda loopt minder ver vooruit).

Stuur onderstaande tekst naar het algemene contactadres van de zaal (te vinden op hun site). Vul je eigen naam in.

| Zaal | Wat de site doet | Huidige oplossing |
|---|---|---|
| Rotterdam Ahoy | Cloudflare-controle op alle pagina's | Uitagenda Rotterdam |
| TivoliVredenburg | Cloudflare-controle op agenda, sitemap en API | UITagenda Utrecht (ongeveer een kwart van het programma) |
| Brabanthallen | Captcha op de agenda | nog geen |

---

**Onderwerp:** Toegang voor een klein, niet-commercieel agendaproject

Beste [zaal],

Ik bouw voor mezelf en een paar vrienden een privé-overzicht van concerten in de grote zalen in Nederland en de grensregio, zodat we geen optredens meer missen. Het is niet openbaar, niet commercieel en verkoopt geen tickets; elke show linkt naar jullie eigen site en ticketverkoop.

Daarvoor leest een programma één keer per dag jullie agenda, met hooguit één verzoek per seconde, en het houdt zich aan robots.txt. Het stelt zich voor als:

`Mozilla/5.0 (compatible; PodiumradarBot/0.1; +https://github.com/Eastwood0/PodiumRadar)`

Jullie beveiliging houdt dit programma op dit moment tegen. Zouden jullie deze user agent willen toestaan, of hebben jullie een feed (bijvoorbeeld iCal, JSON of RSS) die ik kan gebruiken?

Met vriendelijke groet,
[naam]
