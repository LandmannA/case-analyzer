# Salesforce Case Analyzer — Requirements Document

**Owner:** Alex Landmann
**Purpose:** Portfolio flagship project demonstrating AI-powered Revenue Operations capability. Target audience: recruiters and hiring managers for RevOps Lead/Director roles. The app must be demo-able in under 2 minutes and understandable by a non-technical revenue leader. The companion `PLAN.md` defines HOW and in what order; Claude Code should read both before writing any code.

---

## 1. Product summary

A web application that ingests an exported set of Salesforce support cases (CSV file), uses an AI model (Claude API) to classify and analyze them, and presents the results in a dashboard. It answers the questions every Service/RevOps leader has: *What are customers actually contacting us about? What's trending up? Where should we write knowledge articles to deflect volume?*

**Elevator pitch for the demo:** "Support teams drown in unstructured cases. This tool reads them like an analyst would — classifying every case, spotting trends, and drafting the knowledge articles that prevent repeat tickets."

## 2. Users

- **Primary (real):** Recruiters/hiring managers clicking a demo link or watching a demo video. They must "get it" within 60 seconds without instructions.
- **Persona (fictional, for design):** A European Head of Customer Service with 5,000 open cases and no analyst.

## 3. Scope and priorities (MoSCoW)

### Must have (Phase 1 — MVP)
1. **CSV upload** of Salesforce case exports. Expected columns: `CaseNumber, Subject, Description, Product, Country, Priority, Status, CreatedDate`. The app must tolerate extra columns and missing optional fields.
2. **AI classification per case**, producing for each case:
   - `category` (e.g., Product Defect, How-To Question, Billing, Shipping/Logistics, Warranty, Software/Firmware, Other)
   - `root_cause` (short free-text phrase)
   - `sentiment` (Positive / Neutral / Negative / Angry)
   - `urgency` (Low / Medium / High)
3. **Dashboard** showing:
   - Cases by category (bar chart)
   - Case volume over time by category (line chart)
   - Sentiment distribution (donut or bar)
   - "Top emerging issues" — AI-written summary of the 3–5 most notable patterns in plain business language
4. **Case table** — sortable/filterable list of all cases with their AI classifications; clicking a row shows full case detail.
5. **Bundled demo dataset** — a "Load demo data" button that loads ~150 realistic FAKE cases (consumer electronics domain: TVs, cameras, home appliances) so a recruiter never needs their own file.
6. **Processing progress indicator** — classification of 150 cases takes time; show a progress bar, never a frozen screen.

### Should have (Phase 2)
7. **Knowledge article generator:** select a category or issue cluster → AI drafts (a) an internal agent-facing article and (b) a customer-facing help article. Copy-to-clipboard buttons.
8. **Export results** as CSV (original columns + AI columns).
9. **Polished visual design** — clean, premium, minimalist; looks credible in a LinkedIn demo video.

### Could have (Phase 3 — only if time permits)
10. **"Ask your cases" chat** — natural-language Q&A over the analyzed dataset ("Which product line drives the most angry cases?").

### Won't have (explicitly out of scope)
- Live Salesforce API/OAuth connection (CSV export is the integration story for the demo; mention SOQL export in the README instead).
- User accounts, authentication, or multi-tenant anything.
- Real customer data of any kind. **Demo/synthetic data only — this is a hard rule.**

## 4. Functional details

### 4.1 CSV ingestion
- Validate required columns (`Subject`, `Description`); show a friendly error listing any missing columns.
- Cap at 300 rows per upload (cost control). If the file is larger, process the first 300 and tell the user.

### 4.2 AI classification
- All model calls go through a **server-side API route** — the Anthropic API key must never be exposed in browser code.
- Batch cases into groups (10–20 cases per model call) to reduce cost and latency; request strict JSON output and validate it before storing.
- Model: use a fast, low-cost Claude model for per-case classification; a stronger model may be used for the "Top emerging issues" summary and knowledge articles.
- If a batch fails (malformed JSON, API error), retry once, then mark those cases "Unclassified" and continue — never crash the whole run.

