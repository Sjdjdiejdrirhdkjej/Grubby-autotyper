# Drippy Auth-Free Docs Typer

This app provides a no-auth typing workflow for Google Docs:
- local typing simulation and pacing controls inside the app
- a generated helper script you run in an already open Google Docs tab

No API keys, OAuth client IDs, or Google Cloud setup are required.

## Setup

```bash
npm install
npm run dev
```

## Usage

1. Sign into Google in your browser and open the target Google Doc.
2. Click inside the editor where typing should begin.
3. In this app, paste/type your content and tune settings.
4. Click `Copy helper script`.
5. In the Doc tab, open DevTools Console, paste the script, and run it.
6. Keep the tab focused while it types.

## Limitations

- This is browser automation, not a stable API integration.
- Behavior can change if Google Docs editor internals change.
- Some browsers may throttle timers/background tabs aggressively.
- Best support target is current Chrome with the tab kept active.
