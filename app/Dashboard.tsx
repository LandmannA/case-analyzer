"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Case } from "./page";
import { buildMonthlySeries, monthKey, monthLabel, publishedMonth, suggestedTopics, type Trend } from "./evolution";

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
  "Product Defect": "#f4685d",
  "How-To Question": "#3dc9b0",
  Billing: "#e8779e",
  "Shipping/Logistics": "#f4b740",
  Warranty: "#8fdd5e",
  "Software/Firmware": "#4a90e2",
  Other: "#8b7fe8",
};

const SENTIMENT_ORDER = ["Positive", "Neutral", "Negative", "Angry"];
const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#8fdd5e",
  Neutral: "#9aa1b2",
  Negative: "#f4b740",
  Angry: "#f4685d",
};

const TOPIC_COLORS: Record<string, string> = {
  "battery-drain": "#8fdd5e",
  "firmware-freeze": "#f4685d",
  "shipping-delay": "#f4b740",
  "pairing-failure": "#4a90e2",
};

const GRID_COLOR = "rgba(255, 255, 255, 0.08)";
const AXIS_COLOR = "#9aa1b2";

// Statistical trend alone can't say *why* volume dropped — only that it did.
// We only claim the knowledge-article generator gets the credit for topics
// with a published article in PUBLISHED_ARTICLES (evolution.ts); otherwise a
// decline is reported without guessing at the cause.
function evolutionBadge(topicKey: string, trend: Trend): { label: string; className: string } {
  const published = publishedMonth(topicKey);
  if (published) {
    const label = `Article published ${monthLabel(published)} — ${trend === "resolved" ? "deflected" : "monitoring"}`;
    return { label, className: trend === "resolved" ? "deflected" : "steady" };
  }
  if (trend === "new") return { label: "New topic", className: "new-topic" };
  if (trend === "rising") return { label: "Emerging — no article yet", className: "emerging" };
  if (trend === "resolved") return { label: "Resolved", className: "resolved" };
  if (trend === "falling") return { label: "Declining", className: "steady" };
  return { label: "Steady", className: "steady" };
}

type Issue = { headline: string; detail: string };

function StackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}
function FlameIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-1-2-1-2 2 1 3 3 3 5a5 5 0 0 1-10 0c0-4 3-6 5-11z" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16l6-6 4 4 6-8" />
      <path d="M14 6h6v6" />
    </svg>
  );
}

