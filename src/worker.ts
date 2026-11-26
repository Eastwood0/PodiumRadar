/**
 * Cloudflare Worker (wrangler.jsonc "main"). Only /api/* reaches it (`run_worker_first`); everything else is a
 * static file. The API itself is in src/lib/sync-api.ts. A Worker module may only export handlers, so nothing else
 * is exported here.
 */
import { type Env, fail, handleApi } from "./lib/sync-api";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      return await handleApi(req, env, url);
    } catch (e) {
      console.error("api", e);
      return fail(503, "tijdelijk niet beschikbaar");
    }
  },
};
