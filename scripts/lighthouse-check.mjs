/**
 * Fase 2-eis: Lighthouse mobiel Performance ≥ 90 en Accessibility ≥ 90. Leest de rapporten in .lighthouse/
 * (meerdere runs per pagina), neemt per pagina de mediaan en faalt als een pagina onder de grens zit.
 * Gebruikt in .github/workflows/ci.yml.
 */
import { readdirSync, readFileSync } from "node:fs";

const MIN = 0.9;
const median = (xs) => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)];
const byPage = new Map();
for (const file of readdirSync(".lighthouse").filter((f) => f.endsWith(".json"))) {
  const r = JSON.parse(readFileSync(`.lighthouse/${file}`, "utf8"));
  const list = byPage.get(r.finalDisplayedUrl) ?? [];
  list.push({ perf: r.categories.performance.score, a11y: r.categories.accessibility.score });
  byPage.set(r.finalDisplayedUrl, list);
}
let failed = false;
for (const [url, runs] of byPage) {
  const perf = median(runs.map((r) => r.perf));
  const a11y = median(runs.map((r) => r.a11y));
  const ok = perf >= MIN && a11y >= MIN;
  if (!ok) failed = true;
  const all = runs.map((r) => Math.round(r.perf * 100)).join("/");
  console.log(`${ok ? "OK  " : "FOUT"} ${url}  performance ${Math.round(perf * 100)} (runs ${all})  accessibility ${Math.round(a11y * 100)}`);
}
process.exit(failed ? 1 : 0);
