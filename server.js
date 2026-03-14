import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'

dotenv.config()

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY fehlt in .env!')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const activeSessions = new Set()

function requireAuth(req, res, next) {
  const token = req.headers['x-session-token']
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Nicht authentifiziert' })
  }
  next()
}

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Stundenlimit erreicht. Bitte später erneut versuchen.' }
})

app.use(express.json({ limit: '20mb' }))
app.use(express.static(join(__dirname, 'public')))
app.use('/branding_assets', express.static(join(__dirname, 'branding_assets')))

// ─── Login ────────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { password } = req.body
  if (password === process.env.APP_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex')
    activeSessions.add(token)
    res.json({ success: true, token })
  } else {
    res.status(401).json({ error: 'Falsches Passwort' })
  }
})

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Erstelle mir auf Basis der Datei ein hochkonvertierendes Videoskript für eine Werbeanzeige. Erstelle vier Varianten für maximale Zielgruppenansprache.`

const FORMAT_INSTRUCTIONS = `Antworte NUR mit den Varianten im folgenden Format. Keine Einleitungen, keine Erklärungen davor oder danach.

VARIANTE 1 — Der Status-Angriff
DIE BEHAUPTUNG:
[Text]
DIE BEGRÜNDUNG:
[Text]
DAS BEISPIEL:
[Text]
DER CALL-TO-ACTION:
[Text]

VARIANTE 2 — Der Effizienz-Hebel
DIE BEHAUPTUNG:
[Text]
DIE BEGRÜNDUNG:
[Text]
DAS BEISPIEL:
[Text]
DER CALL-TO-ACTION:
[Text]

VARIANTE 3 — Der Schmerz-Spiegel
DIE BEHAUPTUNG:
[Text]
DIE BEGRÜNDUNG:
[Text]
DAS BEISPIEL:
[Text]
DER CALL-TO-ACTION:
[Text]

VARIANTE 4 — Der Wunsch-Zustand
DIE BEHAUPTUNG:
[Text]
DIE BEGRÜNDUNG:
[Text]
DAS BEISPIEL:
[Text]
DER CALL-TO-ACTION:
[Text]`

function buildFullPrompt() {
  return FORMAT_INSTRUCTIONS
}

const VARIANT_LABELS = {
  1: 'Der Status-Angriff',
  2: 'Der Effizienz-Hebel',
  3: 'Der Schmerz-Spiegel',
  4: 'Der Wunsch-Zustand'
}

function buildRegenerationPrompt(variantNumbers) {
  const requested = variantNumbers.map(n => `Variante ${n} (${VARIANT_LABELS[n]})`).join(', ')

  const formatParts = variantNumbers.map(n => `VARIANTE ${n} — ${VARIANT_LABELS[n]}
DIE BEHAUPTUNG:
[Text]
DIE BEGRÜNDUNG:
[Text]
DAS BEISPIEL:
[Text]
DER CALL-TO-ACTION:
[Text]`).join('\n\n')

  return `Erstelle NEUE Versionen NUR für: ${requested}.

Antworte NUR mit diesen Varianten im Format:

${formatParts}`
}

// ─── Claude API ───────────────────────────────────────────────────────────────

async function callClaude(imageBase64, mimeType, variantNumbers) {
  const prompt = variantNumbers.length === 4
    ? buildFullPrompt()
    : buildRegenerationPrompt(variantNumbers)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        mimeType === 'application/pdf'
          ? {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: imageBase64
              }
            }
          : {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64
              }
            },
        {
          type: 'text',
          text: prompt
        }
      ]
    }]
  })

  return response.content[0].text
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function extractSection(text, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nextSections = 'DIE BEHAUPTUNG|DIE BEGRÜNDUNG|DAS BEISPIEL|DER CALL-TO-ACTION|VARIANTE\\s+\\d'
  const pattern = new RegExp(
    `${escaped}:?\\s*\\n?([\\s\\S]*?)(?=${nextSections}|$)`,
    'i'
  )
  const match = text.match(pattern)
  return match ? match[1].trim() : ''
}

function parseVariants(text) {
  // Strip markdown bold
  const clean = text.replace(/\*\*/g, '')

  const variants = []
  // Match each variant block
  const variantPattern = /VARIANTE\s+(\d)\s*[—–-]+\s*(.+?)(?=VARIANTE\s+\d|$)/gis
  let match

  while ((match = variantPattern.exec(clean)) !== null) {
    const variantNum = parseInt(match[1])
    const variantBody = match[0]
    const title = match[2].split('\n')[0].trim()

    const behauptung = extractSection(variantBody, 'DIE BEHAUPTUNG')
    const begruendung = extractSection(variantBody, 'DIE BEGRÜNDUNG')
    const beispiel = extractSection(variantBody, 'DAS BEISPIEL')
    const cta = extractSection(variantBody, 'DER CALL-TO-ACTION')

    const fullText = [
      `Die Behauptung:\n${behauptung}`,
      `\nDie Begründung:\n${begruendung}`,
      `\nDas Beispiel:\n${beispiel}`,
      `\nDer Call-to-Action:\n${cta}`
    ].join('\n')

    variants.push({ variantNum, title, behauptung, begruendung, beispiel, cta, fullText })
  }

  if (variants.length === 0) {
    // Fallback: return raw text as single variant
    return [{ variantNum: 1, title: 'Generiertes Skript', behauptung: '', begruendung: '', beispiel: '', cta: '', fullText: clean.trim() }]
  }

  return variants
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const ALLOWED_MIMETYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

app.post('/api/generate', requireAuth, generateLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'imageBase64 und mimeType erforderlich' })
    if (!ALLOWED_MIMETYPES.includes(mimeType)) return res.status(400).json({ error: 'Ungültiger Dateityp' })

    const rawText = await callClaude(imageBase64, mimeType, [1, 2, 3, 4])
    const variants = parseVariants(rawText)
    res.json({ variants })
  } catch (err) {
    console.error('/api/generate error:', err.message)
    res.status(500).json({ error: 'Generierung fehlgeschlagen: ' + err.message })
  }
})

app.post('/api/regenerate', requireAuth, generateLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType, variantNumbers } = req.body
    if (!imageBase64 || !mimeType || !Array.isArray(variantNumbers) || variantNumbers.length === 0) {
      return res.status(400).json({ error: 'Ungültige Anfrage' })
    }
    if (!ALLOWED_MIMETYPES.includes(mimeType)) return res.status(400).json({ error: 'Ungültiger Dateityp' })

    const rawText = await callClaude(imageBase64, mimeType, variantNumbers)
    const variants = parseVariants(rawText)
    res.json({ variants })
  } catch (err) {
    console.error('/api/regenerate error:', err.message)
    res.status(500).json({ error: 'Regenerierung fehlgeschlagen: ' + err.message })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`ScriptForge läuft auf Port ${PORT}`))
