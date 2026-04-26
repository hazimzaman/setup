# Setup Portal — v1.1

WordPress site deployment portal for Coolify. One-click WP site deploys with custom domain, plugins, and theme.

**New in v1.1:** Light theme polished UI with sidebar nav, analytics dashboard, modern SaaS design.

## Quick Start

### 1. Install dependencies

```powershell
npm install
```

### 2. Create `.env`

```powershell
copy .env.example .env
```

Edit `.env` and fill in:
- `SESSION_SECRET` — long random string (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `ADMIN_USER` — your login username
- `COOLIFY_URL` — your Coolify URL
- `COOLIFY_TOKEN` — Coolify API token
- `COOLIFY_DB_PASS` — Coolify's PostgreSQL password (from `/data/coolify/source/.env` on server)
- `SERVER_UUID`, `PROJECT_UUID` — defaults are filled but verify

### 3. Generate password hash

```powershell
npm run hash YourPasswordHere
```

Copy the line `ADMIN_PASS_HASH=...` into your `.env`.

### 4. Run

Dev mode (auto-reload):

```powershell
npm run dev
```

Production:

```powershell
npm start
```

Open: http://localhost:3000

## Pages

- **`/`** Dashboard with stats, deploy trend chart, status breakdown, recent sites
- **`/deploy`** Deploy form — subdomain, theme picker, plugin checkboxes
- **`/deploy/:id`** Live deployment progress with success/error states
- **`/sites`** All deployed sites with status badges
- **`/login` `/logout`** Auth

## Project structure

```
setup-portal/
├── server.js              Express entry + dashboard API
├── package.json
├── .env                   secrets (don't commit)
├── .env.example           template
├── hash-password.js       generates ADMIN_PASS_HASH
│
├── routes/
│   ├── auth.js            login/logout
│   ├── deploy.js          deploy form + status
│   └── sites.js           sites list
│
├── lib/
│   ├── coolify.js         Coolify API client
│   ├── coolify-db.js      direct Postgres (FQDN fix)
│   └── deploy-flow.js     deploy orchestration
│
├── views/
│   ├── partials/
│   │   ├── header.ejs     sidebar + top
│   │   └── footer.ejs
│   ├── login.ejs
│   ├── dashboard.ejs
│   ├── deploy-form.ejs
│   ├── deploy-status.ejs
│   ├── sites.ejs
│   └── 404.ejs
│
└── public/
    └── styles.css         light theme polished CSS
```

## Notes

- DB connection only works on server (your PC can't reach Coolify Postgres). FQDN-fix step warns silently when running locally.
- Dashboard data API at `/api/dashboard-data` returns JSON for the frontend charts.
- All deployments stored in-memory (lost on restart). For production, swap to DB.

## Next steps

1. Containerize portal as Docker image
2. Deploy via Coolify itself (so DB connection works)
3. Add Cloudflare DNS automation (auto-create A record)
4. Persistent deployments table in Postgres
