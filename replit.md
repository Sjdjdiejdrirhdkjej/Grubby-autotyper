# Drippy Autotyper UI Scaffold

React + TypeScript + Vite scaffold inspired by Grubby.ai's "Drippy" autotyper feature.

## What it does
A frontend-only mock of an autotyper that streams text into a Google Doc-style preview at a human-like pace (per-char delays with jitter, longer pauses on punctuation, occasional "thinking" pauses).

UI flow:
- Connect Google (mocked)
- Paste source text
- Adjust speed (WPM) + humanize toggle in Settings
- Start / Pause / Resume / Stop typing into the simulated doc

No real Google Docs API or OAuth calls are made.

## Stack
- Vite + React 18 + TypeScript
- Plain CSS

## Dev
- Workflow `Start application` runs `npm run dev` on port 5000
- `vite.config.ts` sets host `0.0.0.0`, port `5000`, `allowedHosts: true` for the Replit proxy

## Document input
The user opted out of Google authentication entirely. Instead, users upload
their Google Doc (exported as .docx) or .txt/.md files. Parsing is done
client-side with the `mammoth` package — no backend required.

## Routes
- `/` — Humanizer page (clone of grubby.ai's main humanizer UI). Mock
  humanization is done client-side: synonym swaps, contractions, sentence
  re-ordering, with Mode / Style / Tone selectors. No API.
- `/autotyper` — original Drippy autotyper (manual mode, no Google auth).

## Files
- `src/main.tsx` — BrowserRouter + routes
- `src/pages/Humanizer.tsx` / `.css` — grubby.ai homepage clone
- `src/pages/Autotyper.tsx` / `.css` — autotyper UI
