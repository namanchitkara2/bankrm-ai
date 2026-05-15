<div align="center">

# 🏦 BankRM AI

### AI-Powered WhatsApp Sales Agent for Banking Relationship Managers

*Type a query. Get personalised loan offers sent to 50 customers. Watch the AI close the conversation — while you're in a meeting.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent-FF6B35?style=for-the-badge&logo=chainlink&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-F22F46?style=for-the-badge&logo=twilio&logoColor=white)](https://twilio.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

```
RM types a query → AI scores 500 customers → drafts personalised messages with real EMIs
→ sends via WhatsApp → customer taps a button → AI replies as Rahul (RM)
→ pipeline stage updates → RM sees hot leads in the morning digest
```

</div>

---

## What This Actually Does

Most "AI outreach tools" generate a message and stop. This one **has the full conversation**.

| Step | What Happens |
|---|---|
| **1. Natural language query** | RM types *"Find premium customers in Mumbai who don't have a personal loan"* |
| **2. Agent pipeline runs** | LangGraph chains 13 tool calls — scoring, transactions, message drafting per customer |
| **3. Real financials computed** | EMI formula, credit-score-based rates, conversion probability from 9 behavioral signals |
| **4. Personalised messages** | Each message has actual loan amount (₹19.1L), rate (10.5%), EMI (₹25,900/mo), tenure signal |
| **5. Sent via WhatsApp** | WhatsApp Web (free) or Twilio Content API with 3 quick-reply buttons |
| **6. Customer taps a button** | ✅ Yes, Interested! · 📞 Call Me · ❌ Not Now |
| **7. AI replies instantly** | Intent classified → AI speaks as "Rahul (RM)" with the customer's exact loan details |
| **8. Pipeline updated** | Stage moves: CONTACTED → INTERESTED / CALLBACK_REQUESTED / DECLINED |
| **9. RM sees the inbox** | Live conversation dashboard, funnel stats, hot lead alerts |

---

## Demo

### Agent Running — 13 Tool Calls, 3 Customers, Real Numbers

```
Query: "Find premium customers in Mumbai and draft personal loan messages"

 Plan       → Score → Draft (× 3 customers)
 Tool calls → 13 total

 Aaina Karpe     │ Conv: 63% │ WARM tone    │ ₹19.1L @ 10.5% p.a. │ EMI ₹25,900/mo
 Yasmin Badami   │ Conv:  2% │ URGENT tone  │ ₹25.0L @ 13.0% p.a. │ EMI ₹56,883/mo
 Lavanya Ratta   │ Conv:  2% │ URGENT tone  │ ₹14.7L @ 13.0% p.a. │ EMI ₹33,335/mo

 Personalization: "13-year loyal customer | Excellent credit (793)"
```

### Twilio WhatsApp Template — Quick-Reply Buttons

```
┌──────────────────────────────────────────────────────┐
│  Hi Aaina! 🎉 You have been pre-approved for a       │
│  Personal Loan:                                      │
│                                                      │
│  💰 Amount:  ₹19.1L                                  │
│  📊 Rate:    10.5% p.a. (fixed)                      │
│  💳 EMI:     ₹25,900/month                           │
│  ⏰ Valid till: 31 May 2026                           │
│                                                      │
│  100% digital · No branch visit · Disbursal in 24h  │
├──────────────────────────────────────────────────────┤
│              ✅  Yes, Interested!                     │
├──────────────────────────────────────────────────────┤
│                  📞  Call Me                         │
├──────────────────────────────────────────────────────┤
│                  ❌  Not Now                          │
└──────────────────────────────────────────────────────┘
```

### AI Sales Agent Reply — Tap ✅ Yes, get this:

> *"That's great, Aaina! 🎉 Your Personal Loan for ₹19.1L at 10.5% p.a. is pre-approved. What time works best for a quick call — morning or afternoon? I'll have everything ready and we can complete the process in under 10 minutes."*

### Tap 💰 price objection reply:

> *"I hear you, Aaina! The EMI of ₹25,900 might look high upfront, but you can also choose a smaller amount and the EMI drops proportionally. Would a 7-year tenure work better for you? That brings the monthly down significantly."*

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   React + Vite  :8080                            │
│  Workspace · Customers · Analytics · Conversations (live inbox)  │
└────────────────────────────┬─────────────────────────────────────┘
                             │  REST
┌────────────────────────────▼─────────────────────────────────────┐
│                  FastAPI Backend  :8000                           │
│                                                                  │
│  /api/agent/run              LangGraph 4-node pipeline           │
│  /api/outreach/send-batch    WhatsApp Web + Twilio dispatch      │
│  /api/outreach/reply         WhatsApp Web inbound → AI agent     │
│  /api/outreach/twilio-webhook  Button taps → TwiML reply         │
│  /api/outreach/pipeline      Live funnel + conversation log      │
└──────────┬────────────────────────────────────┬──────────────────┘
           │                                    │
