# RayGuard

**Autonomous Chargeback Evidence Compiler & Dispute Defender**

RayGuard is a full-stack chargeback defense platform for Razorpay merchants. It ingests cryptographically signed `payment.dispute.created` webhooks, filters unwinnable micro-disputes through a deterministic ROI gate before spending LLM tokens, enriches evidence via Razorpay APIs and Gemini Vision, scores winnability using a calibrated ML model, and compiles bank-ready 2-page PDF representment dossiers tailored to **Visa**, **Mastercard**, and **RuPay** rules.

---

## Key Capabilities

- **Cryptographic Webhook Guard (`POST /webhooks/razorpay`)**
  - Verifies raw-body `X-Razorpay-Signature` headers using timing-safe `HMAC-SHA256` and enforces `event_id` idempotency against duplicate webhook replays.
- **Deterministic Cost-Benefit Gate**
  - Evaluates dispute value against configurable representment fees (`Gateway Fee + Internal Ops Cost`, default `₹500 + ₹100 = ₹600`). Micro-disputes at or below break-even are auto-accepted immediately without consuming AI inference.
- **Razorpay Test Mode API Integration**
  - **Live Payment Lookup (`GET /api/integrations/razorpay/payment/:paymentId`)**: Auto-fills `order_id`, INR amount, card network, email, and explicit customer name/address (from trusted payment `notes` or linked `GET /v1/customers/:customer_id` records—never derived from email usernames).
  - **Dispute Submission (`POST /api/disputes/:disputeId/submit`)**: Dispatches contest payloads to `POST https://api.razorpay.com/v1/disputes/:id/contest` with graceful local-ledger fallback for synthetic test IDs.
- **Parallel Evidence Fetch & 3000ms Courier SLA Fallback**
  - Concurrently fetches Razorpay payment metadata, order/device/3DS2 telemetry, and courier AWB delivery tracking—automatically switching to **3DS2 + Device Telemetry Fallback** if courier tracking exceeds the configured SLA timeout.
- **Multimodal Evidence Extraction & Network Rebuttals (Gemini)**
  - Inspects rendered Proof-of-Delivery PNGs and customer support transcripts to extract recipient signature validity, address match score, and verbatim delivery confirmations, then drafts tailored rebuttals for **Visa 10.4 (CE 3.0)**, **Mastercard 4837**, and **RuPay NPCI 101**.
- **Calibrated ML Win Scorer & Held-Out Evaluation Lab (`/evaluation`)**
  - Trains an L2-regularized logistic model on 140 training disputes across 9 signals (IP match, device match, 3DS2 auth, account age, prior undisputed orders, POD signature, address match, chat confirmation) and validates against a reproducible **60-case held-out split** with live interactive threshold tuning (`0.50`–`0.95`), confusion matrix, and precision/recall curve.
- **Bank-Ready 2-Page PDF Compiler (`pdf-lib`)**
  - Generates downloadable representment PDFs (`GET /api/dossiers/:disputeId/pdf`) containing payment/order telemetry, extracted POD proof, network rebuttal narrative, and SHA-256 execution trace.
- **Dedicated Multi-Page Dispute Inspector (`/disputes/:id` & `/disputes/:id/:section`)**
  - Organizes each dispute into a clean directory linking to five focused full-page views: `Telemetry`, `Evidence`, `Audit Flow`, `Dossier`, and `Analyst Notes`.
- **Live Voice Analyst Copilot (`WS /api/live`)**
  - Real-time Gemini Live voice and text WebSocket assistant grounded in active dispute telemetry, with Google Sign-In & Firebase Firestore persistence for analyst notes, guardrail policies, and voice transcripts.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, React Router v7, Tailwind CSS v4, Recharts, Lucide React
- **Backend:** Node.js, Express, `tsx`, WebSockets (`ws`), `pdf-lib`
- **AI & Voice:** `@google/genai` (Gemini Vision, Rebuttal Drafting, Gemini Live WebSocket bridge)
- **Payments & Webhooks:** Razorpay Payments & Disputes REST APIs + raw-body HMAC-SHA256 verification
- **Auth & Persistence:** Firebase Authentication (Google OAuth), Cloud Firestore (`users/{uid}/notes`, `users/{uid}/policies`, `users/{uid}/voiceSessions`), local JSON store (`.data/rayguard-store.json`)

---

## Application Routes

