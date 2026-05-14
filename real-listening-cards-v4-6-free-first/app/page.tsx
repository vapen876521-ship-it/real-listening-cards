"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Search, Trash2 } from "lucide-react";
import type { Analysis, ImportLog, PronunciationSample, ReviewMode, ReviewRecord, SampleFeedback, SearchResponse, StudyStatus, WordbookItem } from "@/lib/types";
import { answerAccepted } from "@/lib/answer";
import { detectOralVariants, highlightTerms } from "@/lib/pronunciation";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type Tab = "search" | "wordbook" | "review" | "import" | "upload" | "history";

export default function Home() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("card");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [highQualitySamples, setHighQualitySamples] = useState<PronunciationSample[]>([]);
  const [backupSamples, setBackupSamples] = useState<PronunciationSample[]>([]);
  const [active, setActive] = useState<PronunciationSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [wordbook, setWordbook] = useState<WordbookItem[]>([]);
  const [wordbookSearch, setWordbookSearch] = useState("");
  const [wordbookFilter, setWordbookFilter] = useState("all");
  const [wordbookCategory, setWordbookCategory] = useState("all");
  const [wordbookSort, setWordbookSort] = useState("recent");
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [editing, setEditing] = useState<WordbookItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("dictation");
  const [lastAccepted, setLastAccepted] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [importText, setImportText] = useState("card\nwant to\nwhat do you want to do");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [uploadMeaning, setUploadMeaning] = useState("");
  const [uploadAudioUrl, setUploadAudioUrl] = useState("");

  useEffect(() => {
    setWordbook(loadLocalWordbook());
    setHistory(loadHistory());
    setImportLogs(loadImportLogs());

    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadCloudWordbook(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadCloudWordbook(session.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const due = useMemo(() => {
    const now = Date.now();
    return wordbook.filter((item) => normalizeItem(item).status !== "paused" && new Date(item.dueAt).getTime() <= now && item.samples.length > 0);
  }, [wordbook]);

  const current = due[0];

  const normalizedWordbook = useMemo(() => wordbook.map(normalizeItem), [wordbook]);

  const wordbookStats = useMemo(() => {
    const now = Date.now();
    return {
      total: normalizedWordbook.length,
      due: normalizedWordbook.filter((item) => item.status !== "paused" && new Date(item.dueAt).getTime() <= now).length,
      difficult: normalizedWordbook.filter((item) => item.status === "difficult" || item.mistakeCount >= 3).length,
      mastered: normalizedWordbook.filter((item) => item.status === "mastered").length,
      uncategorized: normalizedWordbook.filter((item) => !item.category || item.category === "默认生词库").length
    };
  }, [normalizedWordbook]);

  const categories = useMemo(() => Array.from(new Set(normalizedWordbook.map((item) => item.category || "默认生词库"))), [normalizedWordbook]);

  const filteredWordbook = useMemo(() => {
    const now = Date.now();
    const query = wordbookSearch.trim().toLowerCase();

    let items = normalizedWordbook.filter((item) => {
      const haystack = [
        item.query,
        item.analysis.lemma,
        item.analysis.zh,
        item.category,
        item.notes,
        ...item.tags
      ].join(" ").toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (wordbookCategory !== "all" && item.category !== wordbookCategory) return false;

      if (wordbookFilter === "due" && !(item.status !== "paused" && new Date(item.dueAt).getTime() <= now)) return false;
      if (wordbookFilter === "difficult" && !(item.status === "difficult" || item.mistakeCount >= 3)) return false;
      if (wordbookFilter === "mastered" && item.status !== "mastered") return false;
      if (wordbookFilter === "paused" && item.status !== "paused") return false;
      if (wordbookFilter === "uncategorized" && item.category !== "默认生词库") return false;
      if (["word", "phrase", "sentence", "spoken_variant", "chinese"].includes(wordbookFilter) && item.analysis.kind !== wordbookFilter) return false;
      if (wordbookFilter === "upload" && item.sourceType !== "upload") return false;
      if (wordbookFilter === "youtube" && !item.samples.some((sample) => sample.source === "youtube")) return false;

      return true;
    });

    items = items.sort((a, b) => {
      if (wordbookSort === "due") return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (wordbookSort === "mistakes") return b.mistakeCount - a.mistakeCount;
      if (wordbookSort === "az") return a.analysis.lemma.localeCompare(b.analysis.lemma);
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return items;
  }, [normalizedWordbook, wordbookSearch, wordbookFilter, wordbookCategory, wordbookSort]);

  async function runSearch(raw = query) {
    const q = raw.trim();
    if (!q) return;

    setQuery(q);
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
      saveHistory(q);
    } catch {
      setError("搜索失败。请检查网络或环境变量。");
    } finally {
      setLoading(false);
    }
  }

  function saveHistory(q: string) {
    const next = [q, ...history.filter((item) => item !== q)].slice(0, 30);
    setHistory(next);
    localStorage.setItem("rlc-v4-history", JSON.stringify(next));
  }

  async function signIn() {
    if (!supabase || !email.trim()) return;
    await supabase.auth.signInWithOtp({ email: email.trim() });
    alert("登录链接已发送到邮箱。");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setWordbook(loadLocalWordbook());
  }

  async function loadCloudWordbook(userId: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from("wordbook_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const items = (data || []).map((row: any) => ({
      id: row.id,
      query: row.query,
      analysis: row.analysis,
      samples: row.samples,
      tags: row.tags || [],
      category: row.category || "默认生词库",
      status: row.status || "new",
      notes: row.notes || "",
      mistakeCount: row.mistake_count || 0,
      sourceType: row.source_type || "search",
      importBatchId: row.import_batch_id || undefined,
      addedAt: row.created_at,
      dueAt: row.due_at,
      reviews: row.reviews || []
    })) as WordbookItem[];

    setWordbook(items);
  }

  async function persist(items: WordbookItem[]) {
    const normalized = items.map(normalizeItem);
    setWordbook(normalized);
    localStorage.setItem("rlc-v4-wordbook", JSON.stringify(normalized));
  }

  async function addToWordbook() {
    if (!analysis) return;

    const reviewSamples = highQualitySamples.filter((sample) => sample.reviewEligible);
    if (reviewSamples.length === 0) {
      alert("没有可进入复习的高质量样本。可以查看备选样本，但它们不会进入复习。");
      return;
    }

    const existing = findDuplicate(normalizedWordbook, query, analysis.lemma);
    if (existing) {
      const merge = confirm("这个卡片已在生词库中。是否合并新的读音样本和标签？");
      if (!merge) return;
      await updateItem({
        ...existing,
        samples: mergeSamples(existing.samples, reviewSamples),
        tags: Array.from(new Set([...existing.tags, ...autoTags(analysis)])),
        notes: existing.notes || "已合并新搜索样本"
      });
      setTab("wordbook");
      return;
    }

    await saveItem({
      id: `local-${Date.now()}`,
      query,
      analysis,
      samples: reviewSamples,
      tags: autoTags(analysis),
      category: "默认生词库",
      status: "new",
      notes: "",
      mistakeCount: 0,
      sourceType: "search",
      addedAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      reviews: []
    });
    setTab("wordbook");
  }

  async function saveItem(item: WordbookItem) {
    if (supabase && user) {
      const { data, error } = await supabase
        .from("wordbook_items")
        .insert({
          user_id: user.id,
          query: item.query,
          analysis: item.analysis,
          samples: item.samples,
          tags: item.tags,
          category: item.category,
          status: item.status,
          notes: item.notes,
          mistake_count: item.mistakeCount,
          source_type: item.sourceType,
          import_batch_id: item.importBatchId || null,
          due_at: item.dueAt,
          reviews: item.reviews
        })
        .select("*")
        .single();

      if (!error && data) {
        await loadCloudWordbook(user.id);
        return;
      }
    }

    await persist([item, ...wordbook]);
  }

  async function updateItem(item: WordbookItem) {
    if (supabase && user && !item.id.startsWith("local-")) {
      await supabase
        .from("wordbook_items")
        .update({
          query: item.query,
          analysis: item.analysis,
          samples: item.samples,
          tags: item.tags,
          category: item.category,
          status: item.status,
          notes: item.notes,
          mistake_count: item.mistakeCount,
          source_type: item.sourceType,
          import_batch_id: item.importBatchId || null,
          due_at: item.dueAt,
          reviews: item.reviews
        })
        .eq("id", item.id)
        .eq("user_id", user.id);
      await loadCloudWordbook(user.id);
    } else {
      await persist(wordbook.map((old) => (old.id === item.id ? item : old)));
    }
    setEditing(null);
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
        : reviewMode === "multi_sample"
          ? [current.analysis.lemma, ...current.analysis.standardForms]
          : [current.samples[0]?.subtitle || current.query, current.analysis.lemma, ...current.analysis.standardForms];

    const accepted = answerAccepted(answer, targets);
    setLastAccepted(accepted);

    const newMistakeCount = rating === "again" ? current.mistakeCount + 1 : current.mistakeCount;
    const nextStatus: StudyStatus =
      rating === "easy" ? "mastered" :
      newMistakeCount >= 3 ? "difficult" :
      current.status === "new" ? "learning" :
      current.status;

    const reviewed: WordbookItem = {
      ...current,
      mistakeCount: newMistakeCount,
      status: nextStatus,
      dueAt: nextDueDate(rating),
      reviews: [...current.reviews, { reviewedAt: new Date().toISOString(), mode: reviewMode, rating, answer, accepted }]
    };

    await updateItem(reviewed);
    setAnswer("");
    setShowAnswer(false);
  }

  async function addDictionaryOnlyCard() {
    if (!analysis) return;

    const existing = findDuplicate(normalizedWordbook, query, analysis.lemma);
    if (existing) {
      const merge = confirm("这个卡片已在生词库中。是否添加“待补充音源”标签？");
      if (!merge) return;
      await updateItem({
        ...existing,
        tags: Array.from(new Set([...existing.tags, "待补充音源"])),
        status: existing.status === "mastered" ? existing.status : "paused",
        notes: existing.notes || "已保存词典信息，待补充音源"
      });
      setTab("wordbook");
      return;
    }

    await saveItem({
      id: `local-${Date.now()}`,
      query,
      analysis,
      samples: [],
      tags: [...autoTags(analysis), "待补充音源"],
      category: "待补充音源",
      status: "paused",
      notes: "已保存词典信息，但暂时没有可复习的真实读音样本。可以以后上传音频或重新搜索。",
      mistakeCount: 0,
      sourceType: "search",
      addedAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      reviews: []
    });

    setTab("wordbook");
  }

  async function importCards() {
    const lines = importText.split("
").map((line) => line.trim()).filter(Boolean).slice(0, 50);
    const batchId = `batch-${Date.now()}`;
    let created = 0;
    let duplicates = 0;
    let failed = 0;

    for (const line of lines) {
      try {
        const [q, zh] = line.split("->").map((item) => item?.trim() || "");
        if (!q) {
          failed += 1;
          continue;
        }

        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as SearchResponse;
        const analysis = data.analysis;
        if (zh) analysis.zh = zh;

        const existing = findDuplicate(normalizedWordbook, q, analysis.lemma);
        if (existing) {
          duplicates += 1;
          continue;
        }

        const samples = (data.highQualitySamples || []).filter((s) => s.reviewEligible);
        await saveItem({
          id: `local-${Date.now()}-${Math.random()}`,
          query: q,
          analysis,
          samples,
          tags: samples.length ? [...autoTags(analysis), "批量导入"] : [...autoTags(analysis), "批量导入", "待补充音源"],
          category: samples.length ? "批量导入" : "待补充音源",
          status: samples.length ? "new" : "paused",
          notes: "批量导入",
          mistakeCount: 0,
          sourceType: "import",
          importBatchId: batchId,
          addedAt: new Date().toISOString(),
          dueAt: new Date().toISOString(),
          reviews: []
        });
        created += 1;
      } catch {
        failed += 1;
      }
    }

    const log: ImportLog = {
      id: batchId,
      createdAt: new Date().toISOString(),
      total: lines.length,
      created,
      duplicates,
      failed,
      source: "text"
    };

    const nextLogs = [log, ...importLogs].slice(0, 20);
    setImportLogs(nextLogs);
    localStorage.setItem("rlc-v42-import-logs", JSON.stringify(nextLogs));
    setTab("wordbook");
  }

  async function makeUploadedAudioCard() {
    if (!uploadText.trim() || !uploadAudioUrl) {
      alert("请先选择音频文件，并填写标准英文或字幕。");
      return;
    }

    const res = await fetch(`/api/search?q=${encodeURIComponent(uploadText.trim())}`);
    const data = (await res.json()) as SearchResponse;
    const analysis = data.analysis;
    if (uploadMeaning.trim()) analysis.zh = uploadMeaning.trim();

    const sample: PronunciationSample = {
      id: `uploaded-${Date.now()}`,
      source: "uploaded_audio",
      title: uploadTitle || "用户上传音频",
      sourceName: "用户上传",
      audioUrl: uploadAudioUrl,
      startTime: 0,
      endTime: 0,
      duration: 0,
      subtitle: uploadText,
      captionFound: true,
      exactMatch: true,
      variantMatch: false,
      sourceDiversityKey: "uploaded",
      qualityScore: 100,
      qualityLabel: "high",
      reviewEligible: true,
      tags: ["用户上传", "可复习"],
      note: "用户上传音频。"
    };

    await saveItem({
      id: `local-${Date.now()}`,
      query: uploadText,
      analysis,
      samples: [sample],
      tags: ["用户上传"],
      category: "我的上传音频",
      status: "new",
      notes: uploadTitle,
      mistakeCount: 0,
      sourceType: "upload",
      addedAt: new Date().toISOString(),
      dueAt: new Date().toISOString(),
      reviews: []
    });

    setTab("wordbook");
  }

  function setFeedback(sample: PronunciationSample, feedback: SampleFeedback) {
    const update = (s: PronunciationSample) =>
      s.id === sample.id
        ? { ...s, feedback: Array.from(new Set([...(s.feedback || []), feedback])) }
        : s;

    setHighQualitySamples(highQualitySamples.map(update));
    setBackupSamples(backupSamples.map(update));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="logo">Real Listening Cards</div>
          <div className="sub">词典 · 真实读音 · 生词库管理 · 导入 · 复习</div>
        </div>
        <nav className="nav">
          {[
            ["search", "搜索"],
            ["wordbook", "单词本"],
            ["review", "复习"],
            ["import", "导入"],
            ["upload", "上传音频"],
            ["history", "历史"]
          ].map(([key, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key as Tab)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <AccountBar email={email} setEmail={setEmail} user={user} signIn={signIn} signOut={signOut} />

      {tab === "search" && (
        <>
          <section className="hero">
            <div className="kicker">All-in-one MVP</div>
            <h1>输入内容，生成可复习的真实听力卡片。</h1>
            <p>免费优先：先查内置中英词典、Free Dictionary 和 MyMemory，再找免费词典发音、外部音源和 YouTube。都找不到时，也可以先保存为待补充音源的词典卡片。</p>
          </section>

          <section className="search">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runSearch()} placeholder="card / want to / 什么意思" />
            <button className="btn" onClick={() => runSearch()}>{loading ? "搜索中" : "搜索"} <Search size={18} /></button>
          </section>

          {error && <div className="error">{error}</div>}

          <section className="layout">
            <div className="panel">
              <h2>解释</h2>
              {!analysis ? <div className="empty">搜索后显示词典解释。</div> : (
                <>
                  <AnalysisPanel analysis={analysis} />
                  <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                    <button className="btn" onClick={addToWordbook}>保存可复习样本</button>
                    <button className="btn ghost" onClick={addDictionaryOnlyCard}>仅保存词典卡片</button>
                  </div>
                </>
              )}
            </div>

            <div className="panel">
              <h2>高质量读音样本</h2>
              {highQualitySamples.length === 0 ? <div className="empty">暂时没有高质量样本。系统已经尝试免费词典发音、外部发音源和 YouTube。你可以查看备选样本，或先仅保存词典卡片，之后通过上传音频或重新搜索来补充。</div> : (
                <>
                  <SampleList samples={highQualitySamples} active={active} query={query} setActive={setActive} setFeedback={setFeedback} />
                  {active && <Player sample={active} />}
                </>
              )}

              {backupSamples.length > 0 && (
                <details>
                  <summary>查看备选样本，不会进入复习</summary>
                  <div className="samples" style={{ marginTop: 12 }}>
                    <SampleList samples={backupSamples} active={active} query={query} setActive={setActive} setFeedback={setFeedback} />
                  </div>
                </details>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "wordbook" && (
        <section className="panel">
          <h2>生词库管理</h2>

          <div className="statsgrid">
            <div className="statbox"><b>{wordbookStats.total}</b><span>全部卡片</span></div>
            <div className="statbox"><b>{wordbookStats.due}</b><span>今日待复习</span></div>
            <div className="statbox"><b>{wordbookStats.difficult}</b><span>经常错</span></div>
            <div className="statbox"><b>{wordbookStats.mastered}</b><span>已掌握</span></div>
            <div className="statbox"><b>{wordbookStats.uncategorized}</b><span>默认分类</span></div>
          </div>

          <div className="managerbar">
            <input className="field compact" value={wordbookSearch} onChange={(e) => setWordbookSearch(e.target.value)} placeholder="搜索英文、中文、标签、笔记" />
            <select className="select" value={wordbookFilter} onChange={(e) => setWordbookFilter(e.target.value)}>
              <option value="all">全部</option>
              <option value="due">今日待复习</option>
              <option value="difficult">经常错</option>
              <option value="mastered">已掌握</option>
              <option value="paused">暂停复习</option>
              <option value="uncategorized">默认分类</option>
              <option value="word">单词</option>
              <option value="phrase">词组</option>
              <option value="sentence">句子</option>
              <option value="spoken_variant">口语变体</option>
              <option value="chinese">中文词</option>
              <option value="upload">用户上传</option>
              <option value="youtube">YouTube 来源</option>
            </select>
            <select className="select" value={wordbookCategory} onChange={(e) => setWordbookCategory(e.target.value)}>
              <option value="all">全部分类</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="select" value={wordbookSort} onChange={(e) => setWordbookSort(e.target.value)}>
              <option value="recent">最近添加</option>
              <option value="due">复习时间</option>
              <option value="mistakes">错误次数</option>
              <option value="az">字母排序</option>
            </select>
          </div>

          {filteredWordbook.length === 0 ? <div className="empty">没有符合条件的卡片。</div> : filteredWordbook.map((item) => (
            <article className="worditem" key={item.id}>
              <div className="wordtop">
                <div>
                  <h3>{item.analysis.lemma}</h3>
                  <div className="zh">{item.analysis.zh}</div>
                  <div className="statusline">
                    <span className={`badge ${item.status === "mastered" ? "green" : item.status === "difficult" ? "amber" : item.status === "paused" ? "" : "blue"}`}>{statusLabel(item.status)}</span>
                    <span className="badge">{item.category}</span>
                    <span className="badge">错误 {item.mistakeCount}</span>
                    <span className="badge">{item.sourceType}</span>
                  </div>
                  <div className="pills">{item.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn ghost" onClick={() => setEditing(item)}>编辑</button>
                  <button className="btn ghost" onClick={() => updateItem({ ...item, status: item.status === "paused" ? "learning" : "paused" })}>{item.status === "paused" ? "恢复" : "暂停"}</button>
                  <button className="btn ghost" onClick={() => deleteItem(item.id)}>删除 <Trash2 size={16} /></button>
                </div>
              </div>
              <div className="zh">{item.samples.length} 个可复习样本 · 下次复习 {new Date(item.dueAt).toLocaleString("zh-CN")}</div>
            </article>
          ))}

          {importLogs.length > 0 && (
            <details>
              <summary>查看导入记录</summary>
              {importLogs.map((log) => (
                <div className="importlog" key={log.id}>
                  <b>{new Date(log.createdAt).toLocaleString("zh-CN")}</b>
                  <div className="zh">共 {log.total} 条，成功 {log.created}，重复 {log.duplicates}，失败 {log.failed}</div>
                </div>
              ))}
            </details>
          )}

          {editing && <EditPanel item={editing} setItem={setEditing} save={updateItem} />}
        </section>
      )}

      {tab === "review" && (
        <section className="panel">
          <h2>复习</h2>
          {!current ? <div className="empty">今天没有待复习内容。</div> : (
            <>
              <div className="mode-tabs">
                <button className={reviewMode === "dictation" ? "active" : ""} onClick={() => setReviewMode("dictation")}>听写</button>
                <button className={reviewMode === "restore_standard" ? "active" : ""} onClick={() => setReviewMode("restore_standard")}>还原标准英文</button>
                <button className={reviewMode === "multi_sample" ? "active" : ""} onClick={() => setReviewMode("multi_sample")}>多样本辨认</button>
              </div>

              <AnalysisPanel analysis={current.analysis} />
              {reviewMode === "multi_sample" ? current.samples.slice(0, 3).map((sample) => <Player key={sample.id} sample={sample} />) : current.samples[0] && <Player sample={current.samples[0]} />}

              <textarea className="textarea" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={reviewMode === "dictation" ? "听真实发音，写出你听到的英文" : reviewMode === "restore_standard" ? "听口语变体，还原成标准英文" : "判断这些样本是否是同一个词或句子，并写出标准形式"} />

              <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? "隐藏答案" : "显示答案"}</button>
              {lastAccepted !== null && <div className={`result ${lastAccepted ? "ok" : "bad"}`}>{lastAccepted ? "答案接近正确" : "答案可能不正确"}</div>}
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

      {tab === "import" && (
        <section className="panel">
          <h2>批量导入</h2>
          <p className="zh">一行一个。可以写英文，也可以写“英文 -&gt; 中文意思”。最多一次处理 20 行。</p>
          <textarea className="textarea" value={importText} onChange={(event) => setImportText(event.target.value)} />
          <button className="btn" style={{ marginTop: 12 }} onClick={importCards}>导入并自动搜索</button>
        </section>
      )}

      {tab === "upload" && (
        <section className="panel">
          <h2>上传音频</h2>
          <p className="zh">现在支持手动填写字幕并生成卡片。自动转写需要以后接 Whisper 或其他语音识别服务。</p>
          <input className="field" placeholder="标题，可选" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
          <input className="field" placeholder="中文意思，可选" value={uploadMeaning} onChange={(e) => setUploadMeaning(e.target.value)} />
          <textarea className="textarea" placeholder="标准英文或字幕，必填" value={uploadText} onChange={(e) => setUploadText(e.target.value)} />
          <input className="field" type="file" accept="audio/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setUploadAudioUrl(URL.createObjectURL(file));
          }} />
          {uploadAudioUrl && <audio controls src={uploadAudioUrl} style={{ width: "100%", marginTop: 12 }} />}
          <button className="btn" style={{ marginTop: 12 }} onClick={makeUploadedAudioCard}>生成上传音频卡片</button>
        </section>
      )}

      {tab === "history" && (
        <section className="panel">
          <h2>搜索历史</h2>
          {history.length === 0 ? <div className="empty">暂无搜索历史。</div> : history.map((item) => (
            <button key={item} className="sample" onClick={() => { setTab("search"); runSearch(item); }}>
              <div className="play"><Search size={17} /></div>
              <div><div className="sampletop">{item}</div></div>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}


function normalizeItem(item: WordbookItem): WordbookItem {
  return {
    ...item,
    tags: item.tags || [],
    category: item.category || "默认生词库",
    status: item.status || "new",
    notes: item.notes || "",
    mistakeCount: item.mistakeCount || 0,
    sourceType: item.sourceType || "search",
    reviews: item.reviews || [],
    samples: item.samples || []
  };
}

function findDuplicate(items: WordbookItem[], query: string, lemma: string) {
  const q = query.trim().toLowerCase();
  const l = lemma.trim().toLowerCase();
  return items.find((item) => {
    const itemQuery = item.query.trim().toLowerCase();
    const itemLemma = item.analysis.lemma.trim().toLowerCase();
    return itemQuery === q || itemLemma === l || itemLemma === q;
  });
}

function mergeSamples(a: PronunciationSample[], b: PronunciationSample[]) {
  const map = new Map<string, PronunciationSample>();
  for (const sample of [...a, ...b]) map.set(sample.id, sample);
  return Array.from(map.values());
}

function statusLabel(status: StudyStatus) {
  const map: Record<StudyStatus, string> = {
    new: "新卡",
    learning: "学习中",
    difficult: "经常错",
    mastered: "已掌握",
    paused: "暂停复习"
  };
  return map[status] || "学习中";
}

function loadImportLogs(): ImportLog[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("rlc-v42-import-logs") || "[]"); } catch { return []; }
}


function AccountBar({ email, setEmail, user, signIn, signOut }: { email: string; setEmail: (v: string) => void; user: User | null; signIn: () => void; signOut: () => void }) {
  return (
    <div className="account">
      {hasSupabaseConfig() ? user ? (
        <>
          <span className="cloud">已云端登录：{user.email}</span>
          <button className="btn ghost" onClick={signOut}>退出</button>
        </>
      ) : (
        <>
          <span className="cloud">登录后云端保存</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="输入邮箱" />
          <button className="btn ghost" onClick={signIn}>发送登录链接</button>
        </>
      ) : <span className="cloud">当前使用本地保存。配置 Supabase 后可云端同步。</span>}
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
        <Info label="来源" value={sourceLabel(analysis.dictionarySource)} />
        {analysis.standardForms.length > 0 && <Info label="标准形式" value={analysis.standardForms.join(" · ")} />}
      </div>
      {analysis.warning && <div className="note">{analysis.warning}</div>}
    </div>
  );
}

function sourceLabel(source: Analysis["dictionarySource"]) {
  if (source === "curated") return "人工中英词典";
  if (source === "external_dictionary") return "外部中英词典接口";
  if (source === "free_english") return "免费英文词典兜底";
  return "未确认";
}

function Pills({ analysis }: { analysis: Analysis }) {
  return (
    <div className="pills">
      <span className={`pill ${analysis.confidence === "known" ? "green" : analysis.confidence === "partial" ? "blue" : "amber"}`}>
        {analysis.confidence === "known" ? "已确认" : analysis.confidence === "partial" ? "部分确认" : "未确认"}
      </span>
      {analysis.phonetic && <span className="pill blue">{analysis.phonetic}</span>}
      {analysis.oralVariants.map((v) => <span className="pill amber" key={`${v.from}-${v.to}`}>{v.from} → {v.to}</span>)}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="row"><div className="label">{label}</div><div className="value">{value}</div></div>;
}

function SampleList({ samples, active, query, setActive, setFeedback }: { samples: PronunciationSample[]; active: PronunciationSample | null; query: string; setActive: (s: PronunciationSample) => void; setFeedback: (s: PronunciationSample, f: SampleFeedback) => void }) {
  return <>{samples.map((sample, index) => <SampleButton key={sample.id} sample={sample} index={index} query={query} active={active?.id === sample.id} onClick={() => setActive(sample)} setFeedback={setFeedback} />)}</>;
}

function SampleButton({ sample, index, query, active, onClick, setFeedback }: { sample: PronunciationSample; index: number; query: string; active: boolean; onClick: () => void; setFeedback: (s: PronunciationSample, f: SampleFeedback) => void }) {
  const oral = detectOralVariants(query);
  return (
    <button className={`sample ${active ? "active" : ""}`} onClick={onClick}>
      <div className="play"><Play size={17} /></div>
      <div>
        <div className="sampletop"><span>样本 {index + 1}</span><span className="score">质量 {sample.qualityScore} · {sample.qualityLabel}</span></div>
        <div className="source">{sample.sourceName} · {sample.captionFound ? "字幕可用" : "未取到字幕"} · {sample.exactMatch ? "精确匹配" : "弱匹配"} · {sample.duration ? `${sample.duration.toFixed(1)} 秒` : "上传音频"}</div>
        <div className="subtitle" dangerouslySetInnerHTML={{ __html: highlightTerms(sample.subtitle, [query, ...oral.terms]) }} />
        <div className="pills">
          {sample.tags.slice(0, 6).map((tag) => <span className="pill" key={tag}>{tag}</span>)}
          {(["good", "not_target", "unclear", "caption_wrong", "noisy"] as SampleFeedback[]).map((f) => (
            <span className="pill" key={f} onClick={(e) => { e.stopPropagation(); setFeedback(sample, f); }}>{feedbackLabel(f)}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

function feedbackLabel(f: SampleFeedback) {
  const map = { good: "好样本", not_target: "不是目标", unclear: "听不清", caption_wrong: "字幕错", noisy: "太吵" };
  return map[f];
}

function Player({ sample }: { sample: PronunciationSample }) {
  return (
    <div className="player">
      {sample.source === "uploaded_audio" && sample.audioUrl ? (
        <audio controls src={sample.audioUrl} />
      ) : sample.videoId ? (
        <iframe src={embedUrl(sample)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : null}
      <div className="smallnote">{sample.source === "youtube" ? "YouTube 只作为来源播放。纯音频需要上传音频或授权音频库。" : "用户上传音频，可直接播放。"}</div>
    </div>
  );
}

function EditPanel({ item, setItem, save }: { item: WordbookItem; setItem: (item: WordbookItem | null) => void; save: (item: WordbookItem) => void }) {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2>编辑卡片</h2>
      <div className="grid2">
        <input className="field" value={item.analysis.lemma} onChange={(e) => setItem({ ...item, analysis: { ...item.analysis, lemma: e.target.value } })} placeholder="英文 / 标准形式" />
        <select className="select" value={item.status} onChange={(e) => setItem({ ...item, status: e.target.value as StudyStatus })}>
          <option value="new">新卡</option>
          <option value="learning">学习中</option>
          <option value="difficult">经常错</option>
          <option value="mastered">已掌握</option>
          <option value="paused">暂停复习</option>
        </select>
      </div>
      <textarea className="textarea" value={item.analysis.zh} onChange={(e) => setItem({ ...item, analysis: { ...item.analysis, zh: e.target.value } })} placeholder="中文意思" />
      <div className="grid2">
        <input className="field" value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value || "默认生词库" })} placeholder="分类" />
        <input className="field" value={item.tags.join(", ")} onChange={(e) => setItem({ ...item, tags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="标签，用逗号分隔" />
      </div>
      <textarea className="textarea" value={item.notes} placeholder="笔记" onChange={(e) => setItem({ ...item, notes: e.target.value })} />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => save(item)}>保存修改</button>
        <button className="btn ghost" onClick={() => setItem(null)}>取消</button>
      </div>
    </div>
  );
}

function embedUrl(sample: PronunciationSample) {
  const start = Math.floor(sample.startTime || 0);
  const end = Math.floor(sample.endTime || start + 8);
  return `https://www.youtube.com/embed/${sample.videoId}?start=${start}&end=${end}&rel=0`;
}

function autoTags(analysis: Analysis) {
  const tags = [analysis.kind];
  for (const v of analysis.oralVariants) tags.push(v.label);
  return Array.from(new Set(tags));
}

function loadLocalWordbook(): WordbookItem[] {
  if (typeof window === "undefined") return [];
  try { return (JSON.parse(localStorage.getItem("rlc-v4-wordbook") || "[]") as WordbookItem[]).map(normalizeItem); } catch { return []; }
}

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("rlc-v4-history") || "[]"); } catch { return []; }
}

function nextDueDate(rating: ReviewRecord["rating"]) {
  const date = new Date();
  if (rating === "again") date.setMinutes(date.getMinutes() + 10);
  if (rating === "hard") date.setDate(date.getDate() + 1);
  if (rating === "good") date.setDate(date.getDate() + 3);
  if (rating === "easy") date.setDate(date.getDate() + 7);
  return date.toISOString();
}
