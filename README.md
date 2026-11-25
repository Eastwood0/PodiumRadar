# Podiumradar

Privé-concertagenda van grote en middelgrote zalen in NL/BE/DE, met een artiest-radar voor NL, BE, DE, VK en FR.

- Wat er gebouwd wordt: [`docs/BOUWPLAN.md`](docs/BOUWPLAN.md)
- Werkafspraken voor Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Wat je zelf moet instellen: [`docs/ACCOUNTS.md`](docs/ACCOUNTS.md)

## Lokaal draaien

Vereist Node.js 22 (zie `.nvmrc`).

```bash
npm install
npm run dev      # site op http://localhost:4321
npm run verify   # lint, typecheck, tests, geheimen-check en build
```
