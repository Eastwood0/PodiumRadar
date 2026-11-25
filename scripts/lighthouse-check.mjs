/**
 * Fase 2-eis: Lighthouse mobiel Performance ≥ 90 en Accessibility ≥ 90. Leest de rapporten in .lighthouse/
 * en faalt als een pagina onder de grens zit. Gebruikt in .github/workflows/ci.yml.
 */
import { readdirSync, readFileSync } from "node:fs";

const MIN = 0.9;
let failed = false;
for (const file of readdirSync(".lighthouse").filter((f) => f.endsWith(".json"))) {
  const r = JSON.parse(readFileSync(`.lighthouse/${file}`, "utf8"));
  const perf = r.categories.performance.score;
  const a11y = r.categories.accessibility.score;
  const ok = perf >= MIN && a11y >= MIN;
  if (!ok) failed = true;
  console.log(`${ok ? "OK  " : "FOUT"} ${r.finalDisplayedUrl}  performance ${Math.round(perf * 100)}  accessibility ${Math.round(a11y * 100)}`);
}
process.exit(failed ? 1 : 0);
