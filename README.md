# Drippy Google Docs Autotyper

This app types text into a live Google Doc through the Google Docs API while showing a local typing preview.

## Setup

1. Create a Google Cloud OAuth client for a web application.
2. Enable the Google Docs API for that project.
3. Add your local dev origin to the OAuth client, for example `http://localhost:5000`.
4. Set `VITE_GOOGLE_CLIENT_ID` before starting Vite.

Example:

```bash
export VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
npm run dev
```

## Usage

1. Click `Connect Google`.
2. Paste a Google Doc URL or document ID.
3. Enter the text you want written into that doc.
4. Click `Start typing`.

If `Replace the document's existing body before typing` is enabled, the app clears the doc body first and then streams the new content in.
