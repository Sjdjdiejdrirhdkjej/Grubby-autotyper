import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Humanizer.css'

type Mode = 'GPTZero' | 'Originality' | 'Turnitin' | 'Copyleaks' | 'ZeroGPT'
type Style = 'Simple' | 'Standard' | 'Enhanced'
type Tone = 'Casual' | 'Formal' | 'Academic'

const SAMPLE = `Artificial intelligence has rapidly transformed numerous industries by automating complex tasks and enabling data-driven decision making. In particular, large language models have demonstrated remarkable capabilities in generating coherent text, answering questions, and assisting with creative endeavors. As a result, organizations are increasingly integrating these systems into their workflows to enhance productivity and unlock new opportunities for innovation.`

// Lightweight client-side "humanization" — synonym swaps, contractions,
// punctuation variation, and sentence shuffling. Mocks Grubby's output flow.
const SYNONYMS: Record<string, string[]> = {
  utilize: ['use'], utilizes: ['uses'], utilized: ['used'],
  numerous: ['many', 'lots of', 'plenty of'],
  demonstrate: ['show'], demonstrates: ['shows'], demonstrated: ['shown'],
  remarkable: ['impressive', 'striking', 'notable'],
  rapidly: ['quickly', 'fast'],
  transformed: ['changed', 'reshaped'],
  numerous: ['many', 'a lot of'],
  enabling: ['letting', 'helping'],
  particular: ['specific'],
  capabilities: ['abilities', 'skills'],
  generating: ['producing', 'creating'],
  coherent: ['clear', 'consistent'],
  endeavors: ['efforts', 'projects'],
  organizations: ['companies', 'teams'],
  increasingly: ['more and more', 'more often'],
  integrating: ['adding', 'plugging'],
  workflows: ['processes', 'routines'],
  enhance: ['boost', 'improve'],
  productivity: ['output', 'efficiency'],
  unlock: ['open up', 'reveal'],
  opportunities: ['chances', 'openings'],
  innovation: ['new ideas', 'fresh ideas'],
  furthermore: ['also', 'on top of that'],
  additionally: ['also', 'plus'],
  however: ['but', 'though'],
  therefore: ['so', 'as a result'],
  thus: ['so'],
  moreover: ['also', 'plus'],
  significant: ['big', 'major'],
  important: ['key', 'crucial'],
  individuals: ['people'],
  obtain: ['get'],
  assist: ['help'], assists: ['helps'], assisted: ['helped'],
  attempt: ['try'], attempts: ['tries'], attempted: ['tried'],
  commence: ['start'], commences: ['starts'],
  approximately: ['about', 'around'],
  subsequently: ['then', 'later'],
  prior: ['before'],
}

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdid not\b/g, "didn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bcannot\b/g, "can't"],
  [/\bcan not\b/g, "can't"],
  [/\bwill not\b/g, "won't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bit is\b/g, "it's"],
  [/\bthat is\b/g, "that's"],
  [/\bthere is\b/g, "there's"],
  [/\bI am\b/g, "I'm"],
  [/\byou are\b/g, "you're"],
  [/\bthey are\b/g, "they're"],
  [/\bwe are\b/g, "we're"],
]

function humanize(input: string, style: Style, tone: Tone): string {
  if (!input.trim()) return ''
  let text = input

  // Tone: academic keeps formal vocabulary
  const aggression = style === 'Simple' ? 0.4 : style === 'Standard' ? 0.7 : 1
  const allowContractions = tone !== 'Academic'

  // Synonym swap
  text = text.replace(/\b([A-Za-z]+)\b/g, (word) => {
    const lower = word.toLowerCase()
    const opts = SYNONYMS[lower]
    if (!opts) return word
    if (Math.random() > aggression) return word
    const pick = opts[Math.floor(Math.random() * opts.length)]
    if (word[0] === word[0].toUpperCase()) {
      return pick[0].toUpperCase() + pick.slice(1)
    }
    return pick
  })

  if (allowContractions) {
    for (const [re, rep] of CONTRACTIONS) text = text.replace(re, rep)
  }

  // Sentence-level tweaks
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text]
  const out = sentences.map((s, i) => {
    let t = s.trim()
    if (style === 'Enhanced' && Math.random() < 0.35 && t.length > 40) {
      const parts = t.split(', ')
      if (parts.length > 1) {
        const tail = parts.pop()!
        t = tail.replace(/[.!?]+$/, '') + ', ' + parts.join(', ') + '.'
        t = t[0].toUpperCase() + t.slice(1)
      }
    }
    if (tone === 'Casual' && i > 0 && Math.random() < 0.25) {
      t = ['Honestly, ', 'Basically, ', 'In short, '][Math.floor(Math.random() * 3)] + t[0].toLowerCase() + t.slice(1)
    }
    if (tone === 'Formal' && Math.random() < 0.15) {
      t = 'Notably, ' + t[0].toLowerCase() + t.slice(1)
    }
    return t
  })

  return out.join(' ').replace(/\s+/g, ' ').trim()
}

