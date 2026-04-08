# pkdb-page — Chrome Extension

Chrome extension that converts the current page to PDF and uploads it to the Google Drive `Scans` folder, where PKDB's `sync_and_ingest.sh` picks it up for ingestion by Marian.

## Setup

### 1. Create Google Cloud OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable the **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Application type: **Chrome Extension**
6. Enter the extension ID (shown on `chrome://extensions` after loading unpacked)
7. Copy the **Client ID**

### 2. Configure the Extension

Edit `manifest.json` and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with the actual client ID.

### 3. Load the Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this directory
4. Note the extension ID, go back to step 1.6 if needed

## How It Works

1. Click the extension icon on any page
2. Review the auto-generated filename (date + page title slug)
3. Click **Capture & Upload to Scans**
4. Extension uses Chrome Debugger Protocol (`Page.printToPDF`) to generate a PDF
5. Uploads to Google Drive `Scans` folder via Drive API v3
6. PKDB's cron job (`sync_and_ingest.sh`) picks it up within 10 minutes

## Key Files

- `manifest.json` — Extension manifest (Manifest V3)
- `background.js` — Service worker: PDF generation + Drive upload
- `popup.html` / `popup.js` — Popup UI
- `icons/` — Extension icons
