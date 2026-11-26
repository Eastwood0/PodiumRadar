/** Venues without a working source yet, with the reason in plain Dutch. Shown on the site and in docs/dekking.md. */
export const NO_SOURCE: Record<string, string> = {
  brabanthallen: "De site laat geen automatische bezoekers toe (captcha); toegang is gevraagd.",
  goffertpark: "Openluchtterrein zonder eigen agenda; komt via Ticketmaster.",
  "koning-boudewijnstadion": "Geen eigen concertagenda; komt via Ticketmaster.",
  "mecc-maastricht": "De agenda laadt pas via JavaScript en bevat vooral beurzen en congressen; lage prioriteit.",
  "signal-iduna-park": "De site laadt alles via JavaScript en toont vooral voetbal; komt via Ticketmaster.",
  "nieuwe-nor": "De site weigert automatische bezoekers (403); niet omzeilen (B23).",
  "parktheater-eindhoven": "De site stuurt automatische bezoekers naar een controlescherm (BunnyCDN); niet omzeilen (B23). Andere bron wordt gezocht.",
  "theater-aan-het-vrijthof": "De agenda laadt via een zoekapp (JavaScript, Firebase) zonder open lijst; bron wordt nog gezocht.",
  "warehouse-elementenstraat": "Geen eigen agenda: de zaal wordt verhuurd aan organisatoren; komt via Ticketmaster.",
};
