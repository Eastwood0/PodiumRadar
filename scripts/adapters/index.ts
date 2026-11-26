import { zero13 } from "./013";
import { afasLive } from "./afas-live";
import { beatVenues } from "./beat-venues";
import { dliveVenues } from "./d-live";
import { effenaar } from "./effenaar";
import { gashouder } from "./gashouder";
import { gelredome } from "./gelredome";
import { grugahalle } from "./grugahalle";
import { hedon } from "./hedon";
import { ingArena } from "./ing-arena";
import { johanCruijffArena } from "./johan-cruijff-arena";
import { muziekgieterij, paard } from "./jsonld-page";
import { lanxessArena } from "./lanxess-arena";
import { melkweg } from "./melkweg";
import { rudolfWeberArena } from "./rudolf-weber-arena";
import { rheinEnergieStadion, veltinsArena } from "./sitemap-jsonld";
import { sparkassenpark } from "./sparkassenpark";
import type { Adapter } from "./types";
import { uitagendaRotterdam } from "./uitagenda-rotterdam";
import { uitagendaUtrecht } from "./uitagenda-utrecht";
import { westfalenhalle } from "./westfalenhalle";
import { ziggoDome } from "./ziggo-dome";

/**
 * All active sources. Add a venue: write an adapter with a fixture test, then list it here.
 *
 * Rotterdam Ahoy and TivoliVredenburg are read through the city culture agendas (uitagendaRotterdam,
 * uitagendaUtrecht); their own sites block all automated visitors (B23, Ralf's choice 25 Nov 2026).
 *
 * No source yet (see docs/dekking.md): Brabanthallen (bot challenge), De Kuip, Goffertpark, Megaland, Vrijthof and
 * Koning Boudewijnstadion (no agenda of their own), MECC (dates not in its API), Palladium, Signal Iduna Park.
 */
export const ADAPTERS: Adapter[] = [
  // Nederland
  ziggoDome,
  johanCruijffArena,
  afasLive,
  uitagendaRotterdam,
  gelredome,
  zero13,
  effenaar,
  uitagendaUtrecht,
  // Nederland, toegevoegd 26 nov 2026 (B32/B33)
  melkweg,
  muziekgieterij,
  gashouder,
  paard,
  hedon,
  // Maassilo zit in uitagendaRotterdam
  // België
  ...beatVenues, // AFAS Dome, Lotto Arena, Vorst Nationaal, Trixxo Arena
  ingArena,
  // Duitsland
  lanxessArena,
  rheinEnergieStadion,
  ...dliveVenues, // PSD Bank Dome, Merkur Spiel-Arena, Mitsubishi Electric Halle
  westfalenhalle,
  veltinsArena,
  rudolfWeberArena,
  grugahalle,
  sparkassenpark,
];
