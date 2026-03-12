# CLAUDE.md — ScriptForge

## Projekt-Überblick
ScriptForge ist ein Tool zur automatischen Generierung von Short-Form Content Skripten.
Der Nutzer lädt ein Bild oder PDF seiner Relevanzmatrix hoch — Claude analysiert das Dokument
und erstellt 4 fertige Skript-Varianten nach dem BBB-Schema (Behauptung, Begründung, Beispiel)
plus Call-to-Action. Optimiert für A/B-Tests auf Social Media.

## Technischer Stack
- Frontend: Single HTML file (`public/index.html`)
- Backend: Node.js + Express (kein Socket.io — kein Echtzeit-Bedarf)
- KI: Anthropic Claude API (`claude-sonnet-4-6`) mit Vision (Base64-Bild)
- UI: 100% Deutsch, Blueprint Summit Design System
- Kein Puppeteer / PDF-Export

## Lokales Testen
```
cd "/Users/julian/Claude Coding/ScriptForge"
npm install
node server.js
```
→ http://localhost:3002 · Passwort: `blueprint2026`

## Passwort & Sicherheit
- APP_PASSWORD=blueprint2026 (in .env, nie hardcoden)
- ANTHROPIC_API_KEY=... (in .env, nie hardcoden)
- .env ist in .gitignore

## App-Ablauf
1. Nutzer loggt sich mit Passwort ein
2. Upload-View: Relevanzmatrix als PNG, JPG oder PDF hochladen (max. 10 MB)
3. Bilder werden client-seitig auf max. 1500px skaliert und als JPEG komprimiert
4. POST /api/generate → Claude analysiert das Bild → 4 Skript-Varianten
5. Results-View: 4 Variant-Cards mit Behauptung / Begründung / Beispiel / CTA
6. Aktionen: Einzelne Varianten kopieren, ausgewählte neu generieren, alle als .txt laden
7. "Neue Analyse starten" → zurück zu Upload

## API Routes

### POST /api/login
- Body: `{ password: string }`
- Response: `{ success: true }` oder 401

### POST /api/generate
- Body: `{ imageBase64: string, mimeType: string }`
- Erlaubte mimeTypes: image/png, image/jpeg, image/gif, image/webp, application/pdf
- Response: `{ variants: Variant[] }`

### POST /api/regenerate
- Body: `{ imageBase64: string, mimeType: string, variantNumbers: number[] }`
- Regeneriert nur die angegebenen Varianten-Nummern (1–4)
- Response: `{ variants: Variant[] }`

## Variant-Objekt
```json
{
  "variantNum": 1,
  "title": "Der Status-Angriff",
  "behauptung": "...",
  "begruendung": "...",
  "beispiel": "...",
  "cta": "...",
  "fullText": "Die Behauptung:\n...\n\nDie Begründung:\n..."
}
```

## Prompt-Struktur
- System Prompt: Praxisinhaber & Copywriter für High-Performance Short-Form Content
- User Prompt: Bild (Base64) + Aufgabe mit strikter Skript-Struktur
- 4 Varianten mit psychologisch unterschiedlichem Schwerpunkt:
  1. Der Status-Angriff (Provokation des aktuellen Selbstbildes)
  2. Der Effizienz-Hebel (geringer Aufwand, schnelles Ergebnis)
  3. Der Schmerz-Spiegel (negativer Kontext, Status Quo)
  4. Der Wunsch-Zustand (Pull-Motivation, positiver Kontext)
- Schreibregel: max. 13 Wörter pro Satz, kein KI-Slang, Expertenstil

## Parsing
- Server parst Claude-Antwort mit Regex nach VARIANTE-Blöcken
- Strips markdown bold (`**`)
- Fallback: roher Text als einzelne Variante wenn Parsing fehlschlägt

## Design System
- Identisch mit Blueprint Summit Mirror of Influence
- Background: `#072330` (Deep Navy) + SVG Topo-Overlay (Ellipsen)
- Teal: `#00E9B9` · Cyan: `#5CE1E6`
- Cards: Glassmorphism `rgba(255,255,255,0.05)` + `backdrop-filter: blur(12px)`
- Buttons: Gradient Teal→Cyan, `border-radius: 999px`
- Fonts: Unbounded (Headings) + Noto Sans Display (Body)

## Dateistruktur
```
ScriptForge/
├── server.js           ✅
├── public/index.html   ✅
├── branding_assets/    ✅ (kopiert vom Blueprint Summit Projekt)
├── .env                ✅ (APP_PASSWORD + ANTHROPIC_API_KEY + PORT=3002)
├── .gitignore          ✅
├── package.json        ✅
├── node_modules/       (nach npm install)
└── CLAUDE.md           ✅ (diese Datei)
```

## Deployment (ausstehend)
- GitHub Repo erstellen (public oder private)
- Railway Deployment einrichten (gleiche Methode wie Mirror of Influence)
- Environment Variables in Railway setzen: APP_PASSWORD, ANTHROPIC_API_KEY, PORT
- gh CLI verfügbar: `/Users/julian/Downloads/gh_2.88.0_macOS_amd64/bin/gh`

## Nächste Schritte (offen)
- [ ] GitHub Repo erstellen
- [ ] Railway Deployment einrichten
- [ ] Custom Domain (z.B. scriptforge.blueprint-summit.de)
- [ ] ANTHROPIC_API_KEY in .env eintragen (aktuell: YOUR_KEY_HERE)
