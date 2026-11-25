// Fails when the repository contains something that looks like a secret or a personal e-mail address.
// Run: npm run check:secrets. Also runs in CI (CLAUDE.md, "Harde regels").
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

/** Domains that may appear in e-mail addresses in the repo (documentation, examples, tooling). */
const ALLOWED_EMAIL_DOMAINS = ["example.com", "example.org", "notify.cloudflare.com", "anthropic.com", "users.noreply.github.com"];

const KEY_ASSIGNMENT = /(api[_-]?key|apikey|secret|token|password|client[_-]?secret)\b["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{16,})/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const SKIP_FILES = new Set(["package-lock.json"]);

/** Returns human-readable findings for one file's text. */
export function findSecrets(text) {
  const findings = [];
  for (const m of text.matchAll(KEY_ASSIGNMENT)) {
    findings.push(`mogelijke sleutel bij "${m[1]}"`);
  }
  for (const m of text.matchAll(EMAIL)) {
    const domain = m[1].toLowerCase();
    if (!ALLOWED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      findings.push(`e-mailadres met domein "${domain}"`);
    }
  }
  return findings;
}

/** Files that would be committed: tracked plus untracked-but-not-ignored. */
function candidateFiles() {
  return execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function main() {
  const problems = [];
  for (const file of candidateFiles()) {
    const name = basename(file);
    if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) {
      problems.push(`${file}: .env-bestand hoort niet in de repo`);
      continue;
    }
    if (SKIP_FILES.has(name)) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // deleted or unreadable
    }
    if (text.includes("\u0000")) continue; // binary
    for (const f of findSecrets(text)) problems.push(`${file}: ${f}`);
  }
  if (problems.length) {
    console.error("Mogelijke geheimen gevonden:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("Geen geheimen gevonden.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
