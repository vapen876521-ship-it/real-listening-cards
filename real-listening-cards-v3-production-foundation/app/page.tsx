"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Search, Trash2 } from "lucide-react";
import type { Analysis, PronunciationSample, ReviewMode, ReviewRecord, SearchResponse, WordbookItem } from "@/lib/types";
import { answerAccepted } from "@/lib/answer";
import { detectOralVariants, highlightTerms } from "@/lib/pronunciation";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [tab, setTab] = useState<"search" | "wordbook" | "review">("search");
  const [query, setQuery] = useState("april");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [highQualitySamples, setHighQualitySamples] = useState<PronunciationSample[]>([]);
  const [backupSamples, setBackupSamples] = useState<PronunciationSample[]>([]);
  const [active, setActive] = useState<PronunciationSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [wordbook, setWordbook] = useState<WordbookItem[]>([]);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("dictation");
  const [lastAccepted, setLastAccepted] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const local = loadLocalWordbook();
    setWordbook(local);

    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadCloudWordbook(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadCloudWordbook(session.user.id);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const due = useMemo(() => {
    const now = Date.now();
    return wordbook.filter((item) => new Date(item.dueAt).getTime() <= now && item.samples.length > 0);
  }, [wordbook]);

  const current = due[0];

  async function runSearch() {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setHighQualitySamples([]);
    setBackupSamples([]);
    setActive(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as SearchResponse;

      if (!res.ok || data.error) {
        setError(data.error || "搜索失败。");
        return;
      }

      setAnalysis(data.analysis);
      setHighQualitySamples(data.highQualitySamples);
      setBackupSamples(data.backupSamples);
      setActive(data.highQualitySamples[0] || data.backupSamples[0] || null);
    } catch {
      setError("搜索失败。请检查网络或 Vercel 环境变量。");
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    if (!supabase || !email.trim()) return;
    await supabase.auth.signInWithOtp({ email: email.trim() });
    alert("登录链接已发送到邮箱。请打开邮件完成登录。");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setWordbook(loadLocalWordbook());
  }

  async function loadCloudWordbook(userId: string) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("wordbook_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return;

    const items = (data || []).map((row: any) => ({
      id: row.id,
      query: row.query,
      analysis: row.analysis,
      samples: row.samples,
      addedAt: row.created_at,
      dueAt: row.due_at,
      reviews: row.reviews || []
    })) as WordbookItem[];

    setWordbook(items);
  }

  async function persist(items: WordbookItem[]) {
    setWordbook(items);
    localStorage.setItem("real-listening-v3-wordbook", JSON.stringify(items));
  }

  async function addToWordbook() {
    if (!analysis) return;

    const reviewSamples = highQualitySamples.filter((sample) => sample.reviewEligible);
    if (reviewSamples.length === 0) {
      alert("没有可进入复习的高质量样本。请换一个搜索词，或只把结果作为备选查看。");
      return;
    }

    const now = new Date().toISOString();
    const item: WordbookItem = {
      id: `local-${Date.now()}`,
      query,
      analysis,
      samples: reviewSamples,
      addedAt: now,
      dueAt: now,
      reviews: []
    };

    if (supabase && user) {
      const { data, error } = await supabase
        .from("wordbook_items")
        .insert({
          user_id: user.id,
          query: item.query,
          analysis: item.analysis,
          samples: item.samples,
          due_at: item.dueAt,
          reviews: item.reviews
        })
        .select("*")
        .single();

      if (!error && data) {
        await loadCloudWordbook(user.id);
        setTab("wordbook");
        return;
      }
    }

    await persist([item, ...wordbook]);
    setTab("wordbook");
  }

  async function deleteItem(id: string) {
    if (supabase && user && !id.startsWith("local-")) {
      await supabase.from("wordbook_items").delete().eq("id", id).eq("user_id", user.id);
      await loadCloudWordbook(user.id);
      return;
    }

    await persist(wordbook.filter((item) => item.id !== id));
  }

  async function submitReview(rating: ReviewRecord["rating"]) {
    if (!current) return;

    const targets =
      reviewMode === "restore_standard"
        ? current.analysis.standardForms.length
          ? current.analysis.standardForms
          : [current.analysis.lemma]
        : [current.samples[0]?.subtitle || current.query, current.analysis.lemma, ...current.analysis.standardForms];

    const accepted = answerAccepted(answer, targets);

    const reviewed: WordbookItem = {
      ...current,
      dueAt: nextDueDate(rating),
      reviews: [...current.reviews, { reviewedAt: new Date().toISOString(), mode: reviewMode, rating, answer, accepted }]
    };

    setLastAccepted(accepted);

    if (supabase && user && !current.id.startsWith("local-")) {
      await supabase
        .from("wordbook_items")
        .update({ due_at: reviewed.dueAt, reviews: reviewed.reviews })
        .eq("id", current.id)
        .eq("user_id", user.id);

      await loadCloudWordbook(user.id);
    } else {
      await persist(wordbook.map((item) => (item.id === current.id ? reviewed : item)));
    }

    setAnswer("");
    setShowAnswer(false);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="logo">Real Listening Cards</div>
          <div className="sub">可靠解释 · 高质量读音样本 · 长期复习</div>
        </div>
        <nav className="nav">
          <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>搜索</button>
          <button className={tab === "wordbook" ? "active" : ""} onClick={() => setTab("wordbook")}>单词本</button>
          <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>复习</button>
        </nav>
      </header>

      <AccountBar email={email} setEmail={setEmail} user={user} signIn={signIn} signOut={signOut} />

      {tab === "search" && (
        <>
          <section className="hero">
            <div className="kicker">Reliable dictionary first. Strict samples second.</div>
            <h1>只保存可信解释和可复习读音。</h1>
            <p>词典信息不再猜。读音样本必须字幕精确匹配，片段足够短，才允许进入单词本和复习。</p>
          </section>

          <section className="search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
              placeholder="april / want to / what do you want to do"
            />
            <button className="btn" onClick={runSearch}>
              {loading ? "搜索中" : "搜索"} <Search size={18} />
            </button>
          </section>

          {error && <div className="error">{error}</div>}

          <section className="layout">
            <div className="panel">
              <h2>解释</h2>
              {!analysis ? (
                <div className="empty">搜索后先显示可靠解释。未知词不会被自动编造。</div>
              ) : (
                <>
                  <AnalysisPanel analysis={analysis} />
                  <button className="btn" style={{ marginTop: 18 }} onClick={addToWordbook}>
                    保存高质量样本
                  </button>
                </>
              )}
            </div>

            <div className="panel">
              <h2>高质量读音样本</h2>
              {highQualitySamples.length === 0 ? (
                <div className="empty">只有字幕精确匹配、片段长度合适的样本会出现在这里。</div>
              ) : (
                <>
                  <SampleList samples={highQualitySamples} active={active} query={query} setActive={setActive} />
                  {active && <Player sample={active} />}
                </>
              )}

              {backupSamples.length > 0 && (
                <details>
                  <summary>查看备选样本，不会进入复习</summary>
                  <div className="samples" style={{ marginTop: 12 }}>
                    <SampleList samples={backupSamples} active={active} query={query} setActive={setActive} />
                  </div>
                </details>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "wordbook" && (
        <section className="panel">
          <h2>单词本</h2>
          {wordbook.length === 0 ? (
            <div className="empty">还没有保存内容。</div>
          ) : (
            wordbook.map((item) => (
              <article className="worditem" key={item.id}>
                <div className="wordtop">
                  <div>
                    <h3>{item.analysis.lemma}</h3>
                    <div className="zh">{item.analysis.zh}</div>
                  </div>
                  <button className="btn ghost" onClick={() => deleteItem(item.id)}>删除 <Trash2 size={16} /></button>
                </div>
                <Pills analysis={item.analysis} />
                <div className="zh">{item.samples.length} 个可复习样本 · 下次复习 {new Date(item.dueAt).toLocaleString("zh-CN")}</div>
              </article>
            ))
          )}
        </section>
      )}

      {tab === "review" && (
        <section className="panel">
          <h2>复习</h2>
          {!current ? (
            <div className="empty">今天没有待复习内容。只有高质量样本会进入复习。</div>
          ) : (
            <>
              <div className="mode-tabs">
                <button className={reviewMode === "dictation" ? "active" : ""} onClick={() => setReviewMode("dictation")}>
                  听写
                </button>
                <button className={reviewMode === "restore_standard" ? "active" : ""} onClick={() => setReviewMode("restore_standard")}>
                  还原标准英文
                </button>
              </div>

              <AnalysisPanel analysis={current.analysis} />

              {current.samples[0] && <Player sample={current.samples[0]} />}

              <textarea
                className="textarea"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={reviewMode === "dictation" ? "听真实发音，写出你听到的英文" : "听口语变体，还原成标准英文"}
              />

              <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShowAnswer(!showAnswer)}>
                {showAnswer ? "隐藏答案" : "显示答案"}
              </button>

              {lastAccepted !== null && (
                <div className={`result ${lastAccepted ? "ok" : "bad"}`}>
                  {lastAccepted ? "答案接近正确" : "答案可能不正确"}
                </div>
              )}

              {showAnswer && (
                <>
                  <div className="rows">
                    <Info label="标准形式" value={current.analysis.standardForms.join(" · ") || current.analysis.lemma} />
                    <Info label="中文" value={current.analysis.zh} />
                  </div>
                  <div className="subtitle" dangerouslySetInnerHTML={{ __html: highlightTerms(current.samples[0]?.subtitle || current.query, [current.query, current.analysis.lemma, ...current.analysis.standardForms]) }} />
                </>
              )}

              <div className="actions">
                <button className="btn danger" onClick={() => submitReview("again")}>没听懂</button>
                <button className="btn secondary" onClick={() => submitReview("hard")}>勉强</button>
                <button className="btn secondary" onClick={() => submitReview("good")}>听懂了</button>
                <button className="btn" onClick={() => submitReview("easy")}>很简单</button>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function AccountBar({
  email,
  setEmail,
  user,
  signIn,
  signOut
}: {
  email: string;
  setEmail: (value: string) => void;
  user: User | null;
  signIn: () => void;
  signOut: () => void;
}) {
  return (
    <div className="account" style={{ marginBottom: 18 }}>
      {hasSupabaseConfig() ? (
        user ? (
          <>
            <span className="cloud">已云端登录：{user.email}</span>
            <button className="btn ghost" onClick={signOut}>退出</button>
          </>
        ) : (
          <>
            <span className="cloud">登录后单词本可云端保存</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="输入邮箱" />
            <button className="btn ghost" onClick={signIn}>发送登录链接</button>
          </>
        )
      ) : (
        <span className="cloud">当前使用本地保存。配置 Supabase 后可云端同步。</span>
      )}
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  return (
    <div>
      <div className="wordhead">
        <div>
          <h3>{analysis.lemma}</h3>
          <div className="zh">{analysis.zh}</div>
        </div>
        <Pills analysis={analysis} />
      </div>

      <div className="rows">
        <Info label="类型" value={`${analysis.kind} · ${analysis.pos.join(" / ")}`} />
        <Info label="变形" value={analysis.inflections.join(" · ")} />
        <Info label="搭配" value={analysis.collocations.join(" · ")} />
        <Info label="来源" value={analysis.dictionarySource === "curated" ? "人工整理词典" : analysis.dictionarySource === "external_dictionary" ? "外部词典接口" : "未确认"} />
        {analysis.standardForms.length > 0 && <Info label="标准形式" value={analysis.standardForms.join(" · ")} />}
      </div>

      {analysis.warning && <div className="note">{analysis.warning}</div>}
    </div>
  );
}

function Pills({ analysis }: { analysis: Analysis }) {
  return (
    <div className="pills">
      <span className={`pill ${analysis.confidence === "known" ? "green" : analysis.confidence === "partial" ? "blue" : "amber"}`}>
        {analysis.confidence === "known" ? "已确认" : analysis.confidence === "partial" ? "部分确认" : "未确认"}
      </span>
      {analysis.phonetic && <span className="pill blue">{analysis.phonetic}</span>}
      {analysis.oralVariants.map((variant) => (
        <span className="pill amber" key={`${variant.from}-${variant.to}`}>{variant.from} → {variant.to}</span>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function SampleList({
  samples,
  active,
  query,
  setActive
}: {
  samples: PronunciationSample[];
  active: PronunciationSample | null;
  query: string;
  setActive: (sample: PronunciationSample) => void;
}) {
  return (
    <>
      {samples.map((sample, index) => (
        <SampleButton
          key={sample.id}
          sample={sample}
          index={index}
          query={query}
          active={active?.id === sample.id}
          onClick={() => setActive(sample)}
        />
      ))}
    </>
  );
}

function SampleButton({
  sample,
  index,
  query,
  active,
  onClick
}: {
  sample: PronunciationSample;
  index: number;
  query: string;
  active: boolean;
  onClick: () => void;
}) {
  const oral = detectOralVariants(query);

  return (
    <button className={`sample ${active ? "active" : ""}`} onClick={onClick}>
      <div className="play"><Play size={17} /></div>
      <div>
        <div className="sampletop">
          <span>样本 {index + 1}</span>
          <span className="score">质量 {sample.qualityScore} · {sample.qualityLabel}</span>
        </div>
        <div className="source">
          {sample.sourceName} · {sample.captionFound ? "字幕可用" : "未取到字幕"} · {sample.exactMatch ? "精确匹配" : "弱匹配"} · {sample.duration.toFixed(1)} 秒
        </div>
        <div className="subtitle" dangerouslySetInnerHTML={{ __html: highlightTerms(sample.subtitle, [query, ...oral.terms]) }} />
        <div className="pills">
          {sample.tags.slice(0, 6).map((tag) => <span className="pill" key={tag}>{tag}</span>)}
        </div>
      </div>
    </button>
  );
}

function Player({ sample }: { sample: PronunciationSample }) {
  return (
    <div className="player">
      <iframe src={embedUrl(sample)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      <div className="smallnote">YouTube 只作为来源播放。要做纯音频，需要授权音频库或用户上传音频。</div>
    </div>
  );
}

function embedUrl(sample: PronunciationSample) {
  const start = Math.floor(sample.startTime || 0);
  const end = Math.floor(sample.endTime || start + 8);
  return `https://www.youtube.com/embed/${sample.videoId}?start=${start}&end=${end}&rel=0`;
}

function loadLocalWordbook(): WordbookItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("real-listening-v3-wordbook") || "[]");
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