function countWords(s: string) {
  const t = s.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

const MODES: Mode[] = ['GPTZero', 'Originality', 'Turnitin', 'Copyleaks', 'ZeroGPT']
const STYLES: Style[] = ['Simple', 'Standard', 'Enhanced']
const TONES: Tone[] = ['Casual', 'Formal', 'Academic']

function Humanizer() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<Mode>('GPTZero')
  const [style, setStyle] = useState<Style>('Standard')
  const [tone, setTone] = useState<Tone>('Casual')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const inputWords = useMemo(() => countWords(input), [input])
  const outputWords = useMemo(() => countWords(output), [output])

  async function handleHumanize() {
    if (!input.trim() || loading) return
    setLoading(true)
    setOutput('')
    setProgress(0)
    setCopied(false)
    // Simulated processing time, scaled by input length
    const totalMs = Math.min(4000, 800 + input.length * 4)
    const start = performance.now()
    await new Promise<void>((resolve) => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - start) / totalMs)
        setProgress(p)
        if (p >= 1) resolve()
        else requestAnimationFrame(tick)
      }
      tick()
    })
    setOutput(humanize(input, style, tone))
    setLoading(false)
  }

  async function handlePaste() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setInput(t)
    } catch {
      /* ignore */
    }
  }

  async function handleFile(files: FileList | null) {
    if (!files || !files.length) return
    const file = files[0]
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      setInput(await file.text())
    } else if (lower.endsWith('.pdf')) {
      // Lightweight: pull text by reading bytes; without a parser, advise user.
      alert('PDF parsing requires a backend. Paste your text instead, or use .txt/.md.')
    } else {
      alert('Unsupported file. Use .txt or .md.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCopy() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="hum-app">
      <div className="banner">
        100% Turnitin Bypass Guarantee — or your money back.
      </div>

      <header className="hum-topbar">
        <div className="hum-logo">
          <span className="hum-logo-mark">🤖</span>
          <span className="hum-logo-text">grubby<span className="hum-logo-dot">.</span>ai</span>
        </div>
        <nav className="hum-nav">
          <Link to="/autotyper" className="nav-text">Autotyper</Link>
          <span className="nav-text">Pricing</span>
          <span className="nav-divider" />
          <button className="nav-login">Login</button>
          <button className="nav-cta">Start for free</button>
        </nav>
      </header>

      <section className="hero">
        <h1 className="hero-title">
          Humanize AI text <span className="amp">&amp;</span> bypass AI detectors
        </h1>
        <p className="hero-sub">
          The fastest, most affordable, and least detectable AI humanizer,
          guaranteed to outperform any competitor.
        </p>
      </section>

      <section className="workbench">
        <div className="pane pane-left">
          <div className="pane-header pane-header-input">
            <span className="pane-emoji">🤖</span>
            <span className="pane-title">AI Content</span>
            {input && (
              <span className="word-count">{inputWords.toLocaleString()} words</span>
            )}
          </div>

          <div className="pane-body">
            <textarea
              className="pane-textarea"
              placeholder="Enter your text here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            {!input && (
              <div className="pane-actions">
                <button className="action" onClick={handlePaste}>
                  <span className="action-icon">📋</span> Paste Text
                </button>
                <button className="action" onClick={() => fileRef.current?.click()}>
                  <span className="action-icon">☁️</span> Upload PDF
                </button>
                <button className="action" onClick={() => setInput(SAMPLE)}>
                  <span className="action-icon">👥</span> Try Sample
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  hidden
                  onChange={(e) => handleFile(e.target.files)}
                />
              </div>
            )}
          </div>

          <div className="pane-footer">
            <div className="footer-controls">
              <label className="control">
                <span className="control-label">Mode</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                  {MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="control">
                <span className="control-label">Style</span>
                <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
                  {STYLES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="control">
                <span className="control-label">Tone</span>
                <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                  {TONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <button
              className="humanize-btn"
              disabled={!input.trim() || loading}
              onClick={handleHumanize}
            >
              {loading ? 'Humanizing…' : 'Humanize'}
            </button>
          </div>
        </div>

        <div className="pane pane-right">
          <div className="pane-header pane-header-output">
            <span className="pane-emoji">🧑</span>
            <span className="pane-title">Humanized Content</span>
            {output && (
              <span className="word-count">{outputWords.toLocaleString()} words</span>
            )}
          </div>

          <div className="pane-body output-body">
            {loading ? (
              <div className="loading">
                <div className="loading-bar">
                  <div className="loading-fill" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="loading-text">
                  Rewriting with {mode} bypass · {style} · {tone}…
                </div>
              </div>
            ) : output ? (
              <div className="output-text">{output}</div>
            ) : (
              <div className="output-placeholder">
                Your humanized content will appear here.
              </div>
            )}
          </div>

          {output && !loading && (
            <div className="pane-footer output-footer">
              <button className="action" onClick={handleCopy}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
              <button className="action" onClick={() => setOutput('')}>
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      </section>

      <footer className="hum-footer">
        Demo clone of grubby.ai · Humanization runs locally in your browser
      </footer>
    </div>
  )
}

export default Humanizer
