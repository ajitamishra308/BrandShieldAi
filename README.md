# BrandShield AI

Brand-governance platform that checks content against approved guidelines and facts **before it is published**.
Built by team **Tech Girly** for TechCircuit (problem statement by Inkloom AI).

Every finding cites the rule or approved fact behind it, suggested fixes keep the writer's purpose, and people make the final decision.

## Status (Round 2, work in progress)

| Part | State |
|---|---|
| Database, roles and security rules | Done (Stage 1) |
| Login with demo accounts, dashboard, service status | Done (Stage 1) |
| Rules engine, fact matching, AI review | Next |
| Campaign review screen, cross-channel mismatch, expiry check | Next |
| Comments, approvals, revision history, impact view | Next |

This file is updated as features are completed. Only finished features are listed as done.

## How it fits together

```
Browser (React + Vite + Tailwind, on Vercel)
   |-- sign-in, comments, approvals --> Supabase (PostgreSQL + Auth, row-level security by role)
   |-- "review this draft" ----------> Review service (Python FastAPI, on Render)
                                          |-- rules and fact matching (plain code)
                                          |-- AI analysis (Gemini free tier, replaceable)
                                          |-- validation (rejects any finding without a real source)
                                          |-- reads/writes findings in Supabase
```

Roles: **creator, manager, reviewer, admin**. Admins manage rules and facts; managers and reviewers approve.

## Run it on your computer

You need: Node.js (LTS), Python 3.11 or newer, Git, and a free Supabase account.

### 1. Database (Supabase)

1. Create a project at supabase.com (free plan is enough).
2. Open **SQL Editor**, then run these files from the `database/` folder, in order: `schema.sql`, then `seed.sql`.
3. Open **Authentication -> Users -> Add user -> Create new user** and create four users with **Auto Confirm User** ticked, all with the same demo password:
   `creator@brandshield.demo`, `manager@brandshield.demo`, `reviewer@brandshield.demo`, `admin@brandshield.demo`.
4. Back in the SQL Editor, run `demo_users.sql`. This gives each user a name and role.
5. Open **Project Settings -> API** and note the project URL, the public (anon or publishable) key and the secret (service role) key.

### 2. Review service (Python)

```
cd review-service
python -m venv .venv
# Windows:  .venv\Scripts\activate        Mac/Linux:  source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env      (Mac/Linux: cp .env.example .env)
# open .env and fill in the Supabase values
uvicorn app.main:app --reload --port 8000
```

Check it: open http://localhost:8000/health. It should show `"database": "ok"`.

### 3. Frontend (React)

```
cd frontend
npm install
copy .env.example .env      (Mac/Linux: cp .env.example .env)
# open .env and fill in the Supabase URL and public key; use the same demo password
npm run dev
```

Open http://localhost:5173 and click a demo account.

## Deploying (free tiers)

- **Review service on Render** (Web Service): root directory `review-service`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add the environment variables from `review-service/.env.example`, with `ALLOWED_ORIGINS` set to the frontend's address.
- **Frontend on Vercel**: root directory `frontend`, framework Vite. Add the `VITE_` variables, with `VITE_REVIEW_API_URL` set to the Render address.
- Free Render services sleep when idle, and free Supabase projects pause after a week without activity. A free uptime monitor calling `/health` every 10 minutes keeps both awake.

## Security notes

- Secret keys live only in `.env` files on the server side and are ignored by Git.
- The browser only ever receives the public Supabase key; what a user can read or change is limited by row-level security rules in `database/schema.sql`.
- Demo accounts exist only in the demo database and hold no real data. Only fictional sample data (the "FreshJuice" brand kit) is used.

## AI and tools used

See [docs/AI_AND_TOOLS.md](docs/AI_AND_TOOLS.md).
