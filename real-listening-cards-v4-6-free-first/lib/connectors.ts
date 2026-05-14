import type { DictionaryEntry, PronunciationSample } from "./types";

export async function fetchExternalDictionary(q: string): Promise<DictionaryEntry | null> {
  const endpoint = process.env.EXTERNAL_DICTIONARY_URL || process.env.DICTIONARY_API_URL;
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    url.searchParams.set("q", q);

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;

    const data = (await res.json()) as Partial<DictionaryEntry>;
    if (!data.found || !data.lemma || !data.zh || !Array.isArray(data.pos)) return null;

    return {
      found: true,
      lemma: data.lemma,
      zh: data.zh,
      pos: data.pos,
      phonetic: data.phonetic || "",
      inflections: Array.isArray(data.inflections) && data.inflections.length ? data.inflections : ["无可确认词形变化"],
      collocations: Array.isArray(data.collocations) && data.collocations.length ? data.collocations : ["待补充常见搭配"],
      source: "external_dictionary",
      note: data.note || "来自外部中英词典接口。"
    };
  } catch {
    return null;
  }
}

export async function fetchExternalTranslation(q: string): Promise<string | null> {
  const endpoint = process.env.EXTERNAL_TRANSLATION_URL;
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    url.searchParams.set("q", q);

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;

    const data = (await res.json()) as { found?: boolean; translation?: string };
    if (!data.found || !data.translation) return null;

    return data.translation;
  } catch {
    return null;
  }
}

export async function fetchExternalAudioSamples(q: string): Promise<PronunciationSample[]> {
  const [freeDictionaryAudio, configuredSamples, forvoSamples] = await Promise.all([
    fetchFreeDictionaryAudioSamples(q),
    fetchConfiguredExternalAudioSamples(q),
    fetchForvoPronunciations(q)
  ]);

  // 免费优先：先用 Free Dictionary 标准发音，再用你配置的免费/授权音源，最后才用 Forvo。
  return [...freeDictionaryAudio, ...configuredSamples, ...forvoSamples];
}

export async function fetchExternalCorpusItems(q: string) {
  const endpoint = process.env.EXTERNAL_CORPUS_SEARCH_URL;
  if (!endpoint) return [];

  try {
    const url = new URL(endpoint);
    url.searchParams.set("q", q);

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 30 } });
    if (!res.ok) return [];

    const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
    return data.items || [];
  } catch {
    return [];
  }
}


type RapidDictionaryCandidate = {
  lemma: string;
  zh: string;
  pos: string[];
  phonetic?: string;
  inflections: string[];
  collocations: string[];
  note?: string;
};

