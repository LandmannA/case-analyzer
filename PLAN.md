# Salesforce Case Analyzer — Build Plan

**How to use this document:** Each phase is sized for roughly one 30–60 minute session. Work through them in order. Every phase has (1) a ready-to-paste prompt for Claude Code, and (2) a "verify before moving on" checklist — do not start the next phase until the checklist passes. Claude Code should read `REQUIREMENTS.md` and `CLAUDE.md` before Phase 1.

---

## Phase 0 — Project setup (you, not Claude Code)

1. Install Claude Code and sign in (see setup instructions from Claude chat).
2. Create a project folder, e.g. `case-analyzer`, and place `REQUIREMENTS.md`, `PLAN.md`, and `CLAUDE.md` inside it.
3. Get an Anthropic API key from console.anthropic.com and keep it ready (you'll be asked for it in Phase 1). Set a low monthly spend limit in the console (e.g., $10) as a safety net.
4. Open a terminal in the project folder and run `claude`.

## Phase 1 — Skeleton app with demo data

**Prompt to paste into Claude Code:**
> I'm building a portfolio web app to demonstrate AI-powered Revenue Operations skills to recruiters — see REQUIREMENTS.md and CLAUDE.md for full context. Set up the Next.js project skeleton: home page with a "Load demo data" button and a CSV upload area, and generate the synthetic demo dataset described in REQUIREMENTS.md section 4.3 as public/demo-cases.csv (150 fake consumer-electronics support cases with planted trends). Loading demo data or uploading a CSV should display the raw cases in a clean table. No AI calls yet. When done, tell me the exact command to run the app locally and what I should see.

**Verify before moving on:**
- [ ] Running the app locally (Claude Code will tell you: `npm run dev`, then open `http://localhost:3000` in your browser) shows the page.
- [ ] "Load demo data" fills the table with ~150 cases that read like plausible support tickets.
- [ ] Uploading the same CSV manually also works; uploading a CSV missing the `Description` column shows a friendly error.

## Phase 2 — AI classification engine

**Prompt to paste into Claude Code:**
> Now implement the AI classification from REQUIREMENTS.md section 4.2: a server-side API route that batches cases and calls the Claude API to return category, root_cause, sentiment, and urgency per case as strict JSON. Wire it to an "Analyze cases" button with a progress bar. Handle batch failures gracefully (retry once, then mark Unclassified). Put the API key in .env.local and confirm .gitignore covers it. When done, run the demo dataset end to end and report the actual results: how many cases classified, how many failed, and roughly what it cost.

**Verify before moving on:**
- [ ] Clicking "Analyze cases" shows a moving progress bar and finishes without freezing.
- [ ] The table now shows the four AI columns, and spot-checking 5 cases yourself, the classifications look sensible.
- [ ] Ask Claude Code: "Show me proof the API key is not exposed to the browser" and read its answer.

## Phase 2.5 — Data security layer

**Prompt to paste into Claude Code:**
> Implement REQUIREMENTS.md section 7: add PII redaction that runs before any case text is sent to the Claude API — mask emails, phone numbers, and obvious names with placeholder tokens like [EMAIL], [PHONE], [NAME]. Log how many redactions happened per batch so it's visible during a demo. Confirm and show me evidence that: no case data is persisted anywhere server-side, the API key never reaches the browser, and everything runs over HTTPS. Then write the README's "Data Security" section covering all of this in plain, non-technical language, plus a separate "Enterprise Architecture" appendix explaining how this would be re-deployed for real enterprise use: hosted inside a company VPC, AI calls routed through a private network connection (AWS PrivateLink / Azure Private Endpoint) to Bedrock/Azure AI Foundry/Vertex so data never touches the public internet, plus SSO, audit logging, and EU data residency.

**Verify before moving on:**
- [ ] Upload a CSV with a fake name, email, and phone number in the case text; check the browser's network tab (or ask Claude Code to show you) that the API call sent to Claude contains the placeholder tokens, not the original values.
- [ ] Refresh the page after analyzing — confirm no trace of the uploaded data remains anywhere.
- [ ] The README security section is something you could read aloud in an interview and sound confident doing so.

## Phase 3 — Dashboard

**Prompt to paste into Claude Code:**
> Build the dashboard from REQUIREMENTS.md section 3 (Must have, item 3): category bar chart, volume-over-time line chart, sentiment chart, and the AI-written "Top emerging issues" summary panel. It must surface the planted trends in the demo data. Follow the design language in REQUIREMENTS.md section 5 — minimalist, premium, one accent color. Optimize the layout for a 1280–1920px browser window, since this will be screen-recorded for LinkedIn.

**Verify before moving on:**
- [ ] The planted trends (e.g., the firmware spike) are visibly obvious in the charts.
- [ ] The "Top emerging issues" text reads like something a human analyst would write, in business language.
- [ ] Screenshot test: does it look credible enough to appear in a LinkedIn post? If not, iterate on design before continuing.

## Phase 4 — Knowledge article generator + export

**Prompt to paste into Claude Code:**
> Implement Phase 2 features from REQUIREMENTS.md: (1) select a category and generate two AI-drafted knowledge articles — one internal agent-facing, one customer-facing — with copy buttons; (2) export the analyzed dataset as CSV including the AI columns. Keep the UI consistent with the existing design.

**Verify before moving on:**
- [ ] Generated articles are genuinely usable drafts, not generic filler.
- [ ] Exported CSV opens correctly in Excel with all columns.

## Phase 5 — Deploy + README

**Prompt to paste into Claude Code:**
> Prepare this for public sharing: (1) write a README that leads with the business problem and demo link, then the tech stack, and explicitly states all data is synthetic; (2) give me step-by-step beginner instructions to deploy this to Vercel for free, including where to enter the ANTHROPIC_API_KEY environment variable in the Vercel dashboard; (3) do a final review pass for anything that would embarrass me in a public repo (secrets, TODOs, placeholder text, real-looking personal data).

**Verify before moving on:**
- [ ] The live Vercel URL works on your phone and a friend's computer, not just your machine.
- [ ] Full demo flow on the live site: load demo data → analyze → dashboard → generate article. Time it; it should feel snappy enough for a screen recording.
- [ ] GitHub repo is public, README reads well, no `.env` file committed.

## Phase 6 — The LinkedIn payoff (no coding)

1. Record a 60–90 second screen capture of the flow (macOS: QuickTime; Windows: Win+G Game Bar). No voiceover needed if the UI tells the story; add captions if you like.
2. Add to LinkedIn **Featured**: the demo video + the live URL.
3. Publish the launch post. Structure: the business pain (2 lines) → what the tool does (3 lines) → one surprising insight it found in the demo data → what you learned building it with AI → link. End with a question to invite comments.
4. Update your profile's current-role description and About to change "currently building" to "built" with the link.

## If you get stuck (any phase)

Paste the exact error message into Claude Code and say: "I got this error when [what you were doing]. Diagnose the cause first and explain it to me in plain language before fixing anything." If a session goes badly sideways, it's cheaper to say "revert the changes from this session" than to keep patching — Claude Code can use git to undo work if you ask it to commit at the end of each successful phase (CLAUDE.md instructs it to do this).
