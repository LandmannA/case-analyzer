import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { redactText, newCounts } from "../classify/redact";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

type SummaryInput = {
  category: string;
  root_cause: string;
  sentiment: string;
  urgency: string;
  CreatedDate: string;
};

function buildPrompt(cases: SummaryInput[]): string {
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

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json(
      { error: "Live analysis is disabled in this public demo to control API costs." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const cases: SummaryInput[] = body.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    return NextResponse.json({ error: "No cases provided" }, { status: 400 });
  }

  const counts = newCounts();
  const redacted = cases.map((c) => ({ ...c, root_cause: redactText(c.root_cause, counts) }));

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(redacted) }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in model response");
    const issues = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ issues });
  } catch {
    return NextResponse.json({ error: "Could not generate a summary right now." }, { status: 502 });
  }
}
