import { zero13 } from "./013";
import { afasLive } from "./afas-live";
import { effenaar } from "./effenaar";
import { gelredome } from "./gelredome";
import { johanCruijffArena } from "./johan-cruijff-arena";
import { lanxessArena } from "./lanxess-arena";
import { rheinEnergieStadion, veltinsArena } from "./sitemap-jsonld";
import type { Adapter } from "./types";
import { uitagendaRotterdam } from "./uitagenda-rotterdam";
import { uitagendaUtrecht } from "./uitagenda-utrecht";
import { ziggoDome } from "./ziggo-dome";

/**
 * All active sources. Add a venue: write an adapter with a fixture test, then list it here.
 *
 * Not active:
 * - tivolivredenburg.ts (direct): tivolivredenburg.nl answers every automated request with a Cloudflare
 *   challenge (since 25 Nov 2026). TivoliVredenburg comes in via uitagendaUtrecht instead (B23).
 *   Re-enable when the venue allows our user agent.
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
  // Duitsland
  lanxessArena,
  veltinsArena,
  rheinEnergieStadion,
];