function KpiTile({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  onClick,
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={onClick ? "kpi-tile kpi-tile-clickable" : "kpi-tile"}
      style={{ borderTopColor: iconColor }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {onClick && <div className="kpi-tile-hint">View cases →</div>}
    </div>
  );
}

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

export default function Dashboard({
  cases,
  isDemoDataset,
  onFilterHighUrgency,
  onFilterNeedsArticleTopics,
}: {
  cases: Case[];
  isDemoDataset: boolean;
  onFilterHighUrgency?: () => void;
  onFilterNeedsArticleTopics?: (topics: string[]) => void;
}) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);

  const maxMonth = cases.reduce((max, c) => (c.CreatedDate && monthKey(c.CreatedDate) > max ? monthKey(c.CreatedDate) : max), "");
  const summaryFile = maxMonth > "2026-05" ? "/demo-summary-month2.json" : "/demo-summary-month1.json";

  useEffect(() => {
    let cancelled = false;
    setIssues(null);
    setIssuesError(null);

    async function loadDemoSummary() {
      try {
        const res = await fetch(summaryFile);
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
  }, [cases, isDemoDataset, summaryFile]);

  const categoryData = buildCategoryData(cases);
  const sentimentData = buildSentimentData(cases);
  const { activeCategories, data: volumeData } = buildVolumeData(cases);
  const { months: evolutionMonths, rows: evolutionRows } = isDemoDataset
    ? buildMonthlySeries(cases)
    : { months: [], rows: [] };

  const totalCases = cases.length;
  const negativeCount = cases.filter((c) => c.sentiment === "Negative" || c.sentiment === "Angry").length;
  const negativePct = totalCases > 0 ? Math.round((negativeCount / totalCases) * 100) : 0;
  const highUrgencyCount = cases.filter((c) => c.urgency === "High").length;
  const attentionTopics = isDemoDataset ? suggestedTopics(cases).map((s) => s.topicKey) : [];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-eyebrow">Overview</div>
          <h2 className="dashboard-title">Case intelligence</h2>
        </div>
      </div>

      <div className="kpi-row">
        <KpiTile
          icon={<StackIcon />}
          iconBg="rgba(74, 144, 226, 0.16)"
          iconColor="#4a90e2"
          value={String(totalCases)}
          label="Cases analyzed"
        />
        <KpiTile
          icon={<AlertIcon />}
          iconBg="rgba(244, 183, 64, 0.16)"
          iconColor="#f4b740"
          value={`${negativePct}%`}
          label="Negative or angry sentiment"
        />
        <KpiTile
          icon={<FlameIcon />}
          iconBg="rgba(244, 104, 93, 0.16)"
          iconColor="#f4685d"
          value={String(highUrgencyCount)}
          label="High-urgency cases"
          onClick={onFilterHighUrgency}
        />
        {isDemoDataset && (
          <KpiTile
            icon={<TrendIcon />}
            iconBg="rgba(143, 221, 94, 0.16)"
            iconColor="#8fdd5e"
            value={String(attentionTopics.length)}
            label="Topics needing an article"
            onClick={
              attentionTopics.length > 0 && onFilterNeedsArticleTopics
                ? () => onFilterNeedsArticleTopics(attentionTopics)
                : undefined
            }
          />
        )}
      </div>

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
                tick={{ fill: "#f5f6fa", fontSize: 12 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(74,144,226,0.08)" }} />
              <Bar dataKey="count" name="Cases" fill="#4a90e2" radius={[0, 8, 8, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Sentiment distribution</h3>
          <div className="donut-layout">
            <div className="donut-chart">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    dataKey="count"
                    nameKey="sentiment"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="#0b0e14"
                    strokeWidth={2}
                  >
                    {sentimentData.map((entry) => (
                      <Cell key={entry.sentiment} fill={SENTIMENT_COLORS[entry.sentiment]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <div className="donut-center-value">{totalCases}</div>
                <div className="donut-center-label">cases</div>
              </div>
            </div>
            <div className="donut-legend">
              {sentimentData.map((entry) => (
                <div key={entry.sentiment} className="donut-legend-row">
                  <span className="donut-legend-dot" style={{ background: SENTIMENT_COLORS[entry.sentiment] }} />
                  <span className="donut-legend-name">{entry.sentiment}</span>
                  <span className="donut-legend-value">{entry.count}</span>
                  <span className="donut-legend-pct">
                    {totalCases > 0 ? Math.round((entry.count / totalCases) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
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
                wrapperStyle={{ fontSize: 12, color: "#9aa1b2" }}
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
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#0b0e14" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {evolutionRows.length > 0 && (
        <div className="evolution-card">
          <h3>Month-by-month evolution</h3>
          <p className="evolution-subtitle">
            How case volume shifted per topic across the selected time frame — and where a published
            knowledge article has already helped.
          </p>
          <div className="evolution-table-scroll">
            <table className="evolution-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  {evolutionMonths.map((m) => (
                    <th key={m} className="evolution-count">
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evolutionRows.map((row) => {
                  const peak = Math.max(...row.counts);
                  const badge = evolutionBadge(row.topicKey, row.trend);
                  return (
                    <tr key={row.topicKey}>
                      <td className="evolution-topic">
                        <span className="evolution-dot" style={{ background: TOPIC_COLORS[row.topicKey] ?? "#9aa1b2" }} />
                        {row.label}
                      </td>
                      {row.counts.map((count, i) => (
                        <td key={evolutionMonths[i]} className={`evolution-count${count === peak && count > 0 ? " evolution-peak" : ""}`}>
                          {count}
                        </td>
                      ))}
                      <td>
                        <span className={`evo-badge ${badge.className}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
