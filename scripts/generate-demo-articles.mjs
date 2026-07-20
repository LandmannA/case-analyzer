// One-off script: generates public/demo-articles.json — one internal +
// customer knowledge article per category, pre-baked from the classified
// demo dataset so the public demo can show the article generator with zero
// live API calls. Run with: node scripts/generate-demo-articles.mjs
// Requires ANTHROPIC_API_KEY in the environment (loaded from .env.local).

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import Papa from "papaparse";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-5";
const SAMPLE_SIZE = 8;

function buildPrompt(category, cases) {
  const rows = cases
    .map((c) => `- Subject: ${c.Subject}\n  Description: ${c.Description}\n  Root cause: ${c.root_cause}`)
    .join("\n");
  return `You are a support enablement writer for a consumer electronics company. Below are sample support cases in the category "${category}".

Draft two knowledge articles that would reduce repeat tickets in this category:
1. An INTERNAL article for support agents — troubleshooting steps, likely root causes, and any internal notes (e.g. known issues, when to escalate).
2. A CUSTOMER-FACING help article — friendly, simple, numbered steps a customer can follow themselves, no internal jargon.

Keep each article concise: under 200 words. Write in plain text only — no markdown (no asterisks, no bold, no headers). Base both articles only on the patterns actually visible in the sample cases below — do not invent product names or facts not implied by the data.

Respond with ONLY the following plain-text format, no prose before or after, no markdown fences:
###INTERNAL_TITLE###
<one-line title>
###INTERNAL_BODY###
<article body, can span multiple lines/paragraphs>
###CUSTOMER_TITLE###
<one-line title>
###CUSTOMER_BODY###
<article body, can span multiple lines/paragraphs>

Sample cases:
${rows}`;
}

function parseArticles(text) {
  const match = text.match(
    /###INTERNAL_TITLE###\s*([\s\S]*?)\s*###INTERNAL_BODY###\s*([\s\S]*?)\s*###CUSTOMER_TITLE###\s*([\s\S]*?)\s*###CUSTOMER_BODY###\s*([\s\S]*)/
  );
  if (!match) throw new Error("Response did not match expected article format");
  return {
    internal: { title: match[1].trim(), body: match[2].trim() },
    customer: { title: match[3].trim(), body: match[4].trim() },
  };
}

async function generateArticles(category, cases) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(category, cases) }],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseArticles(text);
}

async function main() {
  const inPath = path.join(process.cwd(), "public", "demo-cases-classified.csv");
  const outPath = path.join(process.cwd(), "public", "demo-articles.json");
  const csvText = fs.readFileSync(inPath, "utf8");
  const { data: rows } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const byCategory = new Map();
  for (const row of rows) {
    if (!row.category || row.category === "Unclassified") continue;
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row);
  }

  const result = {};
  for (const [category, cases] of byCategory) {
    const sample = cases.slice(0, SAMPLE_SIZE);
    console.log(`Generating articles for "${category}" (${sample.length} sample cases)…`);
    result[category] = await generateArticles(category, sample);
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`Wrote articles for ${Object.keys(result).length} categories to ${outPath}`);
}

main();
