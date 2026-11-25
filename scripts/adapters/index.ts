import { zero13 } from "./013";
import { afasLive } from "./afas-live";
import { beatVenues } from "./beat-venues";
import { dliveVenues } from "./d-live";
import { effenaar } from "./effenaar";
import { gelredome } from "./gelredome";
import { grugahalle } from "./grugahalle";
import { ingArena } from "./ing-arena";
import { johanCruijffArena } from "./johan-cruijff-arena";
import { lanxessArena } from "./lanxess-arena";
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
 * Not active:
 * - tivolivredenburg.ts (direct): tivolivredenburg.nl answers every automated request with a Cloudflare
 *   challenge (since 25 Nov 2026). TivoliVredenburg comes in via uitagendaUtrecht instead (B23).
 *   Re-enable when the venue allows our user agent.
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
