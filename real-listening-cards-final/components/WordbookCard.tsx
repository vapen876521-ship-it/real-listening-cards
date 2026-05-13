import { Trash2 } from "lucide-react";
import type { WordbookCard as WordbookCardType } from "@/lib/types";
import { Badge } from "./Badge";
import { getOralVariants, highlightTerms } from "@/lib/pronunciation";

type Props = {
  card: WordbookCardType;
  onDelete: (id: string) => void;
};

export function WordbookCard({ card, onDelete }: Props) {
  const terms = [
    card.standardText,
    card.spokenText,
    ...getOralVariants(card.standardText).variants
  ];

  const tone =
    card.sourceType === "standard_fallback"
      ? "blue"
      : card.sourceType === "pending"
        ? "amber"
        : "green";

  const sourceText =
    card.sourceType === "standard_fallback"
      ? "标准发音替代"
      : card.sourceType === "pending"
        ? "待搜索"
        : "真实生活音源";

  return (
    <article className="word-card">
      <div className="word-top">
        <div>
          <h3>{card.standardText}</h3>
          <div className="zh">{card.translationZh}</div>
        </div>
        <button className="btn ghost" onClick={() => onDelete(card.id)}>
          删除 <Trash2 size={16} />
        </button>
      </div>

      <div className="meta-row" style={{ marginTop: 12 }}>
        <Badge tone={tone}>{sourceText}</Badge>
        <Badge tone="blue">{card.lexical.pos.join(" / ")}</Badge>
        {card.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div
        className="subtitle"
        style={{ marginTop: 14, fontSize: 16 }}
        dangerouslySetInnerHTML={{
          __html: highlightTerms(card.subtitle, terms)
        }}
      />

      <div className="info-grid" style={{ marginTop: 12 }}>
        <div className="info-box">
          <div className="info-label">词形变化</div>
          <div className="info-value">{card.lexical.inflections.join(" · ")}</div>
        </div>
        <div className="info-box">
          <div className="info-label">下次复习</div>
          <div className="info-value">{new Date(card.dueAt).toLocaleString("zh-CN")}</div>
        </div>
      </div>
    </article>
  );
}
