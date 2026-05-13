import { NextResponse } from "next/server";
import { getLexicalInfo } from "@/lib/lexicon";
import { getOralVariants } from "@/lib/pronunciation";
import type { ClipResult } from "@/lib/types";

type YouTubeSearchItem = {
  id: { videoId?: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
  };
};

type TimedTextEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return NextResponse.json({ results: [], error: "请输入搜索内容。" }, { status: 400 });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        results: [],
        error:
          "缺少 YOUTUBE_API_KEY。请在 Vercel Project Settings → Environment Variables 添加 YouTube Data API Key。"
      },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "8",
    videoEmbeddable: "true",
    relevanceLanguage: "en",
    safeSearch: "moderate",
    q: query,
    key
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const response = await fetch(url, { next: { revalidate: 60 * 60 } });

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { results: [], error: `YouTube 搜索失败：${message}` },
      { status: 500 }
    );
  }

  const json = (await response.json()) as { items?: YouTubeSearchItem[] };
  const items = (json.items || []).filter((item) => item.id.videoId);

  const results = await Promise.all(
    items.map(async (item): Promise<ClipResult> => {
      const videoId = item.id.videoId!;
      const transcript = await findTranscriptSnippet(videoId, query);
      const lexical = getLexicalInfo(query);
      const oral = getOralVariants(query);
      const spokenText = oral.variants.find((variant) => variant.toLowerCase() !== query.toLowerCase()) || query;
      const start = transcript.startTime ?? 0;
      const end = transcript.endTime ?? Math.max(start + 8, 8);

      return {
        id: videoId,
        sourceType: transcript.found ? "real_video" : "caption_unavailable",
        title: decodeHtml(item.snippet.title),
        sourceName: item.snippet.channelTitle,
        videoId,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(start)}s`,
        startTime: start,
        endTime: end,
        standardText: query,
        spokenText,
        subtitle:
          transcript.subtitle ||
          decodeHtml(item.snippet.title + ". " + item.snippet.description).slice(0, 260),
        translationZh: lexical.zh,
        lexical,
        accent: "unknown",
        speed: "unknown",
        difficulty: "B1",
        notes: transcript.found
          ? "已找到公开视频字幕片段。请以实际视频声音为准。"
          : "找到了公开视频，但没有稳定取得字幕。这里暂时显示标题/简介，仍可打开视频确认。",
        tags: [
          "真实视频",
          ...oral.rules.map((rule) => rule.label),
          ...oral.rules.map((rule) => rule.to)
        ].filter(Boolean)
      };
    })
  );

  return NextResponse.json({ results });
}

async function findTranscriptSnippet(videoId: string, query: string) {
  const urls = [
    `https://www.youtube.com/api/timedtext?fmt=json3&lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?fmt=json3&lang=en&kind=asr&v=${videoId}`,
    `https://video.google.com/timedtext?fmt=json3&lang=en&v=${videoId}`,
    `https://video.google.com/timedtext?fmt=json3&lang=en&kind=asr&v=${videoId}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      const events = (data.events || []) as TimedTextEvent[];
      const lines = events
        .map((event) => ({
          start: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 1800) / 1000,
          text: (event.segs || [])
            .map((seg) => seg.utf8 || "")
            .join("")
            .replace(/\s+/g, " ")
            .trim()
        }))
        .filter((line) => line.text);

      if (lines.length === 0) continue;

      const oral = getOralVariants(query);
      const terms = [query, ...oral.variants, ...oral.rules.flatMap((rule) => [rule.from, rule.to])]
        .map((term) => term.toLowerCase())
        .filter(Boolean);

      let index = lines.findIndex((line) =>
        terms.some((term) => line.text.toLowerCase().includes(term))
      );

      if (index < 0) index = 0;

      const window = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 3));
      const subtitle = window.map((line) => line.text).join(" ");
      const startTime = window[0]?.start || 0;
      const last = window[window.length - 1];

      return {
        found: index >= 0,
        subtitle,
        startTime,
        endTime: last ? last.start + last.duration : startTime + 8
      };
    } catch {
      continue;
    }
  }

  return { found: false, subtitle: "", startTime: 0, endTime: 8 };
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
