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
  firstActiveIdx: number;
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
      firstActiveIdx: firstActive,
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

function average(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Three independent rules decide whether a topic is flagged as needing a
// knowledge article. A topic qualifies if ANY rule fires:
//
//   A. Brand new this month, and louder than a typical new topic (its first
//      month beats the average first-month volume of every other topic).
//   B. First appeared within the last 4 months, and its latest month is
//      more than 30% above the average of its own earlier months.
//   C. First appeared within the last 5 months, and has increased (or held)
//      every month since, with a net rise from its first month to its last.
//
// A topic that has already peaked and is now declining (e.g. spiked, then
// fell) deliberately does not qualify under any rule — it already got its
// moment; the point is to catch what's still climbing.
export function suggestedTopics(cases: Case[]): SuggestedTopic[] {
  const { rows } = buildMonthlySeries(cases);
  const unpublished = rows.filter((r) => !publishedMonth(r.topicKey));
  const firstMonthVolumes = rows.map((r) => r.counts[r.firstActiveIdx]);

  const suggestions: SuggestedTopic[] = [];

  for (const row of unpublished) {
    const { counts, firstActiveIdx } = row;
    const lastIdx = counts.length - 1;
    const ageMonths = lastIdx - firstActiveIdx + 1;
    const latest = counts[lastIdx];
    let reason: string | null = null;

    // Rule A: brand new this month, louder than a typical new topic.
    if (firstActiveIdx === lastIdx) {
      const othersFirstMonths = rows
        .filter((r) => r.topicKey !== row.topicKey)
        .map((r) => r.counts[r.firstActiveIdx]);
      const baseline = average(othersFirstMonths.length > 0 ? othersFirstMonths : firstMonthVolumes);
      if (baseline > 0 && latest > baseline) {
        reason = `New this month (${monthLabel(row.months[lastIdx])}) with ${latest} cases — above the ${baseline.toFixed(1)}-case average for a brand-new topic.`;
      }
    }

    // Rule B: appeared within the last 4 months; latest month >30% above
    // the average of its own earlier months.
    if (!reason && ageMonths <= 4 && lastIdx > firstActiveIdx) {
      const earlier = counts.slice(firstActiveIdx, lastIdx);
      const earlierAvg = average(earlier);
      if (earlierAvg > 0 && latest > earlierAvg * 1.3) {
        const pct = Math.round(((latest - earlierAvg) / earlierAvg) * 100);
        reason = `${monthLabel(row.months[lastIdx])}: ${latest} cases, ${pct}% above its ${earlierAvg.toFixed(1)}-case average over the prior ${earlier.length} month${earlier.length > 1 ? "s" : ""}.`;
      }
    }

    // Rule C: appeared within the last 5 months, never dropped month over
    // month, with a net increase from first to last.
    if (!reason && ageMonths <= 5 && lastIdx > firstActiveIdx) {
      const window = counts.slice(firstActiveIdx);
      const steady = window.every((n, i) => i === 0 || n >= window[i - 1]);
      if (steady && window[window.length - 1] > window[0]) {
        reason = `Steady increase over ${ageMonths} months: ${window[0]} → ${window[window.length - 1]} cases, never dropping.`;
      }
    }

    if (reason) {
      suggestions.push({ topicKey: row.topicKey, label: row.label, reason, recentCount: latest });
    }
  }

  return suggestions.sort((a, b) => b.recentCount - a.recentCount);
}