┌──────────▼───────────┐            ┌───────────▼──────────────┐
│  WhatsApp Web  :3001 │            │  Twilio Content API       │
│  whatsapp-web.js     │            │  Template + 3 buttons     │
│  QR session          │            │  Webhook → Cloudflare     │
│  Free, own account   │            │  Tunnel → /twilio-webhook │
└──────────┬───────────┘            └───────────┬──────────────┘
           │                                    │
           └────────────────┬───────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                     SQLite  banking_crm.db                        │
│  customers 500  │  transactions 8,569  │  interactions  592       │
└──────────────────────────────────────────────────────────────────┘
```

### LangGraph Agent — 4 Nodes

```
PLANNER   →  decomposes natural language query into task list
EXECUTOR  →  per customer: predict_conversion → get_transactions → draft_message
REFLECTOR →  loops until all tasks done
RESPONDER →  synthesises answer with all results
```

---

## Key Engineering Decisions

**No placeholder hallucination.**
Every interest rate is derived from the customer's credit score band. Every EMI is computed with the standard annuity formula `P·r(1+r)ⁿ / ((1+r)ⁿ−1)`. The LLM chooses tone — Python does the maths.

**Intent classifier without LLM.**
Keyword matching handles 90% of replies in <1ms with zero API quota. Gemini/Ollama only fires for genuinely complex multi-turn conversations. This makes the sales agent fast, cheap, and reliable.

**Sandbox session map.**
In sandbox mode, all messages go to one test number. When that number replies, a session map routes the reply to the correct customer context. Solves the fundamental problem of testing WhatsApp outreach without messaging real customers.

**Dual delivery backends.**
WhatsApp Web JS — free, uses own account, perfect for demos and small teams. Twilio Content API — production grade, pre-approved templates, quick-reply buttons, delivery receipts. Switch with one env var.

---

## AI Sales Agent — Intent Classification

| Intent | Triggers | Response strategy |
|---|---|---|
| `YES` | "yes", "interested", "haan", "ok sure" | Confirms offer, asks callback time |
| `PRICE_OBJECTION` | "expensive", "high rate", "EMI" | Reframes as EMI, offers longer tenure |
| `DOCUMENTS` | "document", "KYC", "what do I need" | Lists PAN/salary slips/Aadhaar, notes KYC pre-verified |
| `TIMELINE` | "how long", "fast", "disbursal" | 24-hour digital process |
| `WANTS_CALLBACK` | "call", "speak", "phone", "meet" | Morning vs afternoon preference |
| `THINKING` | "maybe", "later", "will let you know" | No pressure, rate valid till month-end |
| `HAS_PRODUCT` | "already have", "existing loan" | Fresh facility, different use case |
| `NO` | "no", "nahi", "not interested" | Graceful exit, offer stays open |
| `GENERAL` | anything else | Falls through to LLM (Gemini → Ollama) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TanStack Router, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy, Pydantic v2, Uvicorn |
| **AI Agent** | LangGraph, custom tool registry, 4-node state machine |
| **LLM** | Google Gemini 2.0 Flash · NVIDIA NIM (Llama 70B) · Ollama (local) |
| **Database** | SQLite — 500 customers, 8,569 transactions, 592 interactions |
| **WhatsApp (free)** | whatsapp-web.js, Puppeteer, Node.js Express |
| **WhatsApp (prod)** | Twilio WhatsApp Business API, Content API v1 |
| **Tunnel** | Cloudflare Tunnel — free public webhook URL |

---

## Project Structure

```
bankrm-ai/
├── backend/                          # FastAPI + LangGraph agent
│   ├── src/
│   │   ├── api.py                    # All REST endpoints (14 routes)
│   │   ├── config.py                 # Pydantic settings
│   │   ├── database.py               # SQLAlchemy models
│   │   ├── llm/                      # Gemini · Ollama · NVIDIA NIM
│   │   ├── tools/
│   │   │   ├── customer_tool.py      # query, profile
│   │   │   ├── transaction_tool.py   # 90-day spend analysis
│   │   │   ├── scoring_tool.py       # CLV + conversion probability
│   │   │   ├── message_tool.py       # Real EMI, rate, personalisation
│   │   │   ├── outreach_tool.py      # WhatsApp Web + Twilio dispatch
│   │   │   └── sales_agent.py        # AI sales agent — intent + reply
│   │   └── rm_agent/
│   │       ├── nodes.py              # Planner, Executor, Reflector, Responder
│   │       ├── graph.py              # LangGraph StateGraph
│   │       └── tool_registry.py      # Tool schemas + execute_tool()
│   ├── whatsapp-service/
│   │   └── server.js                 # Node.js WhatsApp Web bridge
│   ├── data/seed_db.py               # Seeds 500 customers + transactions
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                         # React + Vite dashboard
│   └── src/
│       ├── lib/api.ts                # Typed API client
│       └── components/pages/
│           ├── WorkspacePage.tsx     # Agent chat + Send modal
│           ├── ConversationsPage.tsx # Live WhatsApp inbox
│           ├── CustomersPage.tsx     # Customer browser
│           └── AnalyticsPage.tsx     # KPIs + charts
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Gemini API key](https://aistudio.google.com/app/apikey) (free)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

cp .env.example .env
# Edit .env — add your GEMINI_API_KEY

python data/seed_db.py          # seeds 500 customers + 8,569 transactions
python -m uvicorn src.api:app --port 8000 --reload
```

### 2. WhatsApp Web Bridge (free sender)

```bash
cd backend/whatsapp-service
npm install
node server.js
# Open http://localhost:3001
# Scan QR with WhatsApp → Linked Devices
# Session saves — no re-scan needed next time
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:8080
```

### 4. Twilio Webhook (for button-tap AI replies)

```bash
# Free tunnel — no account needed
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel --url http://localhost:8000

# Copy the https://xxx.trycloudflare.com URL
# Paste into: https://console.twilio.com → WhatsApp Sandbox → "When a message comes in"
```

---

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill in:

```bash
# Which LLM to use (pick one)
LLM_BACKEND=gemini
GEMINI_API_KEY=your_key_here          # aistudio.google.com/app/apikey

# Which sender to use (pick one)
SENDER_BACKEND=whatsapp-web           # free — or 'twilio' for production

# Sandbox: all messages go to YOUR number (safe for testing)
WHATSAPP_SANDBOX=true
WHATSAPP_SANDBOX_NUMBER=+91XXXXXXXXXX

# Twilio (optional — for rich templates + buttons)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+14155238886
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent/run` | Run LangGraph agent on a natural language query |
| `GET` | `/api/customers` | Filter customers by segment, city, income, credit score |
| `GET` | `/api/customers/{id}/score` | CLV score + contributing factors |
| `GET` | `/api/customers/{id}/recommendations` | Product recommendations + affinity scores |
| `POST` | `/api/outreach/send-batch` | Send messages via WhatsApp Web or Twilio |
| `POST` | `/api/outreach/reply` | WhatsApp Web inbound → AI sales agent |
| `POST` | `/api/outreach/twilio-webhook` | Twilio button taps → AI agent → TwiML |
| `GET` | `/api/outreach/pipeline` | Funnel stages + live conversation log |
| `GET` | `/api/outreach/whatsapp-status` | Connection status + QR code |
| `GET` | `/api/analytics/kpis` | Dashboard KPIs |
| `GET` | `/api/analytics/charts` | Segment breakdown, conversion trend |

---

## Scoring Engine

### Customer Lifetime Value (rule-based for auditability)

```
score = 0.20 × norm(annual_income)
      + 0.20 × norm(monthly_avg_balance)
      + 0.15 × tenure_years / 20
      + 0.15 × products_held / 4
      + 0.20 × norm(credit_score)
      + 0.10 × kyc_verified_bonus

Tier:  High Value ≥ 75  |  Medium 50–75  |  Standard < 50
```

### Conversion Probability (9 behavioral signals)

| Signal | Boost |
|---|---|
| Customer doesn't own the product | +25% |
| Monthly balance > ₹5L | +20% |
| Credit score ≥ 750 | +15% |
| Tenure ≥ 5 years | +10% |
| Active transactions last 30 days | +5% |
| Salary credited this month | +8% |
| Spending spike ≥ 20% | +10% |
| **Already owns the product** | **×0.05 (early exit)** |

Probability drives tone: ≥ 40% → warm · 15–40% → professional · < 15% → urgent

---

## Sales Pipeline

```
NEW → CONTACTED → ENGAGED → CONSIDERING → CALLBACK_REQUESTED → INTERESTED
                                                   ↓
                                    OBJECTION ← ─ ─ ─ ─ ─ ─ ─ ┘
                                       ↓
                                   DECLINED            CONVERTED / WON
```

Every stage transition is an `Interaction` row in the DB.
Every AI reply is logged with `framework_used = "AI_AGENT"`.

---

## What's Next

- [ ] **Follow-up cadence** — Day 0/3/7/14/30 auto-sequence
- [ ] **Life event detection** — medical expense, school fees, salary jump → smarter hooks
- [ ] **PostgreSQL** — production-grade, concurrent multi-RM campaigns
- [ ] **Conversation memory** — AI references what it said in prior sessions
- [ ] **A/B testing** — which variant drives more replies, auto-promoted after 200 sends
- [ ] **Morning digest** — push notification: "3 hot leads replied overnight"
- [ ] **Twilio Voice** — AI phone calls for CALLBACK_REQUESTED leads
- [ ] **HubSpot CRM sync** — two-way pipeline updates
- [ ] **Fine-tuned intent model** — trained on real banking conversation outcomes
- [ ] **Multi-language** — Hindi, Tamil, Marathi message generation

---

## License

MIT © [Naman Chitkara](https://github.com/namanchitkara)

---

<div align="center">

Built with 🧠 LangGraph · ⚡ FastAPI · 💬 WhatsApp · 🤖 Gemini

*If this gave you ideas, star it ⭐ and let's connect on [LinkedIn](https://linkedin.com/in/namanchitkara)*

</div>
