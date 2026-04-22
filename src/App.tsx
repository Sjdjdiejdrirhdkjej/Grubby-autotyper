import { useEffect, useMemo, useRef, useState } from 'react'
import mammoth from 'mammoth'
import './App.css'

type Status = 'idle' | 'ready' | 'typing' | 'paused' | 'done'

type UploadedDoc = {
  name: string
  text: string
  size: number
}

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [doc, setDoc] = useState<UploadedDoc | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [typed, setTyped] = useState('')
  const [wpm, setWpm] = useState(65)
  const [humanize, setHumanize] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const indexRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sourceText = doc?.text ?? ''

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

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return
    const file = files[0]
    setUploadError(null)
    setUploading(true)
    handleStop()
    try {
      const lower = file.name.toLowerCase()
      let text = ''
      if (lower.endsWith('.docx')) {
        const buf = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        text = result.value
      } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        text = await file.text()
      } else if (lower.endsWith('.doc')) {
        throw new Error('Legacy .doc not supported. In Google Docs use File → Download → Microsoft Word (.docx).')
      } else {
        throw new Error('Unsupported file. Upload a .docx (Google Docs export), .txt, or .md file.')
      }
      text = text.replace(/\r\n/g, '\n').trim()
      if (!text.length) throw new Error('That document is empty.')
      setDoc({ name: file.name, text, size: file.size })
      setStatus('ready')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err))
      setDoc(null)
      setStatus('idle')
    } finally {
      setUploading(false)
    }
  }

  function handleStart() {
    if (!doc) return
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
    setStatus(doc ? 'ready' : 'idle')
  }

  function handleRemove() {
    handleStop()
    setDoc(null)
    setStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatSize(n: number) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(2)} MB`
  }

  const statusLabel: Record<Status, string> = {
    idle: 'No document',
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
          <span className="brand-tag">Autotyper</span>
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
            <h2>Source document</h2>
            {doc && <span className="muted">{sourceText.length.toLocaleString()} chars</span>}
          </div>

          <div
            className={`dropzone ${dragOver ? 'drag' : ''} ${doc ? 'has-doc' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFiles(e.dataTransfer.files)
            }}
            onClick={() => !doc && fileInputRef.current?.click()}
          >
            {doc ? (
              <div className="file-card">
                <div className="file-icon">DOC</div>
                <div className="file-info">
                  <div className="file-name">{doc.name}</div>
                  <div className="muted">
                    {formatSize(doc.size)} · {sourceText.length.toLocaleString()} chars
                  </div>
                </div>
                <button className="ghost small" onClick={handleRemove}>
                  Remove
                </button>
              </div>
            ) : uploading ? (
              <div className="dropzone-empty">
                <div className="dropzone-icon">…</div>
                <div>Reading document…</div>
              </div>
            ) : (
              <div className="dropzone-empty">
                <div className="dropzone-icon">↑</div>
                <div className="dropzone-title">Upload your Google Doc</div>
                <div className="muted">
                  Drag & drop, or click to browse. Accepts .docx, .txt, .md
                </div>
                <div className="muted hint">
                  In Google Docs: File → Download → Microsoft Word (.docx)
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,.md"
              onChange={(e) => handleFiles(e.target.files)}
              hidden
            />
          </div>

          {uploadError && <div className="error">{uploadError}</div>}

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
            <div className="doc-title-static">{doc?.name ?? 'No document loaded'}</div>
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
              <button className="primary" onClick={handleStart} disabled={!doc}>
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
        UI scaffold inspired by Grubby.ai's Drippy autotyper. Documents are
        parsed locally in your browser.
      </footer>
    </div>
  )
}

export default App