| Route | View | Purpose |
| :--- | :--- | :--- |
| `/` | **Landing & Architecture** | System overview, 6-node pipeline diagram, and card-network playbooks |
| `/console` | **Overview** | Net Recovered, N=60 Precision/Recall, Penalties Avoided, Mean Dossier Time, and status-filtered queue |
| `/disputes` | **Dispute Queue** | Searchable ledger, network filters (`Visa`, `Mastercard`, `RuPay`), and **Ingest Dispute** modal with Razorpay **Fetch** |
| `/disputes/:id` | **Inspection Directory** | Case header, key metrics, PDF/Razorpay actions, and links to all 5 inspection sub-pages |
| `/disputes/:id/telemetry` | **01 · Order & Telemetry** | IP match, device fingerprint continuity, 3DS2 ECI, account tenure, prior orders |
| `/disputes/:id/evidence` | **02 · Proof & Rebuttal** | POD PNG preview, Gemini Vision extracted proof, and network rebuttal narrative |
| `/disputes/:id/audit` | **03 · Execution Audit Flow** | Step-by-step pipeline DAG with latencies and inspectable JSON payloads |
| `/disputes/:id/dossier` | **04 · Bank Rebuttal Dossier** | 2-page PDF preview, download, and Razorpay Contest submission |
| `/disputes/:id/notes` | **05 · Analyst Notes** | Firestore-backed analyst notes and human override tags (`CONTEST`, `ACCEPT`, `ESCALATE`) |
| `/evaluation` | **ML Lab** | Interactive held-out (`N=60`) threshold calibration, FP cost vs Net Recovered, confusion matrix |
| `/policies` | **Policies** | Editable cost-gate fees, thresholds, courier SLA timeout, and network templates |

---

## Local Setup

### Prerequisites
- **Node.js** v20+ (LTS recommended) and `npm`

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd <repo-folder>
npm install
2. Configure Environment Variables
Copy .env.example to .env and add your server-side keys (never commit .env):
Bash
cp .env.example .env
Env
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"

# Optional Razorpay Test Mode credentials (rzp_test_...)
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your-razorpay-test-secret"
RAZORPAY_WEBHOOK_SECRET="rzp_test_whsec_rayguard_2026"
3. Firebase Configuration (Optional for Analyst Notes & Cloud Policy Sync)
If apiKey in firebase-applet-config.json is set to a placeholder before pushing to GitHub, restore your Firebase Web App API key locally in firebase-applet-config.json and ensure localhost is listed under Firebase Console → Authentication → Settings → Authorized domains.
4. Start the Application
Bash
npm run dev
Open http://localhost:3000 in your browser. Both the Express API/WebSocket backend and Vite frontend run on port 3000.
5. Optional: Expose Localhost for Live Razorpay Webhooks
To receive payment.dispute.created webhooks directly from Razorpay's Test Mode Dashboard on your local machine:
Bash
ngrok http 3000
Configure your Razorpay Test Mode webhook URL to https://<your-ngrok-domain>/webhooks/razorpay using the same secret as RAZORPAY_WEBHOOK_SECRET.
Scripts & Testing
Bash
# Start development server (Express + Vite + WebSocket on port 3000)
npm run dev

# TypeScript check
npm run lint

# Build production frontend bundle (dist/)
npm run build

# Run production server after building
NODE_ENV=production npm start

# Run all unit tests (Cost Gate, ML Scorer, PDF Compiler, Razorpay Client, Store, Utils)
npx --yes tsx --test \
  server/store.test.ts \
  server/costGate.test.ts \
  server/mlScorer.test.ts \
  server/pdfGenerator.test.ts \
  server/razorpayClient.test.ts \
  src/utils/auditFlow.test.ts \
  src/utils/formatters.test.ts \
  src/utils/liveAudio.test.ts
Project Structure
Text
├── server.ts                  # Express server, API routes, webhook endpoint & Vite middleware
├── server/
│   ├── costGate.ts            # Deterministic break-even & bounded action decision logic
│   ├── geminiService.ts       # Multimodal POD vision & network rebuttal drafting
│   ├── liveBridge.ts          # Gemini Live WebSocket copilot bridge
│   ├── mlScorer.ts            # L2-regularized logistic scorer & 140/60 split evaluation
│   ├── pdfGenerator.ts        # 2-page representment PDF generator (pdf-lib)
│   ├── pngGenerator.ts        # Proof-of-Delivery PNG generator
│   ├── pipeline.ts            # 6-node investigation orchestrator & HMAC verification
│   ├── razorpayClient.ts      # Razorpay Payments, Customers & Disputes API client
│   └── store.ts               # Persistent local ledger (.data/rayguard-store.json)
├── src/
│   ├── App.tsx                # Application router
│   ├── firebase.ts            # Firebase Auth & Firestore client initialization
│   ├── components/            # Layout, modals, audit timeline, PDF preview, voice drawer
│   ├── pages/                 # Landing, Overview, Disputes, Inspector, ML Lab, Policies
│   ├── shared/types.ts        # Shared TypeScript interfaces
│   └── utils/                 # Formatting, audit summaries, PCM live audio helpers
├── firestore.rules            # Firestore security rules
├── .env.example               # Environment variable template
└── package.json