### 4.3 Demo dataset
- 150 synthetic cases generated once and stored as a static CSV in the repo (`/public/demo-cases.csv`).
- Must feel real: varied products, countries, tones (some angry, some polite), dates spread over ~6 months, and 3–4 deliberately planted "trends" (e.g., a firmware issue spiking in the last month) so the dashboard has a story to tell.
- Every synthetic name/email must be obviously fictional.

## 5. Non-functional requirements
- **Stack:** Next.js (React) single project with API routes; charts via Recharts; deployable free on Vercel.
- **Secrets:** `ANTHROPIC_API_KEY` in `.env.local` only; `.env*` listed in `.gitignore`.
- **Cost ceiling:** a full demo run (150 cases) should cost well under $1 in API usage.
- **Performance:** full demo dataset analyzed in under ~2 minutes with visible progress.
- **Responsive:** must look good in a desktop browser at typical screen-recording sizes (1280–1920px); mobile is nice-to-have.
- **Design language:** minimalist, premium, generous whitespace, one accent color; no clutter. (This becomes Alex's personal brand across all portfolio projects.)

## 6. Success criteria
1. A stranger can open the deployed URL, click "Load demo data," and understand the value within 60 seconds.
2. A 60–90 second screen recording of the flow works as a LinkedIn Featured demo with no voiceover needed.
3. The repo README explains the business problem first, the tech second.
4. Zero real or personally identifiable data anywhere in the repo or demo.

## 7. Data security architecture

This section exists both to build the app correctly and because "how is this data secured" is exactly the question a RevOps/GTM hiring manager should ask — the README should explain this openly as a feature, not bury it.

### 7.1 Design principle: minimize what can leak
The app stores nothing server-side by design. There is no database. An uploaded CSV lives in browser memory and passes through the server only for the moment of the AI call, then is discarded. You cannot breach a filing cabinet that was never built. This must remain true throughout development — no phase should introduce persistent storage of uploaded case data without explicit sign-off, since it changes the security story.

### 7.2 Must have (add to Phase 1 scope)
1. **HTTPS everywhere** — default on Vercel; confirm no mixed-content warnings.
2. **Server-side-only API key** — the Anthropic key is never sent to or readable from the browser (already specified in section 4.2; restated here as a security requirement, not just a functional one).
3. **No persistence** — verify via a simple test: upload a file, refresh the page, confirm the data is gone and no record of it exists in any log or database.
4. **PII redaction before the AI call** — before case text is sent to the model, automatically detect and mask common personal identifiers (names, email addresses, phone numbers, order/serial numbers) by replacing them with placeholder tokens (e.g., `[NAME]`, `[EMAIL]`, `[PHONE]`). The AI classifies the *problem*, not the *person*. This can be a simple pattern-matching pass (regex for emails/phones is reliable; name detection can be lighter-touch/best-effort — note this limitation in the README rather than over-engineering it). Log to the console during development how many tokens were redacted per batch, so it's demoable.
5. **README security section** covering: no data storage by design, TLS in transit, server-side-only key, PII redaction, and that the demo runs under Anthropic's commercial API terms (not consumer terms) — meaning conversation content isn't retained for model training by default. Link to https://platform.claude.com/docs/en/manage-claude/api-and-data-retention for anyone who wants the primary source.

### 7.3 Won't have (out of scope for the public demo, but documented)
- VPC hosting, private network connectivity (AWS PrivateLink / Azure Private Endpoint), SSO, and audit logging are enterprise-deployment concerns, not needed for a public portfolio demo. Document them in an **"Enterprise Architecture" appendix** in the README instead — a short written (and ideally diagrammed) explanation of how this app would be re-architected for real enterprise use: app hosted inside a company VPC, AI calls routed through a private endpoint to AWS Bedrock/Azure AI Foundry/Google Vertex (whichever cloud the company already standardizes on) so data never crosses the public internet, plus SSO, audit logging, and EU data residency where required. This appendix is a portfolio asset in its own right — it shows enterprise architecture thinking without the cost of actually building it.