export async function fetchRapidApiChineseEnglishDictionary(q: string): Promise<DictionaryEntry | null> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;

  const host = process.env.RAPIDAPI_CHINESE_DICTIONARY_HOST || "chinese-english-dictionary-api.p.rapidapi.com";
  const configuredUrl = process.env.RAPIDAPI_CHINESE_DICTIONARY_URL;

  const urls = configuredUrl
    ? [configuredUrl]
    : [
        `https://${host}/search`,
        `https://${host}/lookup`,
        `https://${host}/dictionary`,
        `https://${host}/entries`,
        `https://${host}/`
      ];

  for (const candidateUrl of urls) {
    try {
      const url = new URL(candidateUrl);

      // Different RapidAPI wrappers use different parameter names.
      // Sending several common names is usually harmless.
      url.searchParams.set("q", q);
      url.searchParams.set("query", q);
      url.searchParams.set("word", q);

      const res = await fetch(url.toString(), {
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": host
        },
        next: { revalidate: 60 * 60 * 24 }
      });

      if (!res.ok) continue;

      const data = await res.json();
      const parsed = parseRapidDictionary(data, q);
      if (parsed) {
        return {
          found: true,
          lemma: parsed.lemma,
          zh: parsed.zh,
          pos: parsed.pos.length ? parsed.pos : ["中文词"],
          phonetic: parsed.phonetic || "",
          inflections: parsed.inflections.length ? parsed.inflections : [parsed.lemma],
          collocations: parsed.collocations.length ? parsed.collocations : ["待补充常见搭配"],
          source: "external_dictionary",
          note: parsed.note || "来自 RapidAPI Chinese-English Dictionary API。"
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseRapidDictionary(data: unknown, q: string): RapidDictionaryCandidate | null {
  const entries = collectObjects(data);
  const scored = entries
    .map((entry) => normalizeRapidEntry(entry, q))
    .filter((entry): entry is RapidDictionaryCandidate => Boolean(entry))
    .sort((a, b) => scoreRapidEntry(b, q) - scoreRapidEntry(a, q));

  return scored[0] || null;
}

function collectObjects(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(collectObjects);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = Object.values(obj).flatMap(collectObjects);
    return [obj, ...nested];
  }
  return [];
}

function normalizeRapidEntry(entry: Record<string, unknown>, q: string): RapidDictionaryCandidate | null {
  const traditional = asString(entry.traditional || entry.trad || entry.t);
  const simplified = asString(entry.simplified || entry.simp || entry.s);
  const chinese = simplified || traditional || asString(entry.chinese || entry.word || entry.entry || entry.term || entry.text);

  const pinyin = asString(entry.pinyin || entry.pronunciation || entry.reading);
  const defsRaw =
    entry.definitions ||
    entry.definition ||
    entry.english ||
    entry.translations ||
    entry.translation ||
    entry.meanings ||
    entry.meaning ||
    entry.gloss;

  const definitions = normalizeStringList(defsRaw)
    .flatMap((item) => item.split(/[;/；]/))
    .map((item) => item.trim())
    .filter(Boolean);

  if (!definitions.length && !chinese) return null;

  const englishCandidates = definitions.filter((item) => /[a-z]/i.test(item));
  const lemma = englishCandidates[0] || chinese || q;

  return {
    lemma,
    zh: chinese ? `${chinese}${pinyin ? `（${pinyin}）` : ""}` : q,
    pos: ["中文词"],
    phonetic: pinyin,
    inflections: englishCandidates.slice(0, 6),
    collocations: definitions.slice(0, 8),
    note: "来自 RapidAPI Chinese-English Dictionary API。"
  };
}

function scoreRapidEntry(entry: RapidDictionaryCandidate, q: string) {
  let score = 0;
  if (entry.zh.includes(q)) score += 20;
  if (entry.inflections.length) score += 10;
  if (entry.collocations.length) score += 5;
  return score;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value].filter(Boolean);
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === "string") return [item];
        if (typeof item === "object" && item) {
          const obj = item as Record<string, unknown>;
          return normalizeStringList(obj.definition || obj.meaning || obj.translation || obj.english || obj.text);
        }
        return [];
      })
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(normalizeStringList);
  }
  return [];
}



export async function fetchMyMemoryTranslation(q: string, langpair = "en|zh-CN"): Promise<string | null> {
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", q);
    url.searchParams.set("langpair", langpair);
    const email = process.env.MYMEMORY_EMAIL;
    if (email) url.searchParams.set("de", email);

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };

    const text = data.responseData?.translatedText?.trim();
    if (!text || text.toLowerCase() === q.toLowerCase()) return null;
    return text;
  } catch {
    return null;
  }
}

type FreeDictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
};

export async function fetchFreeDictionaryAudioSamples(q: string): Promise<PronunciationSample[]> {
  const clean = q.trim();
  if (!clean || clean.split(/\s+/).length > 1 || /[\u4e00-\u9fff]/.test(clean)) return [];

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { next: { revalidate: 60 * 60 * 24 * 7 } }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as FreeDictionaryEntry[];
    const samples: PronunciationSample[] = [];

    for (const entry of data) {
      for (const [index, phonetic] of (entry.phonetics || []).entries()) {
        let audioUrl = phonetic.audio || "";
        if (!audioUrl) continue;
        if (audioUrl.startsWith("//")) audioUrl = `https:${audioUrl}`;
        if (!audioUrl.startsWith("http")) continue;

        samples.push({
          id: `free-dictionary-${entry.word || clean}-${index}`,
          source: "manual",
          title: `${entry.word || clean} dictionary pronunciation`,
          sourceName: "Free Dictionary API",
          externalUrl: `https://dictionaryapi.dev/`,
          audioUrl,
          startTime: 0,
          endTime: 2,
          duration: 2,
          subtitle: entry.word || clean,
          captionFound: true,
          exactMatch: true,
          variantMatch: false,
          sourceDiversityKey: `Free Dictionary API-${index}`,
          qualityScore: 82,
          qualityLabel: "high",
          reviewEligible: true,
          tags: ["免费词典发音", "标准发音", "可复习"],
          note: "来自 Free Dictionary API 的标准发音。不是生活口语样本，但可以作为找不到真实语境时的免费兜底。"
        });
      }
    }

    return samples.slice(0, 4);
  } catch {
    return [];
  }
}
