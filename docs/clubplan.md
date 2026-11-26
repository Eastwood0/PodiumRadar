# Clubplan: meer DJ-avonden in de agenda (voorstel, 26 november 2026)

**Status: voorstel voor Ralf. Er is nog niets gebouwd.**

Ralf vroeg om "meer clubs voor een goed gevulde DJ-kalender (Complex, Pixl, etc.)". Dit plan zet op een rij welke clubs erbij kunnen, hoe we hun agenda netjes ophalen en wat dat kost aan onderhoud. Kies hieronder een route; daarna bouw ik.

## Wat er nu al is
- **Dance-locaties met eigen bron:** Gashouder, Klokgebouw, Maassilo, Effenaar, Doornroosje, 013, Paard, Patronaat, Muziekgieterij, Grenswerk.
- **Sinds vandaag:** de clubavonden van de Melkweg (Techno Tuesday, Cheeky Monday…) via Uit in Amsterdam.
- **Filters:** genre "Dance & DJ" met stijlen Techno, House, Trance, Hardstyle, Drum & bass, Disco en EDM (B35).
- **Wat we niet gebruiken:**
  - **DJguide:** robots.txt verbiedt het (B33).
  - **Partyflock:** weigert elke bot (403 op robots.txt, gecontroleerd 26 nov 2026).
  - **"PIXL":** dat was een pop-up in het Klokgebouw (april–mei 2025). Die zou via de Klokgebouw-bron al meekomen.

## Kandidaat-clubs (eerste controle 26 nov 2026)

| Club | Stad | Waarom | Bron (eerste blik) |
|---|---|---|---|
| Complex | Maastricht | Grote technoclub (1.680 bezoekers), dichtbij Weert | Eigen site, robots.txt staat het toe; geen gestructureerde data op de homepage → agendapagina nader bekijken |
| Lofi | Amsterdam | Techno/house, elk weekend | Eigen site met **JSON-LD** (19 events op de homepage, met Weeztix-ticketlink) → goedkoop |
| Shelter | Amsterdam | Techno onder de A'DAM-toren | Eigen site, robots ok; geen JSON-LD → HTML of eigen JSON zoeken |
| Radion | Amsterdam | Club + concerten | Eigen site, robots ok; geen JSON-LD |
| Thuishaven | Amsterdam | Openlucht/loods-feesten | Eigen site, robots ok; geen JSON-LD |
| Annabel | Rotterdam | Club + hiphop | Eigen site, robots ok; geen JSON-LD |
| Perron | Rotterdam | Techno | Eigen site, robots ok; geen JSON-LD |
| Ekko | Utrecht | Club/concerten | Eigen site, robots ok; geen JSON-LD |
| Toffler, Garage Noord, BASIS | Rotterdam / Amsterdam / Utrecht | Bekende clubs | Site verwijst door of reageerde niet; nader onderzoeken |

Elke club wordt een "zaal" op de site (middelgroot, B), met een eigen adapter, test en de bekende regels: robots.txt volgen, max. 1 verzoek per seconde en geen botcontrole omzeilen.

## Drie routes

**A. Eigen agenda's van de clubs (aanrader)**
- **Hoe:** per club de eigen site, zoals bij alle zalen nu. Eerst Lofi (JSON-LD, klein werk) en Complex (regio).
- **Plus:** officiële bron, voldoet aan B23/B34, compleet per club.
- **Min:** per club een adapter; HTML-sites kunnen breken bij een nieuw ontwerp. Schatting: 8 clubs ≈ 1 werkdag, daarna af en toe onderhoud.

**B. Ticketplatform-pagina's van de clubs (Weeztix, Eventix, Paylogic)**
- **Hoe:** veel clubs verkopen via één platform; één adapter per platform kan dan meerdere clubs bedienen.
- **Plus:** minder adapters.
- **Min:** B34 sluit ticketplatforms uit; de voorwaarden moeten per platform gecontroleerd worden; niet elke club staat er volledig op. Dit vraagt een nieuwe beslissing van Ralf.

**C. Resident Advisor (ra.co)**
- **Hoe:** één bron met bijna alle clubavonden van Nederland.
- **Plus:** in één keer heel veel dekking, inclusief line-ups.
- **Min:** RA is een aggregator (B34: niet gebruiken). De voorwaarden verbieden automatisch ophalen "voor commerciële doeleinden"; wij zijn niet commercieel, maar het blijft een grijs gebied. Er is geen publieke API. Dit vraagt ook een nieuwe beslissing.

**Advies:** route A, te beginnen met Complex en Lofi en daarna de Amsterdamse en Rotterdamse clubs. Zo blijft alles binnen de bestaande afspraken. Volstaat de dekking daarna niet, dan kijken we opnieuw naar B.

## Wat ik van Ralf nodig heb
1. Welke route (A, B of C)?
2. Klopt de clublijst, en mist er een club die je belangrijk vindt (bijvoorbeeld in Limburg of Brabant)?
