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

## Files
- `src/App.tsx` — main UI + autotyper state machine
- `src/App.css` — styling
