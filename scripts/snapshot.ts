/**
 * Saves raw pages (politely: robots.txt, 1 request per second per site) so adapters and fixtures can be
 * written from the cloud workspace, which cannot reach venue sites itself. Used by .github/workflows/snapshot.yml;
 * the result goes to branch "snapshots", never to main.
 *   SNAPSHOT_URLS="https://a.nl/agenda https://b.nl/" npm run snapshot
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { politeGet } from "./lib/http";

const urls = (process.env.SNAPSHOT_URLS ?? "").split(/\s+/).filter(Boolean);
mkdirSync("snapshots", { recursive: true });
const index: string[] = [];
await Promise.all(
  urls.map(async (url) => {
    const r = await politeGet(url);
    const name = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9.]+/gi, "_").slice(0, 120);
    const ext = r.contentType.includes("json") ? "json" : r.contentType.includes("xml") ? "xml" : "html";
    if (r.body) writeFileSync(`snapshots/${name}.${ext}`, r.body);
    index.push(`${r.robotsBlocked ? "ROBOTS" : r.status} ${url} → ${r.finalUrl} (${r.body.length} bytes, ${r.contentType}) ${name}.${ext}`);
  }),
);
writeFileSync("snapshots/index.txt", index.sort().join("\n") + "\n");
console.log(index.join("\n"));
