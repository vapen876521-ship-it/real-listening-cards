import { NextResponse } from "next/server";
import { analyzeInput } from "@/lib/analyze";
import { containsChinese, detectOralVariants, normalize } from "@/lib/pronunciation";
import type { PronunciationSample } from "@/lib/types";
import { fetchExternalAudioSamples } from "@/lib/connectors";

type YouTubeItem = {
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
  const q = (searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json({ error: "请输入搜索内容。" }, { status: 400 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "缺少 YOUTUBE_API_KEY。" }, { status: 500 });

  const analysis = await analyzeInput(q);
  const oral = detectOralVariants(q);
  const englishCandidates = englishCandidatesFromAnalysis(analysis);
  const searchSeed = containsChinese(q) ? englishCandidates[0] || "" : q;

  // 中文词没有可靠英文候选时，不硬搜 YouTube，避免出现无关结果
  if (containsChinese(q) && !searchSeed) {
    const externalPronunciationSamples = await fetchExternalAudioSamples(q);
    const ranked = rankAndDiversify(externalPronunciationSamples);
    const highQualitySamples = ranked.filter((s) => s.reviewEligible && s.qualityScore >= 70).slice(0, 8);
    const backupSamples = ranked.filter((s) => !highQualitySamples.some((good) => good.id === s.id)).slice(0, 8);
    return NextResponse.json({ analysis, highQualitySamples, backupSamples });
  }

  const searchTerms = containsChinese(q)
    ? [searchSeed, ...englishCandidates, ...analysis.standardForms].filter(Boolean)
    : [searchSeed, analysis.lemma, ...analysis.standardForms, ...oral.terms].filter(Boolean);

  const uniqueTerms = Array.from(new Set(searchTerms)).slice(0, 4);
  const searchQuery = uniqueTerms.join(" OR ");

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "18",
    videoEmbeddable: "true",
    relevanceLanguage: "en",
    safeSearch: "moderate",
    q: searchQuery,
    key
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    next: { revalidate: 60 * 30 }
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `YouTube 搜索失败：${text}` }, { status: 500 });
  }

  const data = (await response.json()) as { items?: YouTubeItem[] };
  const items = (data.items || []).filter((item) => item.id.videoId);

  const samples = await Promise.all(
    items.map(async (item): Promise<PronunciationSample> => {
      const videoId = item.id.videoId!;
      const transcript = await findTranscript(videoId, uniqueTerms);
      const title = decodeHtml(item.snippet.title);
      const desc = decodeHtml(item.snippet.description);
      const subtitle = transcript.subtitle || `${title}. ${desc}`.slice(0, 280);
      const exactMatch = hasExactTerm(subtitle, uniqueTerms);
      const variantMatch = hasExactTerm(subtitle, analysis.oralVariants.map((rule) => rule.to));
      const duration = Math.max(1, (transcript.endTime || 8) - (transcript.startTime || 0));
      const qualityScore = scoreSample({
        captionFound: transcript.found,
        exactMatch,
        variantMatch,
        duration,
        subtitle,
        title,
        query: q
      });
      const reviewEligible = Boolean(transcript.found && exactMatch && duration <= 15);

      return {
        id: videoId,
        source: "youtube",
        videoId,
        title,
        sourceName: item.snippet.channelTitle,
        externalUrl: `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(transcript.startTime || 0)}s`,
        startTime: transcript.startTime || 0,
        endTime: transcript.endTime || (transcript.startTime || 0) + 8,
        duration,
        subtitle,
        captionFound: transcript.found,
        exactMatch,
        variantMatch,
        sourceDiversityKey: item.snippet.channelTitle,
        qualityScore,
        qualityLabel: qualityScore >= 80 ? "high" : qualityScore >= 55 ? "medium" : "low",
        reviewEligible,
        tags: [
          transcript.found ? "字幕可用" : "未取到字幕",
          exactMatch ? "精确匹配" : "弱匹配",
          duration <= 12 ? "短片段" : "较长片段",
          variantMatch ? "口语变体匹配" : "",
          reviewEligible ? "可复习" : "仅备选"
        ].filter(Boolean),
        note: reviewEligible ? "可进入复习。" : "质量不足，只作为备选。"
      };
    })
  );

  const externalPronunciationSamples = await fetchExternalAudioSamples(uniqueTerms[0] || q);
  const ranked = rankAndDiversify([...externalPronunciationSamples, ...samples]);
  const highQualitySamples = ranked.filter((s) => s.reviewEligible && s.qualityScore >= 70).slice(0, 8);
  const backupSamples = ranked.filter((s) => !highQualitySamples.some((good) => good.id === s.id)).slice(0, 8);

  return NextResponse.json({ analysis, highQualitySamples, backupSamples });
}

