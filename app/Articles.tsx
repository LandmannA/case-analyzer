"use client";

import type { Case } from "./page";
import { articleImpacts, monthLabel, suggestedTopics } from "./evolution";

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="info-tooltip" tabIndex={0} aria-label={text}>
      <span className="info-tooltip-icon" aria-hidden="true">
        i
      </span>
      <span className="info-tooltip-content">{text}</span>
    </span>
  );
}

const SUGGESTION_LOGIC_EXPLAINER =
  "A topic is suggested when any of these hold, and no article is published for it yet: (A) it's brand new this month and louder than a typical new topic; (B) it appeared within the last 4 months and its latest month is over 30% above its own earlier average; or (C) it appeared within the last 5 months and has risen or held every month since, with a net increase overall. A topic that already peaked and is now declining doesn't qualify — it had its moment. This is fixed rule-based logic, not an AI judgment call, applied to this demo's pre-labeled topics. On a real upload, the same rules would run against the AI's own category/root-cause classifications instead.";

export default function Articles({ cases, isDemoDataset }: { cases: Case[]; isDemoDataset: boolean }) {
  if (!isDemoDataset) return null;

  const suggestions = suggestedTopics(cases);
  const impacts = articleImpacts(cases);

  if (suggestions.length === 0 && impacts.length === 0) return null;

  return (
    <div className="articles-card">
      <h3>
        Knowledge article suggestions
        <InfoTooltip text={SUGGESTION_LOGIC_EXPLAINER} />
      </h3>

      {suggestions.length > 0 && (
        <div className="suggested-topics">
          <div className="suggested-topics-label">Suggested topics to write about, based on the data</div>
          <div className="suggested-topics-list">
            {suggestions.map((s) => (
              <div key={s.topicKey} className="suggested-topic-chip">
                <span className="suggested-topic-name">{s.label}</span>
                <span className="suggested-topic-reason">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {impacts.length > 0 && (
        <div className="article-impact">
          <div className="suggested-topics-label">Published articles &amp; their impact</div>
          <div className="article-impact-list">
            {impacts.map((imp) => (
              <div key={imp.topicKey} className="article-impact-row">
                <div className="article-impact-header">
                  <span className="article-impact-name">{imp.label}</span>
                  <span className="article-impact-month">Published {monthLabel(imp.publishedMonth)} 2026</span>
                </div>
                <div className="article-impact-stat">
                  <span className={imp.pctChange <= 0 ? "article-impact-pct good" : "article-impact-pct bad"}>
                    {imp.pctChange > 0 ? "+" : ""}
                    {imp.pctChange}%
                  </span>
                  <span className="article-impact-detail">
                    {imp.beforeAvg.toFixed(1)} → {imp.afterAvg.toFixed(1)} cases/month since publishing
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
