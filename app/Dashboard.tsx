"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Case } from "./page";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Canonical category order — fixes each category to the same color slot
// regardless of which categories are actually present in the data.
const CATEGORY_ORDER = [
  "Product Defect",
  "How-To Question",
  "Billing",
  "Shipping/Logistics",
  "Warranty",
  "Software/Firmware",
  "Other",
];
const CATEGORY_COLORS: Record<string, string> = {
  "Product Defect": "#2a78d6",
  "How-To Question": "#008300",
  Billing: "#e87ba4",
  "Shipping/Logistics": "#eda100",
  Warranty: "#1baf7a",
  "Software/Firmware": "#eb6834",
  Other: "#4a3aa7",
};

const SENTIMENT_ORDER = ["Positive", "Neutral", "Negative", "Angry"];
const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#0ca30c",
  Neutral: "#898781",
  Negative: "#fab219",
  Angry: "#d03b3b",
};

const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";

type Issue = { headline: string; detail: string };

function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function buildCategoryData(cases: Case[]) {
  const counts = new Map<string, number>();
  for (const c of cases) {
    if (!c.category || c.category === "Unclassified") continue;
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  return CATEGORY_ORDER.filter((cat) => counts.has(cat)).map((cat) => ({
    category: cat,
    count: counts.get(cat) ?? 0,
  }));
}

function buildSentimentData(cases: Case[]) {
  const counts = new Map<string, number>();
  for (const c of cases) {
    if (!c.sentiment) continue;
    counts.set(c.sentiment, (counts.get(c.sentiment) ?? 0) + 1);
  }
  return SENTIMENT_ORDER.filter((s) => counts.has(s)).map((s) => ({
    sentiment: s,
    count: counts.get(s) ?? 0,
  }));
}

function buildVolumeData(cases: Case[]) {
  const activeCategories = CATEGORY_ORDER.filter((cat) => cases.some((c) => c.category === cat));
  const byWeek = new Map<string, Record<string, number>>();
  for (const c of cases) {
    if (!c.category || c.category === "Unclassified" || !c.CreatedDate) continue;
    const week = weekStart(c.CreatedDate);
    if (!byWeek.has(week)) byWeek.set(week, {});
    const row = byWeek.get(week)!;
    row[c.category] = (row[c.category] ?? 0) + 1;
  }

  // Walk every week between the first and last case so gaps are true zeros,
  // not missing points — otherwise the line interpolation overshoots across
  // the gap and invents spikes that aren't in the data.
  const weekKeys = [...byWeek.keys()].sort();
  const allWeeks: string[] = [];
  if (weekKeys.length > 0) {
    const cursor = new Date(weekKeys[0]);
    const end = new Date(weekKeys[weekKeys.length - 1]);
    while (cursor <= end) {
      allWeeks.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }

  return {
    activeCategories,
    data: allWeeks.map((week) => {
      const row = byWeek.get(week) ?? {};
      const filled: Record<string, string | number> = { week };
      for (const cat of activeCategories) filled[cat] = row[cat] ?? 0;
      return filled;
    }),
  };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="chart-tooltip-row">
          <span className="chart-tooltip-swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="chart-tooltip-value">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ cases, isDemoDataset }: { cases: Case[]; isDemoDataset: boolean }) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIssues(null);
    setIssuesError(null);

    async function loadDemoSummary() {
      try {
        const res = await fetch("/demo-summary.json");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setIssues(data.issues);
      } catch {
        if (!cancelled) setIssuesError("Could not load the pre-analyzed summary.");
      }
    }

    async function generateLiveSummary() {
      if (DEMO_MODE) {
        setIssuesError("AI-written summaries are disabled in this public demo. Try “Load demo data” instead.");
        return;
      }
      setIssuesLoading(true);
      try {
        const res = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cases: cases.map((c) => ({
              category: c.category,
              root_cause: c.root_cause,
              sentiment: c.sentiment,
              urgency: c.urgency,
              CreatedDate: c.CreatedDate,
            })),
          }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setIssues(data.issues);
      } catch {
        if (!cancelled) setIssuesError("Could not generate the AI summary right now.");
      } finally {
        if (!cancelled) setIssuesLoading(false);
      }
    }

    if (isDemoDataset) loadDemoSummary();
    else generateLiveSummary();

    return () => {
      cancelled = true;
    };
  }, [cases, isDemoDataset]);

  const categoryData = buildCategoryData(cases);
  const sentimentData = buildSentimentData(cases);
  const { activeCategories, data: volumeData } = buildVolumeData(cases);

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>Cases by category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
              <XAxis type="number" tick={{ fill: AXIS_COLOR, fontSize: 12 }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="category"
                width={140}
                tick={{ fill: "#52514e", fontSize: 12 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
              <Bar dataKey="count" name="Cases" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Sentiment distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sentimentData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
              <XAxis type="number" tick={{ fill: AXIS_COLOR, fontSize: 12 }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="sentiment"
                width={90}
                tick={{ fill: "#52514e", fontSize: 12 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="count" name="Cases" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {sentimentData.map((entry) => (
                  <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-card-wide">
          <h3>Case volume over time, by category</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={volumeData} margin={{ left: 0, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="week"
                tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis tick={{ fill: AXIS_COLOR, fontSize: 12 }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="plainline"
                wrapperStyle={{ fontSize: 12, color: "#52514e" }}
              />
              {activeCategories.map((cat) => (
                <Line
                  key={cat}
                  type="linear"
                  dataKey={cat}
                  name={cat}
                  stroke={CATEGORY_COLORS[cat]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="issues-card">
        <h3>Top emerging issues</h3>
        {issuesLoading && <p className="issues-loading">Analyzing patterns across all cases…</p>}
        {issuesError && <p className="notice error">{issuesError}</p>}
        {issues && (
          <ol className="issues-list">
            {issues.map((issue, i) => (
              <li key={i}>
                <h4>{issue.headline}</h4>
                <p>{issue.detail}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
