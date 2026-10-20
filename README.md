# ftp_website_deployer

Uploads a local build folder to a webhost over FTP. Overwrite-only — files are
added or replaced, never deleted remotely.

## Setup

    npm install
    copy example.env .env     # macOS/Linux: cp example.env .env

## Configure

- `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` — required
- `FTP_PORT` — default `21`
- `LOCAL_DIR` — default `public`
- `REMOTE_ROOT` — default `/www`
- `EXCLUDE` — optional extra globs, comma-separated

## Deploy

    npm run deploy

Requires Node 22.9+. Plain FTP only (no FTPS).
