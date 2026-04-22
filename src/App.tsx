import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Status = 'idle' | 'connected' | 'typing' | 'paused' | 'done'

const SAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. Autotyping mimics natural human cadence by varying delays between keystrokes, occasionally pausing between words and sentences. This makes the output feel like a person is genuinely composing the document in real time.`

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [docTitle, setDocTitle] = useState('Untitled document')
  const [sourceText, setSourceText] = useState(SAMPLE_TEXT)
  const [typed, setTyped] = useState('')
  const [wpm, setWpm] = useState(65)
  const [humanize, setHumanize] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const indexRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const progress = useMemo(() => {
    if (!sourceText.length) return 0
    return Math.min(100, Math.round((typed.length / sourceText.length) * 100))
  }, [typed, sourceText])

  const charsPerMinute = wpm * 5
  const baseDelay = 60000 / charsPerMinute

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  function scheduleNextChar() {
    const i = indexRef.current
    if (i >= sourceText.length) {
      setStatus('done')
      return
    }
    const ch = sourceText[i]
    let delay = baseDelay
    if (humanize) {
      const jitter = (Math.random() - 0.5) * baseDelay * 0.8
      delay = baseDelay + jitter
      if (ch === ' ') delay += Math.random() * 40
      if (ch === '.' || ch === '!' || ch === '?') delay += 250 + Math.random() * 400
      if (ch === ',' || ch === ';') delay += 120 + Math.random() * 200
      if (Math.random() < 0.02) delay += 600 + Math.random() * 800
    }
    timerRef.current = window.setTimeout(() => {
      indexRef.current = i + 1
      setTyped(sourceText.slice(0, indexRef.current))
      scheduleNextChar()
    }, Math.max(8, delay))
  }

  function handleConnect() {
    setGoogleEmail('you@example.com')
    setStatus('connected')
  }

  function handleDisconnect() {
    handleStop()
    setGoogleEmail(null)
    setStatus('idle')
  }

  function handleStart() {
    if (!googleEmail) return
    if (status === 'done') {
      indexRef.current = 0
      setTyped('')
    }
    setStatus('typing')
    scheduleNextChar()
  }

  function handlePause() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setStatus('paused')
  }

  function handleResume() {
    setStatus('typing')
    scheduleNextChar()
  }

  function handleStop() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    indexRef.current = 0
    setTyped('')
    setStatus(googleEmail ? 'connected' : 'idle')
  }

  const statusLabel: Record<Status, string> = {
    idle: 'Not connected',
    connected: 'Ready',
    typing: 'Typing…',
    paused: 'Paused',
    done: 'Complete',
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Drippy</span>
          <span className="brand-tag">Autotyper</span>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={() => setShowSettings((v) => !v)}>
            Settings
          </button>
          {googleEmail ? (
            <button className="ghost" onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button className="primary" onClick={handleConnect}>
              Connect Google
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Source text</h2>
            <span className="muted">{sourceText.length.toLocaleString()} chars</span>
          </div>
          <textarea
            className="source"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Paste your humanized text here…"
            disabled={status === 'typing'}
          />

          {showSettings && (
            <div className="settings">
              <label>
                <span>Speed</span>
                <input
                  type="range"
                  min={20}
                  max={140}
                  value={wpm}
                  onChange={(e) => setWpm(Number(e.target.value))}
                />
                <span className="muted">{wpm} WPM</span>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={humanize}
                  onChange={(e) => setHumanize(e.target.checked)}
                />
                <span>Humanize cadence (jitter, pauses)</span>
              </label>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Target document</h2>
            <span className={`status status-${status}`}>{statusLabel[status]}</span>
          </div>

          <div className="doc-meta">
            <input
              className="doc-title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              disabled={status === 'typing'}
            />
            <div className="doc-account">
              {googleEmail ? (
                <>
                  <span className="dot dot-green" /> {googleEmail}
                </>
              ) : (
                <>
                  <span className="dot dot-gray" /> No Google account
                </>
              )}
            </div>
          </div>

          <div className="doc-page">
            <pre className="doc-content">
              {typed}
              {(status === 'typing' || status === 'paused') && (
                <span className="caret" />
              )}
            </pre>
          </div>

          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-meta muted">
            {typed.length} / {sourceText.length} characters · {progress}%
          </div>

          <div className="controls">
            {status === 'typing' ? (
              <button className="primary" onClick={handlePause}>
                Pause
              </button>
            ) : status === 'paused' ? (
              <button className="primary" onClick={handleResume}>
                Resume
              </button>
            ) : (
              <button
                className="primary"
                onClick={handleStart}
                disabled={!googleEmail || !sourceText.length}
              >
                Start typing
              </button>
            )}
            <button
              className="ghost"
              onClick={handleStop}
              disabled={status === 'idle' || status === 'connected'}
            >
              Stop
            </button>
          </div>
        </section>
      </main>

      <footer className="footnote muted">
        UI scaffold inspired by Grubby.ai's Drippy autotyper. No real Google
        Docs API calls are made.
      </footer>
    </div>
  )
}

export default App
