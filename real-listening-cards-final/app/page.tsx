"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  Library,
  Search,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import type { ClipResult, ReviewRecord, WordbookCard as WordbookCardType } from "@/lib/types";
import { searchClips } from "@/lib/search";
import { getOralVariants, highlightTerms } from "@/lib/pronunciation";
import { loadWordbook, nextDueDate, saveWordbook, toWordbookCard } from "@/lib/storage";
import { SearchResultCard } from "@/components/SearchResultCard";
import { WordbookCard } from "@/components/WordbookCard";
import { Badge } from "@/components/Badge";

type Tab = "search" | "wordbook" | "review" | "import";

export default function Home() {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("what do you want to do");
  const [wordbook, setWordbook] = useState<WordbookCardType[]>(() => loadWordbook());
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [importText, setImportText] = useState(
    "going to -> gonna -> 将要\nwant to -> wanna -> 想要\nkind of -> kinda -> 有点"
  );

  const results = useMemo(() => searchClips(query), [query]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return wordbook.filter((card) => new Date(card.dueAt).getTime() <= now);
  }, [wordbook]);

  const reviewCard = dueCards[0];

  const stats = {
    total: wordbook.length,
    real: wordbook.filter((card) => card.sourceType === "real_video" || card.sourceType === "real_audio").length,
    standard: wordbook.filter((card) => card.sourceType === "standard_fallback").length
  };

  function persist(cards: WordbookCardType[]) {
    setWordbook(cards);
    saveWordbook(cards);
  }

  function addToWordbook(result: ClipResult) {
    const card = toWordbookCard(result);
    persist([card, ...wordbook]);
    setTab("wordbook");
  }

  function deleteCard(id: string) {
    persist(wordbook.filter((card) => card.id !== id));
  }

  function submitReview(rating: ReviewRecord["rating"]) {
    if (!reviewCard) return;

    const reviewed: WordbookCardType = {
      ...reviewCard,
      dueAt: nextDueDate(rating),
      reviews: [
        ...reviewCard.reviews,
        {
          reviewedAt: new Date().toISOString(),
          rating,
          answer
        }
      ]
    };

    persist(wordbook.map((card) => (card.id === reviewCard.id ? reviewed : card)));
    setAnswer("");
    setShowAnswer(false);
  }

  function importCards() {
    const imported = importText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [standardText, spokenText, zh] = line.split("->").map((item) => item?.trim() ?? "");
        const result = searchClips(standardText)[0];

        return toWordbookCard({
          ...result,
          id: `import-${Date.now()}-${index}`,
          standardText: standardText || result.standardText,
          spokenText: spokenText || result.spokenText,
          translationZh: zh || result.translationZh,
          subtitle: spokenText || standardText || result.subtitle
        });
      });

    persist([...imported, ...wordbook]);
    setTab("wordbook");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <div className="hero-eyebrow">
            <Sparkles size={16} />
            Real Listening Cards
          </div>
          <h1>搜索真实发音，一键加入单词本。</h1>
          <p>
            像 YouGlish 一样搜索视频片段，但面向记忆和复习。每条结果都会显示中文字幕、词性、词形变化、口语变体和字幕高亮。
          </p>
        </div>

        <aside className="stat-card hero-card">
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-number">{dueCards.length}</div>
              <div className="stat-label">今日待复习</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{stats.total}</div>
              <div className="stat-label">
                单词本总数，真实音源 {stats.real}，标准替代 {stats.standard}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <nav className="tabs" aria-label="主导航">
        <TabButton active={tab === "search"} onClick={() => setTab("search")} icon={<Search size={17} />}>
          搜索
        </TabButton>
        <TabButton active={tab === "wordbook"} onClick={() => setTab("wordbook")} icon={<Library size={17} />}>
          单词本
        </TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={<BookOpenCheck size={17} />}>
          复习
        </TabButton>
        <TabButton active={tab === "import"} onClick={() => setTab("import")} icon={<Upload size={17} />}>
          导入
        </TabButton>
      </nav>

      {tab === "search" && (
        <section className="panel search-panel">
          <div className="search-bar">
            <div className="field">
              <label>输入单词、词组或句子</label>
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="例如 what do you want to do / going to / kind of"
              />
            </div>
            <button className="btn" onClick={() => setQuery(query.trim())}>
              搜索 <Wand2 size={18} />
            </button>
          </div>

          <SearchSummary query={query} count={results.length} />

          <div className="result-list">
            {results.map((result) => (
              <SearchResultCard
                key={result.id}
                result={result}
                query={query}
                onAdd={addToWordbook}
                isAdded={wordbook.some((card) => card.id === result.id)}
              />
            ))}
          </div>

          <div className="footer-note">
            当前版本的搜索数据是本地模拟数据，界面和数据结构已经按正式产品设计。接真实数据时，把 <code>lib/search.ts</code> 换成后端搜索接口即可。
          </div>
        </section>
      )}

      {tab === "wordbook" && (
        <section className="panel">
          {wordbook.length === 0 ? (
            <Empty title="单词本还是空的" text="先去搜索一个词组，然后点击“添加到单词本”。" />
          ) : (
            <div className="wordbook-grid">
              {wordbook.map((card) => (
                <WordbookCard key={`${card.id}-${card.addedAt}`} card={card} onDelete={deleteCard} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "review" && (
        <section className="panel">
          {!reviewCard ? (
            <Empty title="今天没有待复习卡片" text="新增卡片后会自动进入复习计划。" />
          ) : (
            <div className="review-card">
              <div className="answer-box">
                <div className="meta-row">
                  <Badge tone={reviewCard.sourceType === "standard_fallback" ? "blue" : "green"}>
                    {reviewCard.sourceType === "standard_fallback" ? "标准发音替代" : "真实生活音源"}
                  </Badge>
                  <Badge>{reviewCard.lexical.pos.join(" / ")}</Badge>
                </div>

                <h2 style={{ marginTop: 18 }}>听写这句话</h2>
                <p className="zh">正式版这里会播放真实片段。当前预览版提供原视频链接。</p>

                {reviewCard.externalUrl && (
                  <a className="btn secondary" href={reviewCard.externalUrl} target="_blank" rel="noreferrer">
                    打开原视频片段
                  </a>
                )}

                <textarea
                  className="textarea"
                  style={{ marginTop: 16 }}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="输入你听到的英文"
                />

                <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShowAnswer(!showAnswer)}>
                  {showAnswer ? "隐藏答案" : "显示答案"}
                </button>

                {showAnswer && (
                  <div style={{ marginTop: 16 }}>
                    <div className="info-grid">
                      <div className="info-box">
                        <div className="info-label">标准文本</div>
                        <div className="info-value">{reviewCard.standardText}</div>
                      </div>
                      <div className="info-box">
                        <div className="info-label">中文意思</div>
                        <div className="info-value">{reviewCard.translationZh}</div>
                      </div>
                      <div className="info-box">
                        <div className="info-label">词形变化</div>
                        <div className="info-value">{reviewCard.lexical.inflections.join(" · ")}</div>
                      </div>
                      <div className="info-box">
                        <div className="info-label">发音说明</div>
                        <div className="info-value">{reviewCard.notes}</div>
                      </div>
                    </div>

                    <div
                      className="subtitle"
                      style={{ marginTop: 12 }}
                      dangerouslySetInnerHTML={{
                        __html: highlightTerms(reviewCard.subtitle, [
                          reviewCard.standardText,
                          reviewCard.spokenText,
                          ...getOralVariants(reviewCard.standardText).variants
                        ])
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="review-actions">
                <button className="btn danger" onClick={() => submitReview("again")}>
                  没听懂
                </button>
                <button className="btn secondary" onClick={() => submitReview("hard")}>
                  勉强
                </button>
                <button className="btn secondary" onClick={() => submitReview("good")}>
                  听懂了
                </button>
                <button className="btn" onClick={() => submitReview("easy")}>
                  很简单
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "import" && (
        <section className="panel">
          <div className="field">
            <label>批量导入</label>
            <textarea
              className="textarea"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
            />
          </div>
          <button className="btn" onClick={importCards}>
            导入到单词本
          </button>
          <p className="footer-note">
            格式：标准英文 -&gt; 听感标注 -&gt; 中文意思。正式版可以继续支持 CSV、Anki 和音频压缩包。
          </p>
        </section>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button className={`tab ${active ? "active" : ""}`} onClick={onClick}>
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        {icon}
        {children}
      </span>
    </button>
  );
}

function SearchSummary({ query, count }: { query: string; count: number }) {
  const oral = getOralVariants(query);
  return (
    <div className="meta-row">
      <Badge tone="green">{count} 条候选片段</Badge>
      {oral.variants.map((variant) => (
        <Badge key={variant} tone="blue">
          {variant}
        </Badge>
      ))}
      {oral.rules.map((rule) => (
        <Badge key={`${rule.from}-${rule.to}`} tone="amber">
          {rule.from} → {rule.to}
        </Badge>
      ))}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
