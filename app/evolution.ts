// Shared trend logic for the demo dataset's ground-truth `Topic` field.
// Used by Dashboard.tsx (the monthly evolution table) and Articles.tsx
// (suggested topics to write about). Demo-only: real uploads have no Topic.

import type { Case } from "./page";

export const TOPIC_LABELS: Record<string, string> = {
  "battery-drain": "AeroSnap X200 battery drain",
  "firmware-freeze": "Lumina OLED firmware freeze",
  "shipping-delay": "Rotterdam shipping delays",
  "pairing-failure": "SoundWave Bluetooth pairing failures",
  "compressor-noise": "FrostCore compressor noise",
};

// Topics that already have a published knowledge article, and when it went
// out — part of the demo's fixed narrative (kept in sync with
// scripts/generate-demo-data.mjs). Not session state: this is presented as
// having already happened before the demo starts, so the "did it work"
// story is reliable and reproducible on every run.
export const PUBLISHED_ARTICLES: Record<string, string> = {
  "battery-drain": "2026-06",
};

export function publishedMonth(topicKey: string): string | undefined {
  return PUBLISHED_ARTICLES[topicKey];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export function monthLabel(key: string): string {
  const [, m] = key.split("-").map(Number);
  return MONTH_NAMES[(m ?? 1) - 1] ?? key;
}

export type Trend = "new" | "rising" | "falling" | "resolved" | "steady";

export type TopicRow = {
  topicKey: string;
  label: string;
  months: string[];
  counts: number[];
  total: number;
  trend: Trend;
};

export function buildMonthlySeries(cases: Case[]): { months: string[]; rows: TopicRow[] } {
  const months = [...new Set(cases.filter((c) => c.CreatedDate).map((c) => monthKey(c.CreatedDate)))].sort();

  const byTopic = new Map<string, number[]>();
  for (const c of cases) {
    if (!c.Topic || c.Topic === "noise" || !c.CreatedDate) continue;
    if (!byTopic.has(c.Topic)) byTopic.set(c.Topic, months.map(() => 0));
    const idx = months.indexOf(monthKey(c.CreatedDate));
    if (idx >= 0) byTopic.get(c.Topic)![idx]++;
  }

  const rows: TopicRow[] = [];
  for (const [topicKey, counts] of byTopic) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const firstActive = counts.findIndex((n) => n > 0);
    const lastActive = counts.length - 1 - [...counts].reverse().findIndex((n) => n > 0);

    let trend: Trend;
    if (counts[counts.length - 1] === 0 && lastActive < counts.length - 1) {
      // Had activity, then went quiet for at least the most recent month.
      trend = "resolved";
    } else if (firstActive >= counts.length - 2) {
      // First appeared in the last two months and is still active — genuinely new.
      trend = "new";
    } else {
      const half = Math.max(1, Math.floor(counts.length / 2));
      const earlyAvg = counts.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const recentAvg = counts.slice(-half).reduce((a, b) => a + b, 0) / half;
      if (recentAvg > earlyAvg * 1.5) trend = "rising";
      else if (recentAvg < earlyAvg * 0.5) trend = "falling";
      else trend = "steady";
    }

    rows.push({
      topicKey,
      label: TOPIC_LABELS[topicKey] ?? topicKey,
      months,
      counts,
      total,
      trend,
    });
  }

  rows.sort((a, b) => b.counts[b.counts.length - 1] - a.counts[a.counts.length - 1]);
  return { months, rows };
}

export type ArticleImpact = {
  topicKey: string;
  label: string;
  publishedMonth: string;
  beforeAvg: number;
  afterAvg: number;
  pctChange: number;
};

// For a topic with a published article, compares average monthly volume
// before vs. from-and-after the publish month, using whatever months are
// actually present in the current (possibly filtered) data.
export function articleImpacts(cases: Case[]): ArticleImpact[] {
  const { rows } = buildMonthlySeries(cases);
  const impacts: ArticleImpact[] = [];

  for (const row of rows) {
    const published = publishedMonth(row.topicKey);
    if (!published) continue;
    const splitIdx = row.months.findIndex((m) => m >= published);
    if (splitIdx <= 0 || splitIdx >= row.months.length) continue; // need data on both sides

    const before = row.counts.slice(0, splitIdx);
    const after = row.counts.slice(splitIdx);
    const beforeAvg = before.reduce((a, b) => a + b, 0) / before.length;
    const afterAvg = after.reduce((a, b) => a + b, 0) / after.length;
    if (beforeAvg === 0) continue;
    const pctChange = Math.round(((afterAvg - beforeAvg) / beforeAvg) * 100);

    impacts.push({ topicKey: row.topicKey, label: row.label, publishedMonth: published, beforeAvg, afterAvg, pctChange });
  }

  return impacts;
}

export type SuggestedTopic = {
  topicKey: string;
  label: string;
  reason: string;
  recentCount: number;
};

export function suggestedTopics(cases: Case[]): SuggestedTopic[] {
  const { rows } = buildMonthlySeries(cases);
  const suggestions: SuggestedTopic[] = [];

  for (const row of rows) {
    if (row.trend !== "rising" && row.trend !== "new") continue;
    if (publishedMonth(row.topicKey)) continue;
    const recentSpan = Math.min(2, row.counts.length);
    const recentCount = row.counts.slice(-recentSpan).reduce((a, b) => a + b, 0);
    if (recentCount < 3) continue;

    const recentMonths = row.months.slice(-recentSpan).map(monthLabel).join("–");
    let reason: string;
    if (row.trend === "new") {
      reason = `First appeared in ${monthLabel(row.months[row.months.findIndex((_, i) => row.counts[i] > 0)])}, ${row.total} cases since. New topic, no article exists yet.`;
    } else {
      const earlySpan = Math.min(2, row.counts.length);
      const earlyCount = row.counts.slice(0, earlySpan).reduce((a, b) => a + b, 0);
      const earlyMonths = row.months.slice(0, earlySpan).map(monthLabel).join("–");
      reason = `${earlyCount} cases in ${earlyMonths} → ${recentCount} cases in ${recentMonths}. Growing fast, no article yet.`;
    }

    suggestions.push({ topicKey: row.topicKey, label: row.label, reason, recentCount });
  }

  return suggestions.sort((a, b) => b.recentCount - a.recentCount);
}
