import type { Analysis, InputKind } from "./types";
import { lookupDictionary } from "./dictionary";
import { containsChinese, detectOralVariants, findSpokenVariant, normalize } from "./pronunciation";

export async function analyzeInput(input: string): Promise<Analysis> {
  const normalized = normalize(input);
  const dictionary = await lookupDictionary(normalized);
  const oral = detectOralVariants(normalized);
  const spokenVariant = findSpokenVariant(normalized);

  const kind = detectKind(normalized, Boolean(spokenVariant), dictionary.pos);
  const standardForms = new Set<string>();

  if (dictionary.found) standardForms.add(dictionary.lemma);
  if (spokenVariant) standardForms.add(spokenVariant.from);
  for (const rule of oral.rules) standardForms.add(rule.from);

  return {
    input,
    normalized,
    kind,
    lemma: dictionary.lemma,
    zh: dictionary.zh,
    pos: dictionary.pos,
    phonetic: dictionary.phonetic,
    inflections: dictionary.inflections,
    collocations: dictionary.collocations,
    standardForms: Array.from(standardForms),
    oralVariants: oral.rules,
    dictionarySource: dictionary.source,
    confidence: dictionary.found ? "known" : spokenVariant ? "partial" : "unknown",
    warning: dictionary.note
  };
}

function detectKind(value: string, spokenVariant: boolean, pos: string[]): InputKind {
  if (containsChinese(value)) return "chinese";
  if (spokenVariant) return "spoken_variant";
  const joined = pos.join(" ");
  if (joined.includes("句子")) return "sentence";
  if (joined.includes("词组")) return "phrase";
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 1) return "word";
  if (words.length >= 5) return "sentence";
  return "phrase";
}
