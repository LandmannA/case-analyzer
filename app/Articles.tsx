"use client";

import { useEffect, useState } from "react";
import type { Case } from "./page";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const SAMPLE_SIZE = 8;

type Article = { title: string; body: string };
type ArticlePair = { internal: Article; customer: Article };

function ArticleCard({ label, article }: { label: string; article: Article }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(`${article.title}\n\n${article.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="article-card">
      <div className="article-card-header">
        <span className="article-label">{label}</span>
        <button className="btn-secondary" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <h4>{article.title}</h4>
      <p className="article-body">{article.body}</p>
    </div>
  );
}

export default function Articles({ cases, isDemoDataset }: { cases: Case[]; isDemoDataset: boolean }) {
  const categoryOptions = [
    ...new Set(cases.map((c) => c.category).filter((v): v is string => !!v && v !== "Unclassified")),
  ];
  const [category, setCategory] = useState(categoryOptions[0] ?? "");
  const [articles, setArticles] = useState<ArticlePair | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoArticles, setDemoArticles] = useState<Record<string, ArticlePair> | null>(null);

  useEffect(() => {
    if (!isDemoDataset) return;
    fetch("/demo-articles.json")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setDemoArticles(data))
      .catch(() => setDemoArticles(null));
  }, [isDemoDataset]);

  async function generate() {
    if (!category) return;
    setLoading(true);
    setError(null);
    setArticles(null);

    if (isDemoDataset) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const pair = demoArticles?.[category];
      if (pair) setArticles(pair);
      else setError("No pre-generated articles found for this category.");
      setLoading(false);
      return;
    }

    if (DEMO_MODE) {
      setError("Live generation is disabled in this public demo. Try “Load demo data” instead.");
      setLoading(false);
      return;
    }

    const sample = cases
      .filter((c) => c.category === category)
      .slice(0, SAMPLE_SIZE)
      .map((c) => ({ Subject: c.Subject, Description: c.Description, root_cause: c.root_cause ?? "" }));

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, cases: sample }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setArticles(data.articles);
    } catch {
      setError("Could not generate articles right now.");
    } finally {
      setLoading(false);
    }
  }

  if (categoryOptions.length === 0) return null;

  return (
    <div className="articles-card">
      <h3>Knowledge article generator</h3>
      <div className="articles-controls">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoryOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? "Generating…" : "Generate articles"}
        </button>
      </div>
      {error && <div className="notice error">{error}</div>}
      {articles && (
        <div className="articles-grid">
          <ArticleCard label="Internal — agent facing" article={articles.internal} />
          <ArticleCard label="Customer facing" article={articles.customer} />
        </div>
      )}
    </div>
  );
}
