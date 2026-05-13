import { ExternalLink, Plus, Volume2 } from "lucide-react";
import type { ClipResult } from "@/lib/types";
import { Badge } from "./Badge";
import { getOralVariants, highlightTerms } from "@/lib/pronunciation";

type Props = {
  result: ClipResult;
  onAdd: (result: ClipResult) => void;
  isAdded: boolean;
  query: string;
};

export function SearchResultCard({ result, onAdd, isAdded, query }: Props) {
  const oral = getOralVariants(query || result.standardText);
  const terms = [
    query,
    result.standardText,
    result.spokenText,
    ...oral.variants,
    ...result.lexical.variants.flatMap((item) => [item.from, item.to])
  ].filter(Boolean);

  const sourceTone =
    result.sourceType === "real_video" || result.sourceType === "real_audio"
      ? "green"
      : result.sourceType === "standard_fallback"
        ? "blue"
        : "amber";

  const sourceText =
    result.sourceType === "real_video"
      ? "真实视频音源"
      : result.sourceType === "real_audio"
        ? "真实音频音源"
        : result.sourceType === "standard_fallback"
          ? "标准发音替代"
          : "待搜索";

  return (
    <article className="result-card">
      <div className="video-box">
        <div>
          <div className="video-kicker">{result.sourceName}</div>
          <div className="video-title">{result.title}</div>
          <p className="video-note">
            为避免预览环境反复弹网络权限，本版本不自动嵌入外部视频。正式部署后可以改成按需加载播放器。
          </p>
        </div>

        <div className="meta-row">
          <a
            className="btn secondary"
            href={result.externalUrl || "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!result.externalUrl}
          >
            打开原片段 <ExternalLink size={16} />
          </a>
        </div>
      </div>

      <div className="result-content">
        <div className="result-head">
          <div>
            <h3>{result.standardText}</h3>
            <div className="zh">{result.translationZh}</div>
          </div>
          <Badge tone={sourceTone}>{sourceText}</Badge>
        </div>

        <div
          className="subtitle"
          dangerouslySetInnerHTML={{
            __html: highlightTerms(result.subtitle, terms)
          }}
        />

        <div className="meta-row">
          <Badge tone="blue">{result.lexical.pos.join(" / ")}</Badge>
          <Badge>{result.accent}</Badge>
          <Badge>{result.speed}</Badge>
          <Badge>{result.difficulty}</Badge>
          {result.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>

        <div className="info-grid">
          <div className="info-box">
            <div className="info-label">中文意思</div>
            <div className="info-value">{result.lexical.zh || result.translationZh}</div>
          </div>
          <div className="info-box">
            <div className="info-label">词形变化 / 常见形式</div>
            <div className="info-value">{result.lexical.inflections.join(" · ")}</div>
          </div>
          <div className="info-box">
            <div className="info-label">听感标注</div>
            <div className="info-value">{result.spokenText}</div>
          </div>
          <div className="info-box">
            <div className="info-label">发音说明</div>
            <div className="info-value">{result.notes}</div>
          </div>
        </div>

        {result.lexical.variants.length > 0 && (
          <div className="meta-row">
            {result.lexical.variants.map((variant) => (
              <Badge key={`${variant.from}-${variant.to}`} tone="amber">
                {variant.from} → {variant.to}
              </Badge>
            ))}
          </div>
        )}

        <button className="btn" onClick={() => onAdd(result)}>
          {isAdded ? "再次添加到单词本" : "添加到单词本"} <Plus size={17} />
        </button>
      </div>
    </article>
  );
}
