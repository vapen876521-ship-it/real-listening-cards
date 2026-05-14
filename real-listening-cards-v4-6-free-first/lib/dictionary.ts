import type { DictionaryEntry } from "./types";
import { curatedDictionary } from "./data/curated-dictionary";
import { fetchExternalDictionary, fetchExternalTranslation, fetchRapidApiChineseEnglishDictionary, fetchMyMemoryTranslation } from "./connectors";
import { containsChinese, normalize } from "./pronunciation";

type FreeDictionaryResponse = Array<{
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    definitions?: Array<{ definition?: string; example?: string }>;
  }>;
}>;

export async function lookupDictionary(input: string): Promise<DictionaryEntry> {
  const normalized = normalize(input);
  const curated = findCurated(normalized);
  if (curated) return curated;

  const rapidChinese = await fetchRapidApiChineseEnglishDictionary(normalized);
  if (rapidChinese?.found) return rapidChinese;

  const external = await fetchExternalDictionary(normalized);
  if (external?.found) return external;

  if (!containsChinese(normalized)) {
    const freeEnglish = await lookupFreeEnglishDictionary(normalized);
    if (freeEnglish?.found) return freeEnglish;
  }

  const translation = await fetchExternalTranslation(normalized);
  if (translation) {
    return {
      found: true,
      lemma: normalized,
      zh: translation,
      pos: ["翻译结果，词性待补充"],
      phonetic: "",
      inflections: ["无可确认词形变化"],
      collocations: ["待补充常见搭配"],
      source: "external_dictionary",
      note: "来自外部翻译接口。"
    };
  }

  const myMemoryTranslation = await fetchMyMemoryTranslation(
    normalized,
    /[\u4e00-\u9fff]/.test(normalized) ? "zh-CN|en" : "en|zh-CN"
  );
  if (myMemoryTranslation) {
    return {
      found: true,
      lemma: normalized,
      zh: myMemoryTranslation,
      pos: ["免费翻译结果，词性待补充"],
      phonetic: "",
      inflections: /[\u4e00-\u9fff]/.test(normalized) ? [myMemoryTranslation] : ["无可确认词形变化"],
      collocations: ["待补充常见搭配"],
      source: "external_dictionary",
      note: "来自 MyMemory 免费翻译兜底。它适合句子和短语临时解释，不等于正式词典。"
    };
  }

  return {
    found: false,
    lemma: normalized,
    zh: containsChinese(normalized) ? "待补充英文释义" : "待补充中文释义",
    pos: ["未确认"],
    phonetic: "",
    inflections: ["无可确认词形变化"],
    collocations: ["待补充常见搭配"],
    source: "unconfirmed",
    note: "当前没有可靠中英词典数据，因此不自动生成中文意思、词性、词形变化或搭配。"
  };
}

function findCurated(normalized: string) {
  if (curatedDictionary[normalized]) return curatedDictionary[normalized];

  return Object.keys(curatedDictionary)
    .filter((key) => normalized.includes(key))
    .sort((a, b) => b.length - a.length)
    .map((key) => curatedDictionary[key])[0];
}

async function lookupExternalDictionary(normalized: string): Promise<DictionaryEntry | null> {
  const endpoint = process.env.DICTIONARY_API_URL;
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    url.searchParams.set("q", normalized);
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

async function lookupFreeEnglishDictionary(normalized: string): Promise<DictionaryEntry | null> {
  if (normalized.split(/\s+/).length > 1) return null;

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`,
      { next: { revalidate: 60 * 60 * 24 * 7 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as FreeDictionaryResponse;
    const first = data[0];
    if (!first) return null;

    const meanings = first.meanings || [];
    const pos = Array.from(new Set(meanings.map((m) => m.partOfSpeech).filter(Boolean))) as string[];
    const definitions = meanings
      .flatMap((m) => m.definitions || [])
      .map((d) => d.definition)
      .filter((item): item is string => Boolean(item))
      .slice(0, 3);
    const examples = meanings
      .flatMap((m) => m.definitions || [])
      .map((d) => d.example)
      .filter((item): item is string => Boolean(item))
      .slice(0, 4);
    const phonetic = first.phonetic || first.phonetics?.find((p) => p.text)?.text || "";

    if (!pos.length && !definitions.length) return null;

    return {
      found: true,
      lemma: first.word || normalized,
      zh: "待补充中文释义",
      pos: pos.length ? pos : ["外部英文词典已确认，词性待补充"],
      phonetic,
      inflections: ["无可确认词形变化"],
      collocations: examples.length ? examples : definitions.map((d) => `英文释义：${d}`),
      source: "free_english",
      note: definitions.length
        ? `来自免费英文词典。英文释义：${definitions.join(" / ")}。中文释义需要中英词典或人工整理。`
        : "来自免费英文词典。中文释义需要中英词典或人工整理。"
    };
  } catch {
    return null;
  }
}
