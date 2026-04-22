import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Status = 'idle' | 'ready' | 'typing' | 'paused' | 'done'

type UploadedDoc = {
  name: string
  size: number
}

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [doc, setDoc] = useState<UploadedDoc | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [targetContent, setTargetContent] = useState('')
  const [typed, setTyped] = useState('')
  const [wpm, setWpm] = useState(65)
  const [humanize, setHumanize] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const indexRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return
    const file = files[0]
    setUploadError(null)
    handleStop()
    setDoc({ name: file.name, size: file.size })
    setStatus(targetContent.trim().length ? 'ready' : 'idle')
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
    setStatus(doc && sourceText.length ? 'ready' : 'idle')
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
    idle: 'No target file',
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
            <h2>Target file + content</h2>
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
                    {formatSize(doc.size)} target file
                  </div>
                </div>
                <button className="ghost small" onClick={handleRemove}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="dropzone-empty">
                <div className="dropzone-icon">↑</div>
                <div className="dropzone-title">Upload target file</div>
                <div className="muted">
                  Drag & drop, or click to browse. This picks the file to write into.
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFiles(e.target.files)}
              hidden
            />
          </div>

          <label className="content-input-wrap">
            <span>Text to write into the uploaded file</span>
            <textarea
              className="content-input"
              value={targetContent}
              onChange={(e) => {
                const nextContent = e.target.value
                setTargetContent(nextContent)
                if (!nextContent.trim().length) {
                  setStatus('idle')
                } else if (doc && status !== 'typing' && status !== 'paused') {
                  setStatus('ready')
                }
              }}
              placeholder="Type the exact content you want written..."
              rows={6}
            />
          </label>

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
            <div className="doc-title-static">{doc?.name ?? 'No target file loaded'}</div>
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
              <button className="primary" onClick={handleStart} disabled={!doc || !sourceText.length}>
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
        UI scaffold inspired by Grubby.ai's Drippy autotyper.
      </footer>
    </div>
  )
}

export default App
