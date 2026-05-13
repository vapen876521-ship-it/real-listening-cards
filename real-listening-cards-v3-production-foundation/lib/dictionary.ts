import type { DictionaryEntry } from "./types";
import { curatedDictionary } from "./data/curated-dictionary";
import { normalize } from "./pronunciation";

export async function lookupDictionary(input: string): Promise<DictionaryEntry> {
  const normalized = normalize(input);
  const curated = findCurated(normalized);

  if (curated) return curated;

  const external = await lookupExternalDictionary(normalized);
  if (external?.found) return external;

  return {
    found: false,
    lemma: normalized,
    zh: "待补充中文释义",
    pos: ["未确认"],
    phonetic: "",
    inflections: ["无可确认词形变化"],
    collocations: ["待补充常见搭配"],
    source: "unconfirmed",
    note: "当前没有可靠词典数据，因此不自动生成中文意思、词性、词形变化或搭配。"
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
      note: data.note || ""
    };
  } catch {
    return null;
  }
}