async function findTranscript(videoId: string, terms: string[]) {
  const urls = [
    `https://www.youtube.com/api/timedtext?fmt=json3&lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?fmt=json3&lang=en&kind=asr&v=${videoId}`,
    `https://video.google.com/timedtext?fmt=json3&lang=en&v=${videoId}`,
    `https://video.google.com/timedtext?fmt=json3&lang=en&kind=asr&v=${videoId}`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json();
      const events = (json.events || []) as TimedTextEvent[];
      const lines = events
        .map((event) => ({
          start: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 1800) / 1000,
          text: (event.segs || []).map((seg) => seg.utf8 || "").join("").replace(/\s+/g, " ").trim()
        }))
        .filter((line) => line.text);

      if (!lines.length) continue;

      let index = lines.findIndex((line) => hasExactTerm(line.text, terms));
      const found = index >= 0;
      if (!found) index = 0;
      const window = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 3));
      const first = window[0];
      const last = window[window.length - 1];

      return {
        found,
        subtitle: window.map((line) => line.text).join(" "),
        startTime: first?.start || 0,
        endTime: last ? last.start + last.duration : (first?.start || 0) + 8
      };
    } catch {
      continue;
    }
  }

  return { found: false, subtitle: "", startTime: 0, endTime: 8 };
}

function scoreSample(input: {
  captionFound: boolean;
  exactMatch: boolean;
  variantMatch: boolean;
  duration: number;
  subtitle: string;
  title: string;
  query: string;
}) {
  let score = 10;
  if (input.captionFound) score += 35;
  if (input.exactMatch) score += 35;
  if (input.variantMatch) score += 10;
  if (input.duration >= 2 && input.duration <= 12) score += 12;
  if (input.subtitle.length >= 20 && input.subtitle.length <= 220) score += 5;
  if (input.title.toLowerCase().includes(input.query.toLowerCase())) score += 3;
  if (!input.captionFound) score -= 35;
  if (!input.exactMatch) score -= 20;
  if (input.duration > 20) score -= 12;
  return Math.max(0, Math.min(100, score));
}

function rankAndDiversify(samples: PronunciationSample[]) {
  const deduped = dedupe(samples).sort((a, b) => b.qualityScore - a.qualityScore);
  const usedSources = new Set<string>();
  const diverse: PronunciationSample[] = [];
  const overflow: PronunciationSample[] = [];

  for (const sample of deduped) {
    if (!usedSources.has(sample.sourceDiversityKey)) {
      usedSources.add(sample.sourceDiversityKey);
      diverse.push(sample);
    } else {
      overflow.push({ ...sample, qualityScore: Math.max(0, sample.qualityScore - 8) });
    }
  }

  return [...diverse, ...overflow.sort((a, b) => b.qualityScore - a.qualityScore)];
}

function dedupe(samples: PronunciationSample[]) {
  const seen = new Set<string>();
  const result: PronunciationSample[] = [];
  for (const sample of samples) {
    const key = normalize(sample.subtitle).slice(0, 90);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sample);
  }
  return result;
}

function hasExactTerm(text: string, terms: string[]) {
  const normalizedText = normalize(text);
  return terms.some((term) => {
    const clean = normalize(term);
    return clean.length > 0 && normalizedText.includes(clean);
  });
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}


function hasAsciiLetter(value: string) {
  return /[a-z]/i.test(value);
}

function englishCandidatesFromAnalysis(analysis: any) {
  const raw = [
    analysis.lemma,
    ...(analysis.standardForms || []),
    ...(analysis.inflections || []),
    ...(analysis.collocations || [])
  ];

  return raw
    .flatMap((item) => String(item).split(/[;；,，/|]/))
    .map((item) => item.trim())
    .filter((item) => hasAsciiLetter(item))
    .filter((item) => item.length <= 80);
}
