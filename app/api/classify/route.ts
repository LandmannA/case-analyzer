import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-haiku-4-5-20251001";

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

export type Classification = {
  category: string;
  root_cause: string;
  sentiment: string;
  urgency: string;
};

type InputCase = { CaseNumber: string; Subject: string; Description: string };

function buildPrompt(cases: InputCase[]): string {
  const list = cases
    .map((c) => `- id: ${c.CaseNumber}\n  subject: ${c.Subject}\n  description: ${c.Description}`)
    .join("\n");

  return `You are classifying customer support cases for a consumer electronics company.

For each case below, return a classification. Respond with ONLY a JSON array (no prose, no markdown fences), one object per case, in the same order as the input, with this exact shape:
{"id": "<CaseNumber>", "category": "<one of: ${CATEGORIES.join(", ")}>", "root_cause": "<short phrase, max 8 words>", "sentiment": "<one of: ${SENTIMENTS.join(", ")}>", "urgency": "<one of: ${URGENCIES.join(", ")}>"}

Cases:
${list}`;
}

function validate(item: unknown): Classification | null {
  if (typeof item !== "object" || item === null) return null;
  const o = item as Record<string, unknown>;
  const category = typeof o.category === "string" && CATEGORIES.includes(o.category) ? o.category : null;
  const sentiment = typeof o.sentiment === "string" && SENTIMENTS.includes(o.sentiment) ? o.sentiment : null;
  const urgency = typeof o.urgency === "string" && URGENCIES.includes(o.urgency) ? o.urgency : null;
  const root_cause = typeof o.root_cause === "string" ? o.root_cause : null;
  if (!category || !sentiment || !urgency || !root_cause) return null;
  return { category, root_cause, sentiment, urgency };
}

async function callModel(cases: InputCase[]): Promise<Map<string, Classification>> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(cases) }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in model response");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) throw new Error("Model response was not an array");

  const results = new Map<string, Classification>();
  for (const item of parsed) {
    const id = typeof (item as Record<string, unknown>)?.id === "string" ? (item as Record<string, unknown>).id as string : null;
    const classification = validate(item);
    if (id && classification) results.set(id, classification);
  }
  return results;
}

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json(
      { error: "Live analysis is disabled in this public demo to control API costs. Try 'Load demo data' instead." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const cases: InputCase[] = body.cases;

  if (!Array.isArray(cases) || cases.length === 0) {
    return NextResponse.json({ error: "No cases provided" }, { status: 400 });
  }

  let results: Map<string, Classification>;
  try {
    results = await callModel(cases);
  } catch {
    try {
      results = await callModel(cases);
    } catch {
      results = new Map();
    }
  }

  const classifications = cases.map((c) => {
    const found = results.get(c.CaseNumber);
    return {
      CaseNumber: c.CaseNumber,
      ...(found ?? {
        category: "Unclassified",
        root_cause: "—",
        sentiment: "Neutral",
        urgency: "Low",
      }),
    };
  });

  return NextResponse.json({ classifications });
}
