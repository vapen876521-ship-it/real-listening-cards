"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, Library, Search, Sparkles, Trash2 } from "lucide-react";
import type { ClipResult, ReviewRecord, WordbookCard } from "@/lib/types";
import { getOralVariants, highlightTerms } from "@/lib/pronunciation";

export default function Home() {
  const [tab, setTab] = useState<"search" | "wordbook" | "review">("search");
  const [query, setQuery] = useState("what do you want to do");
  const [results, setResults] = useState<ClipResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wordbook, setWordbook] = useState<WordbookCard[]>(() => loadWordbook());
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return wordbook.filter((card) => new Date(card.dueAt).getTime() <= now);
  }, [wordbook]);

  const current = dueCards[0];

  async function runSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "搜索失败。");
        return;
      }

      setResults(data.results || []);
    } catch {
      setError("搜索失败。请检查网络或 Vercel 环境变量。");
    } finally {
      setLoading(false);
    }
  }

  function persist(cards: WordbookCard[]) {
    setWordbook(cards);
    localStorage.setItem("real-listening-live-wordbook", JSON.stringify(cards));
  }

  function addCard(result: ClipResult) {
    const now = new Date().toISOString();
    persist([{ ...result, addedAt: now, dueAt: now, reviews: [] }, ...wordbook]);
    setTab("wordbook");
  }

  function deleteCard(id: string) {
    persist(wordbook.filter((card) => card.id !== id));
  }

  function submitReview(rating: ReviewRecord["rating"]) {
    if (!current) return;
    const reviewed: WordbookCard = {
      ...current,
      dueAt: nextDueDate(rating),
      reviews: [...current.reviews, { reviewedAt: new Date().toISOString(), rating, answer }]
    };
    persist(wordbook.map((card) => (card.addedAt === current.addedAt ? reviewed : card)));
    setAnswer("");
    setShowAnswer(false);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="card">
          <div className="eyebrow"><Sparkles size={16} /> Live YouTube Search</div>
          <h1>搜索真实视频，直接嵌入播放。</h1>
          <p>输入单词、词组或句子，系统搜索 YouTube 公开视频，自动嵌入视频，显示中文意思、词性、词形变化、口语变体和字幕区域。</p>
        </div>
        <div className="card stats">
          <div className="stat"><b>{dueCards.length}</b><p>今日待复习</p></div>
          <div className="stat"><b>{wordbook.length}</b><p>单词本卡片</p></div>
        </div>
      </section>

      <nav className="tabs">
        <button className={`tab ${tab === "search" ? "active" : ""}`} onClick={() => setTab("search")}><Search size={16} /> 搜索</button>
        <button className={`tab ${tab === "wordbook" ? "active" : ""}`} onClick={() => setTab("wordbook")}><Library size={16} /> 单词本</button>
        <button className={`tab ${tab === "review" ? "active" : ""}`} onClick={() => setTab("review")}><BookOpenCheck size={16} /> 复习</button>
      </nav>

      {tab === "search" && (
        <section className="card">
          <div className="searchbar">
            <div>
              <label>搜索真实发音</label>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} />
            </div>
            <button className="btn" onClick={runSearch}>{loading ? "搜索中..." : "搜索"}</button>
          </div>

          <div className="notice">这一版会真实调用 YouTube Data API，并自动嵌入视频。必须在 Vercel 里配置 YOUTUBE_API_KEY。</div>
          {error && <div className="error">{error}</div>}

          <div className="results">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} query={query} onAdd={() => addCard(result)} />
            ))}
          </div>
        </section>
      )}

      {tab === "wordbook" && (
        <section className="card">
          {wordbook.length === 0 ? (
            <Empty title="单词本还是空的" text="先搜索，然后点击添加到单词本。" />
          ) : (
            wordbook.map((card) => (
              <article className="word" key={`${card.id}-${card.addedAt}`}>
                <div className="wordtop">
                  <div>
                    <h3>{card.standardText}</h3>
                    <p>{card.translationZh}</p>
                  </div>
                  <button className="btn ghost" onClick={() => deleteCard(card.id)}>删除 <Trash2 size={16} /></button>
                </div>
                <Pills result={card} />
                <div className="subtitle" dangerouslySetInnerHTML={{ __html: highlighted(card, card.standardText) }} />
              </article>
            ))
          )}
        </section>
      )}

      {tab === "review" && (
        <section className="card">
          {!current ? (
            <Empty title="今天没有待复习卡片" text="新增卡片后会自动进入复习计划。" />
          ) : (
            <div>
              <h2>听写复习</h2>
              <div className="video">
                <iframe src={embedUrl(current)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
              <textarea className="textarea" style={{ marginTop: 14 }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="输入你听到的英文" />
              <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? "隐藏答案" : "显示答案"}</button>
              {showAnswer && (
                <>
                  <div className="info">
                    <Info label="标准文本" value={current.standardText} />
                    <Info label="中文意思" value={current.translationZh} />
                    <Info label="词性" value={current.lexical.pos.join(" / ")} />
                    <Info label="词形变化" value={current.lexical.inflections.join(" · ")} />
                  </div>
                  <div className="subtitle" dangerouslySetInnerHTML={{ __html: highlighted(current, current.standardText) }} />
                </>
              )}
              <div className="actions">
                <button className="btn danger" onClick={() => submitReview("again")}>没听懂</button>
                <button className="btn secondary" onClick={() => submitReview("hard")}>勉强</button>
                <button className="btn secondary" onClick={() => submitReview("good")}>听懂了</button>
                <button className="btn" onClick={() => submitReview("easy")}>很简单</button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function ResultCard({ result, query, onAdd }: { result: ClipResult; query: string; onAdd: () => void }) {
  return (
    <article className="result">
      <div>
        <div className="video">
          <iframe src={embedUrl(result)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <div className="subtitle" dangerouslySetInnerHTML={{ __html: highlighted(result, query) }} />
      </div>
      <div>
        <h3>{result.title}</h3>
        <p>{result.translationZh}</p>
        <Pills result={result} />
        <div className="info">
          <Info label="中文意思" value={result.lexical.zh} />
          <Info label="词性" value={result.lexical.pos.join(" / ")} />
          <Info label="词形变化" value={result.lexical.inflections.join(" · ")} />
          <Info label="口语听感" value={result.spokenText} />
        </div>
        <div className="box"><small>说明</small><div>{result.notes}</div></div>
        <button className="btn" style={{ marginTop: 14 }} onClick={onAdd}>添加到单词本</button>
      </div>
    </article>
  );
}

function Pills({ result }: { result: ClipResult }) {
  return (
    <div className="meta">
      <span className={`pill ${result.sourceType === "caption_unavailable" ? "amber" : "green"}`}>
        {result.sourceType === "caption_unavailable" ? "未取到字幕" : "真实视频"}
      </span>
      {result.lexical.variants.map((v) => <span className="pill amber" key={`${v.from}-${v.to}`}>{v.from} → {v.to}</span>)}
      {result.tags.slice(0, 5).map((tag) => <span className="pill" key={tag}>{tag}</span>)}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="box"><small>{label}</small><div>{value}</div></div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><h2>{title}</h2><p>{text}</p></div>;
}

function embedUrl(result: { videoId: string; startTime: number; endTime?: number }) {
  const start = Math.floor(result.startTime || 0);
  const end = Math.floor(result.endTime || start + 8);
  return `https://www.youtube.com/embed/${result.videoId}?start=${start}&end=${end}&rel=0`;
}

function highlighted(result: ClipResult, query: string) {
  const oral = getOralVariants(query || result.standardText);
  return highlightTerms(result.subtitle, [query, result.standardText, result.spokenText, ...oral.variants]);
}

function loadWordbook(): WordbookCard[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("real-listening-live-wordbook") || "[]");
  } catch {
    return [];
  }
}

function nextDueDate(rating: ReviewRecord["rating"]) {
  const date = new Date();
  if (rating === "again") date.setMinutes(date.getMinutes() + 10);
  if (rating === "hard") date.setDate(date.getDate() + 1);
  if (rating === "good") date.setDate(date.getDate() + 3);
  if (rating === "easy") date.setDate(date.getDate() + 7);
  return date.toISOString();
}
