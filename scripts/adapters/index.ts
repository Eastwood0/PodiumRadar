import { afasLive } from "./afas-live";
import { effenaar } from "./effenaar";
import { johanCruijffArena } from "./johan-cruijff-arena";
import { lanxessArena } from "./lanxess-arena";
import { rheinEnergieStadion, veltinsArena } from "./sitemap-jsonld";
import { tivoliVredenburg } from "./tivolivredenburg";
import type { Adapter } from "./types";

/** All active sources. Add a venue: write an adapter with a fixture test, then list it here. */
export const ADAPTERS: Adapter[] = [afasLive, johanCruijffArena, effenaar, tivoliVredenburg, lanxessArena, veltinsArena, rheinEnergieStadion];
