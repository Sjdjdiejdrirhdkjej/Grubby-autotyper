import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Status = 'idle' | 'ready' | 'typing' | 'paused' | 'done'

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type TokenClient = {
  requestAccessToken: (options: { prompt: '' | 'consent' }) => void
}

type GoogleDoc = {
  id: string
  title: string
  link: string
  endIndex: number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
            error_callback?: (error: { message?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents'

function getDocumentId(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const urlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed

  return null
}

function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [googleReady, setGoogleReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [docInput, setDocInput] = useState('')
  const [targetDoc, setTargetDoc] = useState<GoogleDoc | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [targetContent, setTargetContent] = useState('')
  const [typed, setTyped] = useState('')
  const [wpm, setWpm] = useState(65)
  const [humanize, setHumanize] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [replaceExisting, setReplaceExisting] = useState(true)

  const indexRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const flushTimerRef = useRef<number | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const remoteIndexRef = useRef(1)
  const pendingRemoteTextRef = useRef('')
  const flushInFlightRef = useRef(false)

  const sourceText = targetContent
  const hasDocId = Boolean(getDocumentId(docInput))

  const progress = useMemo(() => {
    if (!sourceText.length) return 0
    return Math.min(100, Math.round((typed.length / sourceText.length) * 100))
  }, [typed, sourceText])

  const charsPerMinute = wpm * 5
  const baseDelay = 60000 / charsPerMinute

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    if (window.google?.accounts.oauth2) {
      setGoogleReady(true)
      return
    }

    const pollId = window.setInterval(() => {
      if (window.google?.accounts.oauth2) {
        setGoogleReady(true)
        window.clearInterval(pollId)
      }
    }, 200)

    return () => window.clearInterval(pollId)
  }, [])

  useEffect(() => {
    if (status === 'typing' || status === 'paused') return
    setStatus(hasDocId && sourceText.length ? 'ready' : 'idle')
  }, [hasDocId, sourceText, status])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current)
    }
  }, [])

  function clearTimers() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current)
    timerRef.current = null
    flushTimerRef.current = null
  }

  function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  async function requestAccessToken(prompt: '' | 'consent') {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Set VITE_GOOGLE_CLIENT_ID before connecting Google Docs.')
    }
    if (!window.google?.accounts.oauth2) {
      throw new Error('Google Sign-In is still loading. Try again in a moment.')
    }

    const token = await new Promise<string>((resolve, reject) => {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DOCS_SCOPE,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || 'Google authorization failed.'))
            return
          }
          resolve(response.access_token)
        },
        error_callback: (error) => {
          reject(new Error(error.message || 'Google authorization failed.'))
        },
      })

      client.requestAccessToken({ prompt })
    })

    accessTokenRef.current = token
    setSignedIn(true)
    return token
  }

  async function ensureAccessToken() {
    if (accessTokenRef.current) return accessTokenRef.current
    return requestAccessToken('consent')
  }

  async function googleFetch(url: string, init?: RequestInit) {
    const token = await ensureAccessToken()
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init?.body) headers.set('Content-Type', 'application/json')

    const response = await fetch(url, {
      ...init,
      headers,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Google API request failed (${response.status}).`)
    }

    return response
  }

  async function loadTargetDoc() {
    const docId = getDocumentId(docInput)
    if (!docId) {
      throw new Error('Paste a valid Google Doc URL or document ID.')
    }

    const response = await googleFetch(`https://docs.googleapis.com/v1/documents/${docId}`)
    const payload = (await response.json()) as {
      title?: string
      body?: { content?: Array<{ endIndex?: number }> }
    }

    const content = payload.body?.content ?? []
    const endIndex = content.length ? content[content.length - 1].endIndex ?? 1 : 1

    const doc = {
      id: docId,
      title: payload.title || 'Untitled Google Doc',
      link: `https://docs.google.com/document/d/${docId}/edit`,
      endIndex,
    }

    setTargetDoc(doc)
    return doc
  }

  async function replaceDocContents(doc: GoogleDoc) {
    if (!replaceExisting || doc.endIndex <= 1) {
      remoteIndexRef.current = Math.max(1, doc.endIndex - 1)
      return
    }

    await googleFetch(`https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: doc.endIndex - 1,
              },
            },
          },
        ],
      }),
    })

    remoteIndexRef.current = 1
  }

  async function flushRemoteText(force = false) {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }

    if (flushInFlightRef.current) return
    if (!pendingRemoteTextRef.current) return
    if (!force && pendingRemoteTextRef.current.length < 12) {
      flushTimerRef.current = window.setTimeout(() => {
        void flushRemoteText(true)
      }, 250)
      return
    }

    const chunk = pendingRemoteTextRef.current
    pendingRemoteTextRef.current = ''
    flushInFlightRef.current = true

    try {
      const docId = getDocumentId(docInput)
      if (!docId) throw new Error('The Google Doc target is missing.')

      await googleFetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: {
                  index: remoteIndexRef.current,
                },
                text: chunk,
              },
            },
          ],
        }),
      })

      remoteIndexRef.current += chunk.length
    } catch (error) {
      pendingRemoteTextRef.current = chunk + pendingRemoteTextRef.current
      clearTimers()
      setStatus('paused')
      setErrorMessage(getErrorMessage(error))
    } finally {
      flushInFlightRef.current = false
      if (pendingRemoteTextRef.current) void flushRemoteText(force)
    }
  }

  function queueRemoteText(text: string) {
    pendingRemoteTextRef.current += text

    if (text === '\n' || text === '.' || text === '!' || text === '?') {
      void flushRemoteText(true)
      return
    }

    if (pendingRemoteTextRef.current.length >= 12) {
      void flushRemoteText(true)
      return
    }

    if (!flushTimerRef.current) {
      flushTimerRef.current = window.setTimeout(() => {
        void flushRemoteText(true)
      }, 250)
    }
  }

  function scheduleNextChar() {
    const i = indexRef.current
    if (i >= sourceText.length) {
      setStatus('done')
      void flushRemoteText(true)
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
      queueRemoteText(ch)
      scheduleNextChar()
    }, Math.max(8, delay))
  }

  async function handleConnectGoogle() {
    setErrorMessage(null)

    try {
      await requestAccessToken(accessTokenRef.current ? '' : 'consent')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleStart() {
    if (!hasDocId || !sourceText.length) return

    clearTimers()
    pendingRemoteTextRef.current = ''
    indexRef.current = 0
    setTyped('')
    setErrorMessage(null)

    try {
      const doc = await loadTargetDoc()
      await replaceDocContents(doc)
      setStatus('typing')
      scheduleNextChar()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setStatus('ready')
    }
  }

  function handlePause() {
    clearTimers()
    void flushRemoteText(true)
    setStatus('paused')
  }

  function handleResume() {
    setErrorMessage(null)
    setStatus('typing')
    scheduleNextChar()
  }

  function handleStop() {
    clearTimers()
    void flushRemoteText(true)
    indexRef.current = 0
    setTyped('')
    pendingRemoteTextRef.current = ''
    setStatus(hasDocId && sourceText.length ? 'ready' : 'idle')
  }

  const statusLabel: Record<Status, string> = {
    idle: 'Waiting',
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
          <span className="brand-tag">Google Docs</span>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost"
            onClick={handleConnectGoogle}
            disabled={!GOOGLE_CLIENT_ID || !googleReady}
          >
            {signedIn ? 'Reconnect Google' : 'Connect Google'}
          </button>
          <button className="ghost" onClick={() => setShowSettings((v) => !v)}>
            Settings
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Target doc + content</h2>
            <span className={`status ${signedIn ? 'status-connected' : ''}`}>
              {signedIn ? 'Google connected' : 'Google not connected'}
            </span>
          </div>

          <label className="content-input-wrap">
            <span>Google Doc URL or document ID</span>
            <input
              className="content-input"
              value={docInput}
              onChange={(e) => {
                setDocInput(e.target.value)
                setTargetDoc(null)
              }}
              placeholder="https://docs.google.com/document/d/.../edit"
            />
          </label>

          <label className="content-input-wrap">
            <span>Text to write into the Google Doc</span>
            <textarea
              className="content-input"
              value={targetContent}
              onChange={(e) => setTargetContent(e.target.value)}
              placeholder="Type the exact content you want written..."
              rows={8}
            />
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            <span>Replace the document's existing body before typing</span>
          </label>

          {!GOOGLE_CLIENT_ID && (
            <div className="error">
              Add <code>VITE_GOOGLE_CLIENT_ID</code> to your environment before using Google Docs.
            </div>
          )}

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
            <div className="doc-title-static">{targetDoc?.title ?? 'No Google Doc loaded yet'}</div>
          </div>
          {targetDoc && (
            <a className="doc-link muted" href={targetDoc.link} target="_blank" rel="noreferrer">
              Open live document
            </a>
          )}

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
                disabled={!signedIn || !hasDocId || !sourceText.length}
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
        Uses Google Identity Services plus the Google Docs API to write into a live document.
      </footer>
    </div>
  )
}

export default App
