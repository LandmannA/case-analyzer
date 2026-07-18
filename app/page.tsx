"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";

const REQUIRED_COLUMNS = ["Subject", "Description"];
const ROW_CAP = 300;

export type Case = {
  CaseNumber: string;
  Subject: string;
  Description: string;
  Product: string;
  Country: string;
  Priority: string;
  Status: string;
  CreatedDate: string;
};

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

export default function Home() {
  const [cases, setCases] = useState<Case[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch("/demo-cases.csv");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      applyParsed(parseCsv(text), "Demo dataset");
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
            <span>{cases.length} cases loaded</span>
          </div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !error && (
          <p className="empty-state">
            No cases loaded yet — click “Load demo data” above to see the tool in action.
          </p>
        )
      )}
    </main>
  );
}
