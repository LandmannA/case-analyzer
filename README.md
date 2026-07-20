# Salesforce Case Analyzer

*(Business summary, live demo link, and setup instructions land here in a later phase. This file currently covers data security, since that's built and verified.)*

## Data Security

This app is built so there is as little to secure as possible — it stores nothing, and it strips out personal information before any AI call.

- **No data storage, by design.** There is no database. When you load or upload a set of cases, they live only in your browser's memory for that session. The server touches the data for the few seconds it takes to send it to the AI and get a classification back — it is never written to disk, a database, or a log file. Refresh the page and everything is gone, because there was never anywhere for it to persist.
- **Encrypted in transit.** The app runs entirely over HTTPS (Vercel enforces this by default), so data moving between your browser and the server — and between the server and Anthropic's API — is encrypted the whole way.
- **The AI provider key never reaches your browser.** The Anthropic API key lives only in a server-side environment variable. All AI calls happen on the server; your browser only ever talks to *this app's own* server, never directly to Anthropic. Open your browser's developer tools during analysis and you'll see requests only to `/api/classify` — the key itself is not visible anywhere in that traffic.
- **Personal information is masked before it ever reaches the AI.** Before a case's subject and description are sent to Claude, the server automatically finds and replaces emails, phone numbers, order/serial numbers, and likely names with placeholder tokens (`[EMAIL]`, `[PHONE]`, `[ORDER]`, `[NAME]`). The model classifies *the problem*, not *the person*. Email and phone matching use reliable patterns; name detection is a lighter-touch, best-effort heuristic (it looks for capitalized "First Last" pairs) and can occasionally miss an unusual name format or over-flag a proper noun — a deliberate trade-off to keep this simple rather than bolting on a full NLP/NER pipeline for a portfolio demo.
- **Commercial API terms, not consumer terms.** This app uses Anthropic's commercial API, under which conversation content is not used to train models by default (unlike, say, a free consumer chat product). See [Anthropic's data retention policy](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) for the primary source.

**Public demo note:** the live, publicly-linked version of this app runs in a demo-only mode — it only shows a pre-analyzed sample dataset and does not accept live AI analysis of uploaded files, so it cannot incur unexpected API costs regardless of traffic. Live analysis of your own data is available by running the project locally with your own Anthropic API key.

## Enterprise Architecture Appendix

*(How this would be re-architected for real internal company use.)*

The version above is intentionally minimal so it's cheap and simple to run as a public demo. If a company wanted to run this internally on real (non-synthetic) case data, the architecture would change in a few specific ways:

1. **Hosted inside the company's own network (VPC).** Instead of a public Vercel URL, the app would run inside the company's AWS/Azure/GCP virtual private cloud, reachable only over the corporate network or VPN — not the open internet.
2. **Private network path to the AI model, not the public API.** Rather than calling `api.anthropic.com` over the public internet, the AI call would route through a private network connection — AWS PrivateLink to Amazon Bedrock, an Azure Private Endpoint to Azure AI Foundry, or Google Cloud's equivalent for Vertex AI — so that case data never leaves the company's private network boundary, even though it's still ultimately reaching a Claude model.
3. **Single sign-on (SSO).** Access would be gated behind the company's existing identity provider (Okta, Azure AD, etc.) instead of being open to anyone with the link, so only authorized employees can use it.
4. **Audit logging.** Every upload and analysis action would be logged (who, when, how many cases) to the company's existing logging/SIEM system — not the case content itself, just the access trail — to support compliance and incident review.
5. **EU (or regional) data residency.** For companies with EU customer data, the app and its AI calls would be pinned to EU-region infrastructure (e.g., Bedrock/Vertex/Azure AI's EU regions) so data never crosses into other jurisdictions, satisfying GDPR data-residency expectations.

None of this is needed for a public portfolio demo running on synthetic data — it's documented here to show the deployment path a real enterprise rollout would take.
