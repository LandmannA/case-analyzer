# CLAUDE.md — Project instructions for Claude Code

## Context
This is a portfolio project for Alex, a Revenue Operations leader who is not a professional developer. The goal is a polished, demo-able app (see REQUIREMENTS.md) built in short sessions following PLAN.md. Impressiveness of the demo and clarity for Alex matter more than engineering sophistication.

## How to work
- Read REQUIREMENTS.md and PLAN.md before writing code. Build only what the current phase asks for.
- Don't add features, refactor, or introduce abstractions beyond what the task requires. Do the simplest thing that works well. Don't add error handling or validation for scenarios that cannot happen; only validate at system boundaries (user input, external APIs).
- When you have enough information to act, act. If you are weighing a choice, give a recommendation, not an exhaustive survey.
- Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly. If tests or runs fail, say so with the output.
- Lead with the outcome. Your first sentence after finishing should answer "what happened." Supporting detail comes after.

## How to communicate with Alex
- Alex is non-technical: explain concepts in plain language, define any necessary technical term in one simple sentence, and use real-world analogies where helpful.
- Any instruction that requires Alex to do something (run a command, open a URL, click something in a dashboard) must be spelled out step by step: which folder to be in, exactly what to type or click, and what he should see if it worked.
- Never assume knowledge of shortcuts or implied steps.

## Hard rules
- The Anthropic API key lives only in `.env.local` (and later in Vercel environment variables). It must never appear in client-side code, in git history, or in any file that gets committed. `.gitignore` must cover `.env*`.
- All data in this project is synthetic. Never generate content that looks like real personal data (use obviously fictional names/emails).
- At the end of each successful phase, create a git commit with a clear message (e.g., "Phase 2: AI classification working"), so any phase can be cleanly reverted.
- Keep API costs low: batch model calls, cap uploads at 300 rows, and prefer a fast low-cost Claude model for per-case classification.
