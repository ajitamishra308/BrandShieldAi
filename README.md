# BrandShield AI

Brand-governance platform that checks content against approved guidelines and facts **before it is published**.
Built by team **Tech Girly** for TechCircuit (problem statement by Inkloom AI).

Every finding cites the rule or approved fact behind it, suggested fixes keep the writer's purpose, and people make the final decision.

## What works now (Round 2, Stage 2)

| Feature | State |
|---|---|
| Login with roles (creator, manager, reviewer, admin) and one-click demo accounts / demo link | Done |
| Brand kit: rules, approved facts (source, owner, valid-until) and banned terms; admin can edit | Done |
| Campaigns with content for several channels, versions of every draft | Done |
| Review engine (rules, no AI): brand-name spelling, banned terms, health claims, superlatives, emojis and shouting by channel, prices, discounts, delivery terms and counts compared with approved facts, missing offer end date, ingredient claims, expired or soon-to-expire facts | Done |
| Contradictions between channels of one campaign (for example 20% off in one item, 15% in another) | Done |
| Findings with explanation, cited source and suggested fix; accept, apply fix, or dismiss with a reason | Done |
| Send for approval, comments, approve or request changes, revision history and audit log | Done |
| Impact view: which content uses which fact, and what needs a new review after a fact changed or expired | Done |
| AI review (Gemini) for claims the rules cannot judge, with validation of every AI finding | Next (Stage 3) |
| Image and accessibility checks, insights, document import (Round 3 improvements) | Round 3 |

Only finished features are listed as done.

## How a review works

1. The creator submits a draft (text for a channel) inside a campaign.
2. The Python review service reads the brand kit and checks the draft. Plain code does the exact checks (numbers, dates, words); nothing is flagged without a source: a brand rule (G-x), an approved fact (F-x), the banned-terms list, or the other items of the campaign.
3. Each finding has a status (verified, contradicts an approved fact, campaign mismatch, expired fact, rule violation, unsupported claim, needs human check), a priority, an explanation and, where possible, a replacement text.
4. The creator accepts, applies or dismisses each finding (dismissals need a reason). High-priority findings must be decided before the draft can be sent for approval.
5. A manager or reviewer approves or requests changes. Everything is recorded in the history.

The AI never publishes, approves or edits anything on its own.

## How it fits together

```
Browser (React + Vite + Tailwind, on Vercel)
   |-- sign-in, comments, approvals --> Supabase (PostgreSQL + Auth, row-level security by role)
   |-- "run review" ----------------> Review service (Python FastAPI, on Render)
                                          |-- rules engine and fact matching (plain code)
                                          |-- AI analysis (Stage 3)
                                          |-- saves findings in Supabase
```

## Run it on your computer

You need: Node.js (LTS), Python 3.11 or newer, Git, and a free Supabase account.

### 1. Database (Supabase)

1. Create a project at supabase.com (free plan is enough).
2. In the **SQL Editor** run these files from `database/`, in this order: `schema.sql`, `seed.sql`.
3. Create four users (**Authentication -> Users -> Add user**, tick **Auto Confirm User**, same demo password for all):
   `creator@brandshield.demo`, `manager@brandshield.demo`, `reviewer@brandshield.demo`, `admin@brandshield.demo`.
4. Run `demo_users.sql` (gives each user a name and role), then `stage2.sql`, then `demo_content.sql` (a sample campaign with three drafts that contain deliberate mistakes).
5. In **Project Settings -> API** note the project URL, the public (anon or publishable) key and the secret (service role) key.

### 2. Review service (Python)

```
cd review-service
python -m venv .venv
# Windows:  .venv\Scripts\activate        Mac/Linux:  source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env      (Mac/Linux: cp .env.example .env)
# fill in the Supabase values in .env
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/health. It should show `"database": "ok"`.
Run the tests: `python -m unittest discover -s tests -t .`

### 3. Frontend (React)

```
cd frontend
npm install
copy .env.example .env      (Mac/Linux: cp .env.example .env)
# fill in the Supabase URL and public key; use the same demo password
npm run dev
```

Open http://localhost:5173 and click a demo account. A link such as `http://localhost:5173/?demo=creator` signs in as that demo user directly (roles: creator, manager, reviewer, admin).

## Deploying (free tiers)

- **Review service on Render** (Web Service): root directory `review-service`, build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Add the variables from `review-service/.env.example`; set `ALLOWED_ORIGINS` to the frontend's address.
- **Frontend on Vercel**: root directory `frontend`, framework Vite. Add the `VITE_` variables; set `VITE_REVIEW_API_URL` to the Render address.
- Free Render services sleep when idle and free Supabase projects pause after a week without activity. A free uptime monitor calling `/health` every 10 minutes keeps both awake.

## Tests

- `review-service/tests`: the review engine on the sample brand kit (what is flagged, which source and fix), and the saving logic (decisions survive a new review, no duplicates, status changes) against an in-memory stand-in for the database.
- The database file `database/schema.sql` was also run on a real PostgreSQL to check the role rules (for example: a creator cannot change facts or approve; an admin can change facts).

## Security notes

- Secret keys live only in `.env` files on the server side and are ignored by Git.
- The browser only receives the public Supabase key; what a user can read or change is limited by row-level security in `database/schema.sql`.
- Demo accounts exist only in the demo database and hold no real data. Only fictional sample data (the "FreshJuice" brand kit) is used.

## Known limits

- The review checks text only; images and documents come in Round 3.
- The rule-based engine knows the numbers, words and patterns in the brand kit. Meaning-based claims need the AI step (Stage 3) or a human.
- Free hosting is slow on the first request after a pause.

## AI and tools used

See [docs/AI_AND_TOOLS.md](docs/AI_AND_TOOLS.md).
