// One-off script: pre-classifies public/demo-cases.csv and writes
// public/demo-cases-classified.csv with category/root_cause/sentiment/urgency
// baked in, so the public demo can show a fully analyzed dataset with zero
// live API calls. Run with: node scripts/classify-demo-data.mjs
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
const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 15;

const CATEGORIES = [
  "Product Defect",
  "How-To Question",
  "Billing",
  "Shipping/Logistics",
  "Warranty",
  "Software/Firmware",
  "Other",
];
const SENTIMENTS = ["Positive", "Neutral", "Negative", "Angry"];
const URGENCIES = ["Low", "Medium", "High"];

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function buildPrompt(cases) {
  const list = cases
    .map((c) => `- id: ${c.CaseNumber}\n  subject: ${c.Subject}\n  description: ${c.Description}`)
    .join("\n");
  return `You are classifying customer support cases for a consumer electronics company.

For each case below, return a classification. Respond with ONLY a JSON array (no prose, no markdown fences), one object per case, in the same order as the input, with this exact shape:
{"id": "<CaseNumber>", "category": "<one of: ${CATEGORIES.join(", ")}>", "root_cause": "<short phrase, max 8 words>", "sentiment": "<one of: ${SENTIMENTS.join(", ")}>", "urgency": "<one of: ${URGENCIES.join(", ")}>"}

Cases:
${list}`;
}

function validate(item) {
  if (typeof item !== "object" || item === null) return null;
  const category = CATEGORIES.includes(item.category) ? item.category : null;
  const sentiment = SENTIMENTS.includes(item.sentiment) ? item.sentiment : null;
  const urgency = URGENCIES.includes(item.urgency) ? item.urgency : null;
  const root_cause = typeof item.root_cause === "string" ? item.root_cause : null;
  if (!category || !sentiment || !urgency || !root_cause) return null;
  return { category, root_cause, sentiment, urgency };
}

async function classifyBatch(cases) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(cases) }],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in model response");
  const parsed = JSON.parse(jsonMatch[0]);
  const results = new Map();
  for (const item of parsed) {
    const classification = validate(item);
    if (item.id && classification) results.set(item.id, classification);
  }
  return results;
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildSummaryPrompt(cases) {
  const rows = cases
    .map((c) => `- ${c.CreatedDate} | ${c.category} | ${c.sentiment}/${c.urgency} | ${c.root_cause}`)
    .join("\n");
  return `You are a Revenue Operations analyst reviewing already-classified customer support cases for a consumer electronics company. Each line below is one case: date, category, sentiment/urgency, and a short root cause.

Write the "Top emerging issues" for a leadership dashboard: the 3-5 most notable patterns (spikes, growing trends, or clusters worth acting on). For each: a short bold-worthy headline, then one or two sentences in plain business language explaining what's happening and why it matters. No technical jargon, no case IDs. Base it only on patterns actually visible in the data below — do not invent issues.

Respond with ONLY a JSON array (no prose, no markdown fences), each item shaped as:
{"headline": "<short headline>", "detail": "<1-2 sentence explanation>"}

Cases:
${rows}`;
}

async function generateSummary(cases) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildSummaryPrompt(cases) }],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in summary response");
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const inPath = path.join(process.cwd(), "public", "demo-cases.csv");
  const outPath = path.join(process.cwd(), "public", "demo-cases-classified.csv");
  const summaryOutPath = path.join(process.cwd(), "public", "demo-summary.json");
  const csvText = fs.readFileSync(inPath, "utf8");
  const { data: rows, meta } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const batches = chunk(rows, BATCH_SIZE);
  const classifications = new Map();
  let done = 0;
  for (const batch of batches) {
    let result;
    try {
      result = await classifyBatch(batch);
    } catch (e) {
      console.error("Batch failed, retrying once:", e.message);
      try {
        result = await classifyBatch(batch);
      } catch (e2) {
        console.error("Batch failed twice, marking Unclassified:", e2.message);
        result = new Map();
      }
    }
    for (const [id, c] of result) classifications.set(id, c);
    done += batch.length;
    console.log(`Classified ${done}/${rows.length}`);
  }

  const headers = [...meta.fields, "category", "root_cause", "sentiment", "urgency"];
  const lines = [headers.join(",")];
  let unclassified = 0;
  for (const row of rows) {
    const c = classifications.get(row.CaseNumber);
    if (!c) unclassified++;
    const full = {
      ...row,
      category: c?.category ?? "Unclassified",
      root_cause: c?.root_cause ?? "—",
      sentiment: c?.sentiment ?? "Neutral",
      urgency: c?.urgency ?? "Low",
    };
    lines.push(headers.map((h) => csvEscape(full[h])).join(","));
  }

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${rows.length} classified cases to ${outPath} (${unclassified} unclassified)`);

  const summaryInput = rows.map((row) => {
    const c = classifications.get(row.CaseNumber);
    return {
      CreatedDate: row.CreatedDate,
      category: c?.category ?? "Unclassified",
      sentiment: c?.sentiment ?? "Neutral",
      urgency: c?.urgency ?? "Low",
      root_cause: c?.root_cause ?? "—",
    };
  });
  const issues = await generateSummary(summaryInput);
  fs.writeFileSync(summaryOutPath, JSON.stringify({ issues }, null, 2), "utf8");
  console.log(`Wrote ${issues.length} top emerging issues to ${summaryOutPath}`);
}

main();
