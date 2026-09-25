# 🛡️ ChainSleuth — Crypto Fraud Investigation & Asset Tracing Console

> **Smart India Hackathon (SIH26183) + Web3 / Law Enforcement Security Track**  
> *Automated multi-chain asset tracing, NCRP complaint ingestion, laundering typology detection, VASP deposit attribution, and Section 94 BNSS legal freeze notice generator for Indian Cyber Crime Law Enforcement.*

[![Live App](https://img.shields.io/badge/Live_Console-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://chainsleuth.netlify.app/dashboard)
[![Backend API](https://img.shields.io/badge/Live_Backend-FastAPI_Render-009688?style=for-the-badge&logo=fastapi)](https://chain-sleuth-backend.onrender.com/openapi.json)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-000000?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

---

## 📌 Executive Summary

When cryptocurrency fraud occurs, criminals launder stolen funds across disposable burner wallets, peeling chains, fan-out smurfing splits, cross-chain bridges, and privacy mixers before depositing into centralized exchanges (VASPs like Binance, CoinDCX, WazirX) to cash out into fiat currency. Criminals complete cash-outs within **~30 minutes**, whereas traditional manual ledger tracing takes hours or days.

**ChainSleuth** automates the entire law enforcement investigation pipeline:
1. **Intake & NLP Parsing**: Ingests suspect wallet addresses or raw victim FIR complaint narratives via **Gemini AI NLP extraction**.
2. **NCRP Complaint Batch Ingestion & Correlation**: Processes national cybercrime complaints (`POST /api/v1/ncrp/ingest`) and correlates shared gas funders or VASP deposit hubs across state boundaries (`GET /api/v1/ncrp/correlations`).
3. **Graph Traversal & Telemetry**: Executes value-weighted ledger walks across TRON, Ethereum, Solana, and Bitcoin ledgers with real-time AI/ML stage telemetry.
4. **Laundering Typology Detection**: Pinpoints **Peeling Chains**, **First-Funder Syndicate Gas Funders**, **Layering Cells**, **Smurfing Outdegree Splits**, and **Privacy Diverters**.
5. **Actionable VASP KYC Attribution**: Isolates the specific **KYC Deposit Address** rather than pooling hot wallets, preventing invalid freeze attempts.
6. **Statutory Legal Output**: Auto-generates court-admissible **Section 94 BNSS Legal Freeze Directives** accompanied by **Section 63 BSA SHA-256 Digital Evidence Certificates** with print-optimized styling (`Ctrl+P`).

---

## 💡 Core Domain Concepts & Heuristics

| Concept | Explanation | Algorithmic Importance |
| :--- | :--- | :--- |
| **Deposit Address vs. Hot Wallet** | Exchange deposit addresses belong to specific KYC users; hot wallets pool millions of deposits together. | **Load-bearing distinction:** Freezing a hot wallet disrupts entire exchange operations and is legally invalid. ChainSleuth steps back 1 hop prior to the sweep to isolate the actionable deposit account. |
| **First-Funder / Gas Attribution** | Burner wallets start with 0 native gas currency (TRX/ETH/SOL). | Tracing backwards to the wallet supplying gas fees links separate victim FIR complaints across jurisdictions to the same crime syndicate. |
| **Peeling Chain Detection** | Laundering technique where an address repeatedly passes ~85–90% onward while peeling off <15%. | Detected via consecutive hop transfer split ratios and flow volume monitoring. |
| **Fan-Out / Smurfing** | Splitting large sums across 10+ fresh addresses in a short window. | Identified via outdegree burst patterns and rapid multi-wallet dissipation. |
| **Section 94 BNSS Directive** | Indian criminal procedure law (*Bharatiya Nagarik Suraksha Sanhita*) for compelling asset freezes. | Formally addresses the VASP Nodal Officer with mandatory account freeze and transaction logs directives. |
| **Section 63 BSA Certificate** | Indian digital evidence law requirement (*Bharatiya Sakshya Adhiniyam*). | Stamps an immutable SHA-256 hash of the graph traversal snapshot and ledger state on generated legal orders. |

---

## ⚙️ Platform Architecture

```
  1. INTAKE            2. NCRP & TRACE          3. PATTERN DETECTION      4. VASP TARGET         5. LEGAL FREEZE
┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐   ┌─────────────────┐    ┌─────────────────┐
│ Victim FIR   │ ──► │ Ingestion &      │ ──► │ Peeling Chains &   │ ──►│ Identifies      │ ──►│ Section 94 BNSS │
│ / Suspect    │     │ Multi-hop Ledger │     │ Syndicate Gas      │   │ Individual KYC  │    │ Freeze Notice + │
│ Address      │     │ Graph Walk       │     │ Funder Correlation │   │ Deposit Account │    │ BSA SHA-256 Cert│
└──────────────┘     └──────────────────┘     └────────────────────┘   └─────────────────┘    └─────────────────┘
```

---

## 🎨 Design Semantics & UI System

Built as a dark-mode-first, desktop-first SIEM crime-operations command center (`1366x768` to `1920x1080` optimized):

- ⚪ **Slate / Neutral (`#475569`):** Intermediate transit wallets & unflagged hops
- 🔴 **Coral / Red (`#ef4444`):** Suspicious burner wallets & detected laundering typologies
- 🟢 **Teal / Emerald (`#0d9488`):** Attributed VASP deposit target addresses (Actionable Freeze Targets)
- 🟣 **Purple / Indigo (`#9333ea`):** Syndicate Gas Funders & Cross-jurisdiction pivots

---

## 🚀 Key Features & Modules

### 1. Investigation Intake Screen (`/trace/new`)
- **Address & FIR Parsing Tabs**: Direct suspect wallet input or raw FIR text ingestion parsed via Gemini AI.
- **Parametric Review**: IO can review and adjust hop depth, transaction threshold, and blockchain parameters prior to execution.
- **AI / Forensic Telemetry Display**: Real-time progress monitoring showing Graph Traversal, GraphSAGE Risk Analysis, XGBoost Typology Analysis, and VASP Attribution.

### 2. Case Management Dashboard (`/dashboard`)
- **SIEM Metric Cards**: Tracks *Active Investigations*, *High Risk Cases ($\ge 75$)*, *Pending Approval*, and *VASP Attributions*.
- **Multi-Chain Filtering**: Filter by TRON, Ethereum, Solana, Bitcoin, or view all cases.
- **Supervisor Workflow Gate**: Gated access for Supervisory Officers to approve pending Section 94 BNSS notices.

### 3. Interactive Graph Workbench (`/case/[caseId]`)
- **Cytoscape.js Directed Canvas**: Visualizes value flows with `breadthfirst` directional layout.
- **Interactive Workbench Controls**: Zoom, fit to view, node re-layout, label toggles, and hop depth sliders (1 to 10).
- **Wallet & Typology Inspector (`WalletDetailPanel.tsx`)**: Inspect wallet balances, risk scores, laundering badges, and live transaction ledgers.
- **External Block Explorer Resolution**: Dynamic transaction links for Tronscan, Etherscan, Solscan, and Bitcoin explorers based on source/destination chain.

### 4. NCRP Cyber Crime Complaint Hub (`/ncrp`)
- **Batch Complaint Ingestion**: Form & JSON array ingestion submitting directly to `POST /api/v1/ncrp/ingest`.
- **Syndicate Correlation Dashboard**: Displays cross-state correlations (`shared_gas_funder`, `shared_vasp_deposit`, `cross_jurisdiction_syndicate`) with aggregate loss in INR.
- **Batch Trace Action**: Single-click batch execution to trace all ingested complaints simultaneously via `POST /api/v1/ncrp/batch-trace`.

### 5. VASP Labels & Attributions (`/dashboard/vasp`)
- Consumes live VASP label registry (`GET /api/v1/vasp/labels`).
- Maps custom wallet labels, verification status, and risk classification across registered VASPs.

### 6. Legal Freeze Directives & Evidence Certificates (`/case/[caseId]/notice` & `/case/[caseId]/fir`)
- **VASP Target Payoff Card**: Distinguishes **ACTIONABLE KYC DEPOSIT ADDRESS** (`FREEZE TARGET`) from **EXCHANGE HOT WALLET** (`SHARED POOL — Do NOT Freeze`).
- **Section 94 BNSS Freeze Order**: Complete official document layout addressing the VASP Nodal Officer.
- **Section 63 BSA Certificate**: SHA-256 cryptographic evidence hash stamp with one-click copy and `@media print` support (`Ctrl+P` hides UI controls for clean white-paper printing).
- **AI Investigation Docket**: Auto-generates structured executive dockets with statutory legal references and evidence summaries.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router with Turbopack)
- **Language:** TypeScript 5 (Strict Type Safety)
- **Styling:** Vanilla CSS & Tailwind CSS (Dark Command Center Design System)
- **Graph Visualization Engine:** Cytoscape.js (`cytoscape` & `@types/cytoscape`)
- **State Management:** Zustand (Persisted User Roles & Active Case State)
- **Icons:** Lucide React
- **API Client:** Native Fetch API integrated with live FastAPI backend (`https://chain-sleuth-backend.onrender.com/api/v1`)

---

## 📂 Repository Structure

```
TRACEX FRONT/
├── app/
│   ├── layout.tsx                      # Root layout & global SIEM theme metadata
│   ├── page.tsx                        # Redirects to /dashboard
│   ├── login/page.tsx                  # Access role selector (IO / Supervisor / VASP Nodal)
│   ├── dashboard/
│   │   ├── page.tsx                    # Main Case Management SIEM dashboard
│   │   ├── audit/page.tsx              # Supervisory audit logs & sign-offs
│   │   └── vasp/page.tsx               # VASP labels & exchange registry browser
│   ├── trace/new/page.tsx              # Trace intake form & FIR NLP parser
│   ├── ncrp/page.tsx                   # NCRP complaint batch ingestion & syndicate correlations
│   └── case/[caseId]/
│       ├── page.tsx                    # Primary Cytoscape Graph Workbench
│       ├── notice/page.tsx             # Section 94 BNSS Legal Freeze Directive
│       └── fir/page.tsx                # FIR & Evidentiary documentation preview
├── components/
│   ├── graph/
│   │   ├── GraphCanvas.tsx             # Cytoscape.js graph canvas wrapper
│   │   ├── GraphControls.tsx           # Graph zoom, layout, label & hop depth controls
│   │   └── graphStyles.ts              # Cytoscape element styling (Gray / Red / Teal / Purple)
│   ├── panels/
│   │   ├── WalletDetailPanel.tsx       # Wallet inspector, risk score & transaction history
│   │   ├── VaspAttributionCard.tsx      # VASP Deposit Target vs Hot Wallet payoff card
│   │   ├── TypologyFlags.tsx           # Laundering typology badges with explanations
│   │   └── ForensicClustersPanel.tsx   # Case wallet clusters breakdown
│   ├── intake/
│   │   ├── TraceForm.tsx               # Trace intake & AI/ML stage telemetry UI
│   │   └── FirParserPreview.tsx        # Gemini AI extracted parameters review panel
│   ├── ncrp/
│   │   └── NcrpCorrelationDashboard.tsx# Cross-jurisdiction syndicate correlation view
│   ├── case/
│   │   ├── AIInvestigationDocketModal.tsx # AI Investigation Docket generator
│   │   ├── EvidenceCertModal.tsx       # Section 63 BSA evidence certificate with print styles
│   │   └── ForensicDeepDivePanel.tsx   # Cross-chain bridge & privacy dossier inspector
│   └── layout/
│       ├── AppShell.tsx                # Top bar & navigation layout
│       └── Sidebar.tsx                 # Navigation sidebar with role indicator
└── lib/
    ├── api.ts                          # Verified OpenAPI client for live backend
    ├── store.ts                        # Zustand global state store
    └── types.ts                        # Strict TypeScript interfaces aligned with backend OpenAPI
```

---

## 🔗 Live OpenAPI Endpoints Reference

All frontend API functions in `lib/api.ts` connect directly to the live backend OpenAPI specification (`https://chain-sleuth-backend.onrender.com/openapi.json`):

| Action | HTTP Method | Endpoint | Request Payload | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| **Initiate Trace** | `POST` | `/api/v1/trace/` | `{ suspect_address, chain, max_depth }` | `TraceResult` |
| **Ingest Complaints** | `POST` | `/api/v1/ncrp/ingest` | `{ complaints: NCRPComplaintRecord[] }` | `NCRPBatchIngestResponse` |
| **Batch Trace** | `POST` | `/api/v1/ncrp/batch-trace` | `["CS-1", "CS-2"]` *(Raw Array)* | `TraceResult[]` |
| **Bridge Hops** | `GET` | `/api/v1/cases/{caseId}/bridge-hops` | Path Param `caseId` | `BridgeHop[]` |
| **Privacy Dossier** | `GET` | `/api/v1/cases/{caseId}/privacy-dossier` | Path Param `caseId` | `PrivacyDossier` |
| **VASP Labels** | `GET` | `/api/v1/vasp/labels` | Query Params (`skip`, `limit`) | `VaspLabelsResponse` |
| **Syndicate Correlations**| `GET` | `/api/v1/ncrp/correlations` | Query Params (`min_loss_inr`, `threat_level`) | `SyndicateCorrelationItem[]` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `npm` (recommended) or `yarn` / `pnpm`

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/youareawizardabhi7-web/ChainSleuth.git
cd ChainSleuth

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Build Commands

```bash
# 1. ESLint code quality check
npm run lint

# 2. Production build compilation
npm run build
```

---

## 📜 Legal & Compliance Framework

ChainSleuth complies with Indian Criminal Procedure and Evidence Laws:
- **BNSS §94 (*Bharatiya Nagarik Suraksha Sanhita, 2023*)**: Authorizes law enforcement officers to issue production orders and asset freeze directives to Virtual Asset Service Providers (VASPs).
- **BSA §63 (*Bharatiya Sakshya Adhiniyam, 2023*)**: Mandatory cryptographic evidence certificate establishing chain of custody and immutable SHA-256 evidence hashing for digital records.

---

## 📄 License & Attribution

Developed for **Smart India Hackathon 2026 (SIH26183)** and **MLH Web3 / Security Track**.  
© 2026 ChainSleuth Team. All rights reserved.
