import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Status = 'idle' | 'ready' | 'typing' | 'paused' | 'done'

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [targetContent, setTargetContent] = useState('')
  const [typed, setTyped] = useState('')
  const [wpm, setWpm] = useState(65)
  const [humanize, setHumanize] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [helperCopied, setHelperCopied] = useState(false)

  const indexRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const sourceText = targetContent

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

  function clearTimers() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  function getDelayForChar(ch: string) {
    let delay = baseDelay
    if (humanize) {
      const jitter = (Math.random() - 0.5) * baseDelay * 0.8
      delay = baseDelay + jitter
      if (ch === ' ') delay += Math.random() * 40
      if (ch === '.' || ch === '!' || ch === '?') delay += 250 + Math.random() * 400
      if (ch === ',' || ch === ';') delay += 120 + Math.random() * 200
      if (Math.random() < 0.02) delay += 600 + Math.random() * 800
    }
    return Math.max(8, delay)
  }

  function scheduleNextChar() {
    const i = indexRef.current
    if (i >= sourceText.length) {
      setStatus('done')
      return
    }

    const ch = sourceText[i]
    timerRef.current = window.setTimeout(() => {
      indexRef.current = i + 1
      setTyped(sourceText.slice(0, indexRef.current))
      scheduleNextChar()
    }, getDelayForChar(ch))
  }

  function buildHelperScript() {
    const delays: number[] = []
    for (const ch of sourceText) delays.push(Math.round(getDelayForChar(ch)))

    const escapedText = JSON.stringify(sourceText)
    const escapedDelays = JSON.stringify(delays)

    return `(async () => {
  const text = ${escapedText};
  const delays = ${escapedDelays};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const target = document.activeElement;
  if (!target) {
    alert('Focus the Google Docs editor first.');
    return;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (typeof document.execCommand === 'function') {
      document.execCommand('insertText', false, ch);
    } else if (target.isContentEditable) {
      target.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true }));
      target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ch, bubbles: true }));
    }
    await sleep(delays[i] || 20);
  }
})();`
  }

  async function handleStart() {
    if (!sourceText.length) return
    clearTimers()
    indexRef.current = 0
    setTyped('')
    setStatus('typing')
    scheduleNextChar()
  }

  function handlePause() {
    clearTimers()
    setStatus('paused')
  }

  function handleResume() {
    setErrorMessage(null)
    setStatus('typing')
    scheduleNextChar()
  }

  function handleStop() {
    clearTimers()
    indexRef.current = 0
    setTyped('')
    setStatus(sourceText.length ? 'ready' : 'idle')
  }

  async function copyHelperScript() {
    setErrorMessage(null)
    setHelperCopied(false)
    if (!sourceText.length) {
      setErrorMessage('Add text first so there is content to type.')
      return
    }

    try {
      await navigator.clipboard.writeText(buildHelperScript())
      setHelperCopied(true)
    } catch {
      setErrorMessage('Clipboard copy failed. Allow clipboard access and try again.')
    }
  }

  const statusLabel: Record<Status, string> = {
    idle: 'No content',
    ready: 'Ready',
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
          <span className="brand-tag">Manual Docs Mode</span>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={() => setShowSettings((v) => !v)}>
            Settings
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Manual Google Docs run</h2>
            <span className="status status-connected">No auth required</span>
          </div>

          <label className="content-input-wrap">
            <span>Text to write into the Google Doc</span>
            <textarea
              className="content-input"
              value={targetContent}
              onChange={(e) => {
                setTargetContent(e.target.value)
                if (status === 'idle' || status === 'ready') {
                  setStatus(e.target.value.length ? 'ready' : 'idle')
                }
              }}
              placeholder="Type the exact content you want written..."
              rows={8}
            />
          </label>

          <div className="instructions">
            <div className="instruction-title">How to run in an already-open Google Doc</div>
            <ol>
              <li>Open your Google Doc and click where typing should begin.</li>
              <li>Click <code>Copy helper script</code> below.</li>
              <li>In the Doc tab, open DevTools Console and paste + run it.</li>
            </ol>
            <div className="muted">
              This is best-effort browser automation. Keep the tab focused while it runs.
            </div>
            <button className="ghost" onClick={copyHelperScript} disabled={!sourceText.length}>
              {helperCopied ? 'Copied helper script' : 'Copy helper script'}
            </button>
          </div>

          {errorMessage && <div className="error">{errorMessage}</div>}

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
            <h2>Live typing</h2>
            <span className={`status status-${status}`}>{statusLabel[status]}</span>
          </div>

          <div className="doc-meta">
            <div className="doc-title-static">Preview only (local simulation)</div>
          </div>

          <div className="doc-page">
            <pre className="doc-content">
              {typed}
              {(status === 'typing' || status === 'paused') && <span className="caret" />}
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
                disabled={!sourceText.length}
              >
                Start typing
              </button>
            )}
            <button
              className="ghost"
              onClick={handleStop}
              disabled={status === 'idle' || status === 'ready'}
            >
              Stop
            </button>
          </div>
        </section>
      </main>

      <footer className="footnote muted">
        No API or OAuth setup: relies on your active Google Docs browser session.
      </footer>
    </div>
  )
}

export default App
