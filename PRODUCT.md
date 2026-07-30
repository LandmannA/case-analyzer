# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Product users (real, if run beyond the demo):** Anyone who wants to learn from their support case history — Customer Service Managers, RevOps/CS leaders, CEOs of smaller companies without a dedicated analyst.
- **Demo audience (real, primary for this build):** Recruiters and hiring managers for RevOps Lead/Director roles, evaluating Alex Landmann's skills via a quick, unassisted look at a live demo link or short video. This audience's experience is the one every design and flow decision optimizes for — they must "get it" within 60 seconds with no instructions.
- **Design persona (fictional, secondary):** A European Head of Customer Service with 5,000 open cases and no analyst — used to keep the product feature set and tone grounded in a real operating scenario, not to override the recruiter-first demo experience.

## Product Purpose

Ingests an exported set of Salesforce support cases (CSV) and uses the Claude API to classify and analyze them, then presents results in a dashboard. It answers the questions a Service/RevOps leader has: What are customers actually contacting us about? What's trending up? Where should we write knowledge articles to deflect volume? Success for the demo build: a stranger opens the link, clicks "Load demo data," and understands the value within 60 seconds — no login, no setup.

## Positioning

"Support teams drown in unstructured cases. This tool reads them like an analyst would — classifying every case, spotting trends, and drafting the knowledge articles that prevent repeat tickets." The differentiator is doing all three in one pass (classification → trend detection → knowledge article drafting) from a plain CSV export, with no live system integration or setup required.

## Operating Context

- Input: a Salesforce case export CSV (`CaseNumber, Subject, Description, Product, Country, Priority, Status, CreatedDate`, tolerant of extra/missing optional columns), capped at 300 rows per upload.
- A bundled "Load demo data" button loads ~150 synthetic consumer-electronics support cases (`/public/demo-cases.csv`) with 3-4 deliberately planted trends, so a recruiter never needs their own file.
- Classification runs server-side, batched (10-20 cases/call), with a visible progress indicator (never a frozen screen) and graceful degradation (retry once, then mark "Unclassified") on batch failure.
- Output surfaces: a dashboard (category bar chart, volume-over-time line chart, sentiment chart, AI-written "Top emerging issues" summary), a sortable/filterable case table with row-level detail, a knowledge-article generator (internal + customer-facing drafts with copy buttons), and CSV export of the analyzed dataset.
- Screen-recorded for a LinkedIn demo at 1280-1920px desktop widths; mobile is nice-to-have, not required.
- The public-facing deployment runs in a cost-safety demo-only mode (env-gated) that serves a pre-analyzed sample and does not run live AI analysis on uploaded files; live analysis of a user's own data requires running the project locally with a personal Anthropic API key.

## Capabilities and Constraints

- Stack: Next.js (React), API routes as backend, Recharts for charts, deployed free on Vercel.
- The Anthropic API key is server-side only (`.env.local` / Vercel env vars), never exposed to the browser or committed to git.
- No database, no persistence of uploaded case data by design — data lives in browser memory and passes through the server only for the moment of the AI call.
- PII redaction (emails, phone numbers, order/serial numbers via regex; names via a best-effort "capitalized First Last" heuristic, explicitly not a full NLP/NER pipeline) runs before any case text reaches the Claude API.
- No live Salesforce API/OAuth connection — CSV export is the integration story; a real deployment would use a scheduled SOQL/Bulk API export feeding the same downstream logic.
- No user accounts, authentication, or multi-tenancy.
- All data is synthetic; real or personally identifiable data is explicitly out of scope everywhere in the repo and demo.
- Documented (not built) enterprise extension path: VPC hosting, private network AI routing (AWS PrivateLink/Azure Private Endpoint to Bedrock/Azure AI Foundry/Vertex), SSO, audit logging, EU data residency.

## Brand Commitments

Minimalist, premium, generous whitespace, one accent color, no clutter — scoped to this project only (not confirmed as a cross-portfolio brand standard). Must look credible enough to appear in a LinkedIn demo video/screenshot.

## Evidence on Hand

- Bundled synthetic demo dataset: `/public/demo-cases.csv`, ~150 fake consumer-electronics support cases (TVs, cameras, home appliances) spread over ~6 months with 3-4 planted trends (e.g., a firmware issue spiking in the last month) and varied tones/countries. All names/emails in it are obviously fictional.
- No real testimonials, customer logos, press, or case studies exist or should be fabricated.

## Product Principles

1. Optimize the demo path (Load demo data → Analyze → Dashboard → Article) for a recruiter's first unassisted 60 seconds, above all other flows.
2. Minimize what can leak: no persistent storage, server-side-only key, PII redaction before any model call — treat this as a feature to show, not just an implementation detail.
3. Never let a partial failure (bad batch, malformed JSON) freeze or crash the run — degrade individual cases to "Unclassified" and continue.
4. Keep the real integration story honest: CSV-in is a stand-in for a scheduled Salesforce export, not a permanent architecture choice — document the enterprise path rather than half-building it.
5. Everything in the repo and demo must be synthetic and obviously fictional; this is a hard rule, not a default.

## Accessibility & Inclusion

No specific standard or requirement established; design for general responsive/legible good practice.
