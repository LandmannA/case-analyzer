"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import Dashboard from "./Dashboard";

const REQUIRED_COLUMNS = ["Subject", "Description"];
const ROW_CAP = 300;
const BATCH_SIZE = 15;
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export type Case = {
  CaseNumber: string;
  Subject: string;
  Description: string;
  Product: string;
  Country: string;
  Priority: string;
  Status: string;
  CreatedDate: string;
  category?: string;
  root_cause?: string;
  sentiment?: string;
  urgency?: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function parseCsv(csvText: string): { cases: Case[]; error?: string; capped?: boolean } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const columns = result.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    return {
      cases: [],
      error: `This file is missing the required column${missing.length > 1 ? "s" : ""}: ${missing.join(
        ", "
      )}. Please export your cases with at least a Subject and a Description column.`,
    };
  }

  let rows = result.data;
  const capped = rows.length > ROW_CAP;
  if (capped) rows = rows.slice(0, ROW_CAP);

  const cases: Case[] = rows.map((r, i) => ({
    CaseNumber: r.CaseNumber || String(i + 1),
    Subject: r.Subject ?? "",
    Description: r.Description ?? "",
    Product: r.Product ?? "",
    Country: r.Country ?? "",
    Priority: r.Priority ?? "",
    Status: r.Status ?? "",
    CreatedDate: r.CreatedDate ?? "",
    category: r.category || undefined,
    root_cause: r.root_cause || undefined,
    sentiment: r.sentiment || undefined,
    urgency: r.urgency || undefined,
  }));

  return { cases, capped };
}

function priorityClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  if (p === "low") return "low";
  return "neutral";
}

function sentimentClass(sentiment: string): string {
  const s = sentiment.toLowerCase();
  if (s === "angry") return "high";
  if (s === "negative") return "medium";
  if (s === "positive") return "low";
  return "neutral";
}

type Classification = {
  CaseNumber: string;
  category: string;
  root_cause: string;
  sentiment: string;
  urgency: string;
};

export default function Home() {
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allClassified = cases.length > 0 && cases.every((c) => !!c.category);

  function applyParsed(parsed: ReturnType<typeof parseCsv>, sourceName: string) {
    if (parsed.error) {
      setError(parsed.error);
      setCases([]);
      setInfo(null);
      return;
    }
    setError(null);
    setCases(parsed.cases);
    setSource(sourceName);
    setInfo(
      parsed.capped
        ? `This file has more than ${ROW_CAP} rows — showing the first ${ROW_CAP} to keep analysis fast and affordable.`
        : null
    );
  }

  async function loadDemoData() {
    try {
      const res = await fetch("/demo-cases-classified.csv");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      applyParsed(parseCsv(text), "Demo dataset (pre-analyzed)");
    } catch {
      setError("Could not load the demo dataset. Please refresh the page and try again.");
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => applyParsed(parseCsv(String(reader.result)), file.name);
    reader.onerror = () => setError("Could not read that file. Please try again.");
    reader.readAsText(file);
  }

  async function analyzeCases() {
    setAnalyzing(true);
    setProgress(0);
    setError(null);
    setInfo(null);

    const batches = chunk(cases, BATCH_SIZE);
    const updated = [...cases];
    const byCaseNumber = new Map(updated.map((c, i) => [c.CaseNumber, i]));
    let classifiedCount = 0;
    let unclassifiedCount = 0;

    for (const batch of batches) {
      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cases: batch.map((c) => ({
              CaseNumber: c.CaseNumber,
              Subject: c.Subject,
              Description: c.Description,
            })),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { classifications: Classification[] } = await res.json();
        for (const result of data.classifications) {
          const idx = byCaseNumber.get(result.CaseNumber);
          if (idx === undefined) continue;
          updated[idx] = { ...updated[idx], ...result };
          if (result.category === "Unclassified") unclassifiedCount++;
          else classifiedCount++;
        }
      } catch {
        for (const c of batch) {
          const idx = byCaseNumber.get(c.CaseNumber);
          if (idx === undefined) continue;
          updated[idx] = {
            ...updated[idx],
            category: "Unclassified",
            root_cause: "—",
            sentiment: "Neutral",
            urgency: "Low",
          };
          unclassifiedCount++;
        }
      }
      setCases([...updated]);
      setProgress(Math.round(((batches.indexOf(batch) + 1) / batches.length) * 100));
    }

    setAnalyzing(false);
    // Rough estimate based on Claude Haiku 4.5 pricing ($1/$5 per MTok) and typical
    // batch-prompt token sizes (~110 input + ~40 output tokens per case).
    const estimatedCost = (cases.length * 0.00035).toFixed(3);
    setInfo(
      `Analysis complete: ${classifiedCount} cases classified, ${unclassifiedCount} unclassified. Estimated cost: ~$${estimatedCost}.`
    );
  }

  return (
    <main className="container">
      <div className="hero">
        <span className="badge">Portfolio demo · synthetic data only</span>
        <h1>Salesforce Case Analyzer</h1>
        <p className="tagline">
          Support teams drown in unstructured cases. This tool reads them like an analyst would —
          classifying every case, spotting trends, and drafting the knowledge articles that prevent
          repeat tickets.
        </p>
      </div>

      <div className="actions">
        <button className="btn-primary" onClick={loadDemoData}>
          Load demo data
        </button>
        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          ⬆ Upload a Salesforce case export (.csv) — click or drag &amp; drop
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <div className="notice error">{error}</div>}
      {info && <div className="notice info">{info}</div>}

      {cases.length > 0 ? (
        <div className="table-card">
          <div className="table-header">
            <h2>{source}</h2>
            <div className="table-header-actions">
              <span>{cases.length} cases loaded</span>
              {allClassified ? null : DEMO_MODE ? (
                <span className="notice info demo-notice">
                  Live analysis is disabled in this public demo. Click &ldquo;Load demo data&rdquo; to see a fully analyzed dataset.
                </span>
              ) : (
                <button className="btn-primary" onClick={analyzeCases} disabled={analyzing}>
                  {analyzing ? "Analyzing…" : "Analyze cases"}
                </button>
              )}
            </div>
          </div>
          {analyzing && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Case #</th>
                  <th>Created</th>
                  <th>Product</th>
                  <th>Country</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Subject</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Root Cause</th>
                  <th>Sentiment</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.CaseNumber}>
                    <td className="case-number">{c.CaseNumber}</td>
                    <td className="case-number">{c.CreatedDate}</td>
                    <td>{c.Product}</td>
                    <td>{c.Country}</td>
                    <td>
                      <span className={`pill ${priorityClass(c.Priority)}`}>{c.Priority || "—"}</span>
                    </td>
                    <td>{c.Status}</td>
                    <td className="subject">{c.Subject}</td>
                    <td className="description">{c.Description}</td>
                    <td>{c.category ?? "—"}</td>
                    <td>{c.root_cause ?? "—"}</td>
                    <td>
                      {c.sentiment ? (
                        <span className={`pill ${sentimentClass(c.sentiment)}`}>{c.sentiment}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {c.urgency ? (
                        <span className={`pill ${priorityClass(c.urgency)}`}>{c.urgency}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {allClassified && <Dashboard cases={cases} isDemoDataset={source.startsWith("Demo dataset")} />}

      {cases.length === 0 && (
        !error && (
          <p className="empty-state">
            No cases loaded yet — click “Load demo data” above to see the tool in action.
          </p>
        )
      )}
    </main>
  );
}
