// One-off script: pre-classifies both demo data waves and writes
// public/demo-cases-month1-classified.csv and demo-cases-month2-classified.csv
// with category/root_cause/sentiment/urgency baked in, so the public demo can
// show fully analyzed datasets with zero live API calls. Also writes
// demo-summary-month1.json (AI "top emerging issues" over Month 1 alone) and
// demo-summary-month2.json (over the combined Month 1 + Month 2 dataset).
// The ground-truth `Topic` column passes through untouched — it is never
// sent to the model, only used later by the dashboard's evolution panel.
// Run with: node scripts/classify-demo-data.mjs
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

// Keep in sync with TOPIC_LABELS in app/evolution.ts — the "Top emerging
// issues" summary is grounded in the same ground-truth Topic field the
// dashboard's Evolution table and Suggested Topics use, so the AI-written
// narrative and the deterministic trend table always agree on what's
// actually happening in the data.
const TOPIC_LABELS = {
  "battery-drain": "AeroSnap X200 battery drain",
  "firmware-freeze": "Lumina OLED firmware freeze",
  "shipping-delay": "Rotterdam shipping delays",
  "pairing-failure": "SoundWave Bluetooth pairing failures",
  "compressor-noise": "FrostCore compressor noise",
};
// Keep in sync with PUBLISHED_ARTICLES in app/evolution.ts.
const PUBLISHED_ARTICLES = {
  "battery-drain": "2026-06",
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}
function monthLabel(key) {
  const m = Number(key.split("-")[1]);
  return MONTH_NAMES[m - 1] ?? key;
}

// Mirrors the trend classification in app/evolution.ts's buildMonthlySeries,
// just enough to decide what belongs in "Top emerging issues" — a fully
// resolved topic with no published article is stale news, not "emerging".
function classifyTrend(counts) {
  const firstActive = counts.findIndex((n) => n > 0);
  const lastActive = counts.length - 1 - [...counts].reverse().findIndex((n) => n > 0);
  if (counts[counts.length - 1] === 0 && lastActive < counts.length - 1) return "resolved";
  if (firstActive >= counts.length - 2) return "new";
  const half = Math.max(1, Math.floor(counts.length / 2));
  const earlyAvg = counts.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const recentAvg = counts.slice(-half).reduce((a, b) => a + b, 0) / half;
  if (recentAvg > earlyAvg * 1.5) return "rising";
  if (recentAvg < earlyAvg * 0.5) return "falling";
  return "steady";
}

function buildTopicStats(rows) {
  const months = [...new Set(rows.filter((r) => r.CreatedDate).map((r) => monthKey(r.CreatedDate)))].sort();
  const byTopic = new Map();
  for (const r of rows) {
    if (!r.Topic || r.Topic === "noise" || !r.CreatedDate) continue;
    if (!byTopic.has(r.Topic)) byTopic.set(r.Topic, months.map(() => 0));
    const idx = months.indexOf(monthKey(r.CreatedDate));
    if (idx >= 0) byTopic.get(r.Topic)[idx]++;
  }
  const stats = [];
  for (const [topic, counts] of byTopic) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const trend = classifyTrend(counts);
    // Drop fully-resolved topics with no published article to point to —
    // they're old news, not a "top emerging issue" for a leadership dashboard.
    if (trend === "resolved" && !PUBLISHED_ARTICLES[topic]) continue;
    stats.push({ topic, label: TOPIC_LABELS[topic] ?? topic, months, counts, total, trend });
  }
  stats.sort((a, b) => b.counts[b.counts.length - 1] - a.counts[a.counts.length - 1]);
  return stats;
}

function buildSummaryPrompt(topicStats) {
  const lines = topicStats
    .map((s) => {
      const byMonth = s.months.map((m, i) => `${monthLabel(m)}: ${s.counts[i]}`).join(", ");
      const published = PUBLISHED_ARTICLES[s.topic];
      const articleNote = published ? ` — a knowledge article for this issue was published in ${monthLabel(published)}` : "";
      return `- ${s.label} (total ${s.total} cases) — monthly counts: ${byMonth}${articleNote}`;
    })
    .join("\n");
  return `You are a Revenue Operations analyst writing the "Top emerging issues" section of a leadership dashboard for a consumer electronics support team.

Below is monthly case-volume data for each recurring issue currently being tracked (already filtered to only the ones worth a leadership's attention — nothing stale). For EACH issue listed, write one entry: a short bold-worthy headline, then one or two sentences in plain business language describing the trend (growing, emerging, resolved, steady) and why it matters. If an issue notes a published knowledge article, credit it for the drop in volume. Base this ONLY on the numbers and notes given — do not invent additional issues, root causes, or facts not implied by the data below. Order entries by the most urgent/notable first.

Respond with ONLY a JSON array (no prose, no markdown fences), each item shaped as:
{"headline": "<short headline>", "detail": "<1-2 sentence explanation>"}

Issues:
${lines}`;
}

async function generateSummary(topicStats) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildSummaryPrompt(topicStats) }],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in summary response");
  return JSON.parse(jsonMatch[0]);
}

async function classifyRows(rows) {
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
  return classifications;
}

function writeClassifiedCsv(rows, fields, classifications, outPath) {
  const headers = [...fields, "category", "root_cause", "sentiment", "urgency"];
  const lines = [headers.join(",")];
  let unclassified = 0;
  const fullRows = [];
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
    fullRows.push(full);
    lines.push(headers.map((h) => csvEscape(full[h])).join(","));
  }
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${rows.length} classified cases to ${outPath} (${unclassified} unclassified)`);
  return fullRows;
}

async function writeSummary(fullRows, outPath) {
  const topicStats = buildTopicStats(fullRows);
  const issues = await generateSummary(topicStats);
  fs.writeFileSync(outPath, JSON.stringify({ issues }, null, 2), "utf8");
  console.log(`Wrote ${issues.length} top emerging issues to ${outPath}`);
}

function readCsv(inPath) {
  const csvText = fs.readFileSync(inPath, "utf8");
  return Papa.parse(csvText, { header: true, skipEmptyLines: true });
}

async function main() {
  const publicDir = path.join(process.cwd(), "public");

  console.log("--- Month 1 ---");
  const { data: month1Rows, meta: month1Meta } = readCsv(path.join(publicDir, "demo-cases-month1.csv"));
  const month1Classifications = await classifyRows(month1Rows);
  const month1Full = writeClassifiedCsv(
    month1Rows,
    month1Meta.fields,
    month1Classifications,
    path.join(publicDir, "demo-cases-month1-classified.csv")
  );
  await writeSummary(month1Full, path.join(publicDir, "demo-summary-month1.json"));

  console.log("--- Month 2 ---");
  const { data: month2Rows, meta: month2Meta } = readCsv(path.join(publicDir, "demo-cases-month2-delta.csv"));
  const month2Classifications = await classifyRows(month2Rows);
  const month2Full = writeClassifiedCsv(
    month2Rows,
    month2Meta.fields,
    month2Classifications,
    path.join(publicDir, "demo-cases-month2-classified.csv")
  );
  // The Month 2 summary reflects what's on screen once Month 2 is loaded: the combined dataset.
  await writeSummary([...month1Full, ...month2Full], path.join(publicDir, "demo-summary-month2.json"));
}

main();
