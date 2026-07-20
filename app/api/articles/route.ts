import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { redactText, newCounts } from "../classify/redact";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-5";

type SampleCase = {
  Subject: string;
  Description: string;
  root_cause: string;
};

function buildPrompt(category: string, cases: SampleCase[]): string {
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

function parseArticles(text: string): { internal: { title: string; body: string }; customer: { title: string; body: string } } {
  const match = text.match(
    /###INTERNAL_TITLE###\s*([\s\S]*?)\s*###INTERNAL_BODY###\s*([\s\S]*?)\s*###CUSTOMER_TITLE###\s*([\s\S]*?)\s*###CUSTOMER_BODY###\s*([\s\S]*)/
  );
  if (!match) throw new Error("Response did not match expected article format");
  return {
    internal: { title: match[1].trim(), body: match[2].trim() },
    customer: { title: match[3].trim(), body: match[4].trim() },
  };
}

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json(
      { error: "Live generation is disabled in this public demo to control API costs." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const category: string = body.category;
  const cases: SampleCase[] = body.cases;
  if (typeof category !== "string" || !category || !Array.isArray(cases) || cases.length === 0) {
    return NextResponse.json({ error: "A category and at least one case are required" }, { status: 400 });
  }

  const counts = newCounts();
  const redacted = cases.map((c) => ({
    ...c,
    Subject: redactText(c.Subject, counts),
    Description: redactText(c.Description, counts),
  }));

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(category, redacted) }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const articles = parseArticles(text);
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ error: "Could not generate articles right now." }, { status: 502 });
  }
}
