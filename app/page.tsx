"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import Dashboard from "./Dashboard";
import Articles from "./Articles";
import { monthKey, monthLabel } from "./evolution";

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
  Topic?: string;
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
    Topic: r.Topic || undefined,
    category: r.category || undefined,
    root_cause: r.root_cause || undefined,
    sentiment: r.sentiment || undefined,
    urgency: r.urgency || undefined,
  }));

  return { cases, capped };
}

const STEPS = [
  {
    title: "Load your cases",
    detail: "Click “Load demo data” below, or upload your own Salesforce case export (.csv).",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
    ),
  },
  {
    title: "AI classifies every case",
    detail: "Category, sentiment, urgency, and root cause — assigned automatically in seconds.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: "Explore the dashboard",
    detail: "See category and sentiment breakdowns, volume trends, and month-by-month evolution.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V9M11 19V5M18 19v-7" />
      </svg>
    ),
  },
  {
    title: "Act on the suggestions",
    detail: "See exactly which topics need a knowledge article, and the measured impact of ones already published.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v5a1 1 0 0 0 1 1h5" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M9 13h6M9 17h6" />
      </svg>
    ),
  },
];

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
  const [tableExpanded, setTableExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const demoClassifiedCases = useRef<Case[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [quickFilter, setQuickFilter] = useState<
    { type: "urgency"; label: string } | { type: "topics"; topics: string[]; label: string } | null
  >(null);
  const isDemoDataset = source.startsWith("Demo dataset");
  const allClassified = cases.length > 0 && cases.every((c) => !!c.category);

  const monthOptions = [...new Set(cases.filter((c) => c.CreatedDate).map((c) => monthKey(c.CreatedDate)))].sort();
  const effectiveFrom = fromMonth || monthOptions[0] || "";
  const effectiveTo = toMonth || monthOptions[monthOptions.length - 1] || "";
  const rangeFilteredCases = cases.filter((c) => {
    if (!c.CreatedDate) return true;
    const m = monthKey(c.CreatedDate);
    return m >= effectiveFrom && m <= effectiveTo;
  });

  const categoryOptions = [...new Set(cases.map((c) => c.category).filter((v): v is string => !!v))];
  const sentimentOptions = [...new Set(cases.map((c) => c.sentiment).filter((v): v is string => !!v))];
  const filteredCases = rangeFilteredCases.filter(
    (c) =>
      (categoryFilter === "All" || c.category === categoryFilter) &&
      (sentimentFilter === "All" || c.sentiment === sentimentFilter) &&
      (!quickFilter ||
        (quickFilter.type === "urgency" ? c.urgency === "High" : quickFilter.topics.includes(c.Topic ?? "")))
  );

  function applyQuickFilter(filter: NonNullable<typeof quickFilter>) {
    setQuickFilter(filter);
    setTableExpanded(true);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    setCategoryFilter("All");
    setSentimentFilter("All");
    setFromMonth("");
    setToMonth("");
    setQuickFilter(null);
    setTableExpanded(false);
    setInfo(
      parsed.capped
        ? `This file has more than ${ROW_CAP} rows — showing the first ${ROW_CAP} to keep analysis fast and affordable.`
        : null
    );
  }

  async function loadDemoData() {
    try {
      const [res1, res2] = await Promise.all([
        fetch("/demo-cases-month1-classified.csv"),
        fetch("/demo-cases-month2-classified.csv"),
      ]);
      if (!res1.ok || !res2.ok) throw new Error("HTTP error");
      const [text1, text2] = await Promise.all([res1.text(), res2.text()]);
      const parsed1 = parseCsv(text1);
      const parsed2 = parseCsv(text2);
      if (parsed1.error || parsed2.error) {
        applyParsed(parsed1.error ? parsed1 : parsed2, "Demo dataset (pre-analyzed)");
        return;
      }
      const combined = [...parsed1.cases, ...parsed2.cases];
      demoClassifiedCases.current = combined;
      const unclassified = combined.map((c) => ({
        ...c,
        category: undefined,
        root_cause: undefined,
        sentiment: undefined,
        urgency: undefined,
      }));
      applyParsed({ cases: unclassified }, "Demo dataset (pre-analyzed)");
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

  function exportCsv() {
    const csv = Papa.unparse(cases);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "case-analysis-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function analyzeCases() {
    setAnalyzing(true);
    setProgress(0);
    setError(null);
    setInfo(null);

    if (isDemoDataset) {
      for (const p of [25, 55, 80, 100]) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setProgress(p);
      }
      setCases(demoClassifiedCases.current);
      setAnalyzing(false);
      setInfo(`Analysis complete: ${demoClassifiedCases.current.length} cases classified.`);
      return;
    }

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
      {cases.length === 0 ? (
        <div className="hero">
          <span className="badge">Portfolio demo · synthetic data only</span>
          <h1>Salesforce Case Analyzer</h1>
          <p className="tagline">
            Support teams drown in unstructured cases. This tool reads them like an analyst would —
            classifying every case, spotting trends, and telling you exactly which knowledge article
            would prevent the most repeat tickets.
          </p>
        </div>
      ) : (
        <div className="hero-compact">
          <span className="hero-compact-title">Salesforce Case Analyzer</span>
          <span className="badge badge-compact">Synthetic data only</span>
        </div>
      )}

      <div className={cases.length === 0 ? "actions" : "actions actions-compact"}>
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

      {cases.length === 0 && (
        <div className="steps-row">
          {STEPS.map((step, i) => (
            <div key={step.title} className="step-card">
              <div className="step-number">{i + 1}</div>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="notice error">{error}</div>}
      {info && <div className="notice info">{info}</div>}

      {allClassified && monthOptions.length > 1 && (
        <div className="timeframe-bar">
          <div className="timeframe-eyebrow">Time frame</div>
          <div className="timeframe-controls">
            <select value={effectiveFrom} onChange={(e) => setFromMonth(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m} disabled={m > effectiveTo}>
                  {monthLabel(m)} {m.slice(0, 4)}
                </option>
              ))}
            </select>
            <span className="timeframe-arrow">→</span>
            <select value={effectiveTo} onChange={(e) => setToMonth(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m} disabled={m < effectiveFrom}>
                  {monthLabel(m)} {m.slice(0, 4)}
                </option>
              ))}
            </select>
            {(fromMonth || toMonth) && (
              <button
                className="timeframe-reset"
                onClick={() => {
                  setFromMonth("");
                  setToMonth("");
                }}
              >
                Reset to all time
              </button>
            )}
          </div>
        </div>
      )}

      {cases.length > 0 ? (
        <div className="table-card" ref={tableRef}>
          <div
            className="table-header table-header-toggle"
            onClick={() => setTableExpanded((v) => !v)}
          >
            <h2>{source}</h2>
            <div className="table-header-actions">
              <span>
                {filteredCases.length === cases.length
                  ? `${cases.length} cases loaded`
                  : `${filteredCases.length} of ${cases.length} cases`}
              </span>
              {allClassified ? null : isDemoDataset || !DEMO_MODE ? (
                <button
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    analyzeCases();
                  }}
                  disabled={analyzing}
                >
                  {analyzing ? "Analyzing…" : "Analyze cases"}
                </button>
              ) : (
                <span className="notice info demo-notice">
                  Live analysis is disabled in this public demo. Click &ldquo;Load demo data&rdquo; to see a fully analyzed dataset.
                </span>
              )}
              {allClassified && (
                <button
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportCsv();
                  }}
                >
                  Export CSV
                </button>
              )}
              <span className="table-toggle-hint">{tableExpanded ? "Hide data ▲" : "Show data ▼"}</span>
            </div>
          </div>
          {analyzing && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
          {!tableExpanded && (
            <p className="table-collapsed-hint" onClick={() => setTableExpanded(true)}>
              Table collapsed — click to view all {cases.length} cases.
            </p>
          )}
          {tableExpanded && (
            <>
              {allClassified && (
                <div className="table-filters">
                  <label htmlFor="category-filter">Category</label>
                  <select
                    id="category-filter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="sentiment-filter">Sentiment</label>
                  <select
                    id="sentiment-filter"
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    {sentimentOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {quickFilter && (
                    <span className="quick-filter-chip">
                      {quickFilter.label}
                      <button type="button" onClick={() => setQuickFilter(null)} aria-label="Clear filter">
                        ×
                      </button>
                    </span>
                  )}
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
                    {filteredCases.map((c) => (
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
            </>
          )}
        </div>
      ) : null}

      {allClassified && (
        <Dashboard
          cases={rangeFilteredCases}
          isDemoDataset={isDemoDataset}
          onFilterHighUrgency={() => applyQuickFilter({ type: "urgency", label: "High-urgency cases" })}
          onFilterNeedsArticleTopics={(topics) =>
            applyQuickFilter({ type: "topics", topics, label: "Topics needing an article" })
          }
        />
      )}
      {allClassified && <Articles cases={rangeFilteredCases} isDemoDataset={isDemoDataset} />}

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
