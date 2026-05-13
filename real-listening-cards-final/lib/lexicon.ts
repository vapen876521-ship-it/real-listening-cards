import type { LexicalInfo } from "./types";
import { getOralVariants } from "./pronunciation";

const builtIn: Record<string, Omit<LexicalInfo, "variants">> = {
  "what do you want to do": {
    lemma: "what do you want to do",
    zh: "你想做什么？",
    pos: ["句子", "疑问句"],
    phonetic: "",
    inflections: [
      "What do you wanna do?",
      "Whaddaya want to do?",
      "Whaddaya wanna do?"
    ]
  },
  "want to": {
    lemma: "want to",
    zh: "想要；想做",
    pos: ["词组", "动词短语"],
    phonetic: "/wɑːnt tuː/",
    inflections: ["wants to", "wanted to", "wanting to", "wanna"]
  },
  "going to": {
    lemma: "going to",
    zh: "将要；打算",
    pos: ["词组", "助动结构"],
    phonetic: "/ˈɡoʊɪŋ tuː/",
    inflections: ["am going to", "is going to", "are going to", "gonna"]
  },
  "kind of": {
    lemma: "kind of",
    zh: "有点；某种程度上",
    pos: ["词组", "副词短语"],
    phonetic: "/kaɪnd əv/",
    inflections: ["kinda"]
  },
  "let me": {
    lemma: "let me",
    zh: "让我",
    pos: ["词组", "祈使结构"],
    phonetic: "/let miː/",
    inflections: ["lemme"]
  },
  "do": {
    lemma: "do",
    zh: "做；干；进行",
    pos: ["动词", "助动词"],
    phonetic: "/duː/",
    inflections: ["do", "does", "did", "done", "doing"]
  },
  "hard": {
    lemma: "hard",
    zh: "困难的；努力地；坚硬的",
    pos: ["形容词", "副词"],
    phonetic: "/hɑːrd/",
    inflections: ["hard", "harder", "hardest"]
  },
  "call": {
    lemma: "call",
    zh: "打电话；称呼；呼叫",
    pos: ["动词", "名词"],
    phonetic: "/kɔːl/",
    inflections: ["call", "calls", "called", "calling"]
  }
};

export function getLexicalInfo(query: string): LexicalInfo {
  const normalized = normalize(query);
  const key =
    Object.keys(builtIn).find((item) => normalized.includes(item)) ??
    normalized;

  const base = builtIn[key] ?? guessLexicalInfo(normalized);
  const oral = getOralVariants(normalized);

  return {
    ...base,
    variants: oral.rules.map((rule) => ({
      from: rule.from,
      to: rule.to,
      label: rule.label
    }))
  };
}

function guessLexicalInfo(query: string): Omit<LexicalInfo, "variants"> {
  const words = query.split(/\s+/).filter(Boolean);

  const maybeVerb = words.length === 1;
  const lemma = query.toLowerCase();

  const inflections = maybeVerb
    ? guessInflections(lemma)
    : [query, ...getOralVariants(query).variants].filter(Boolean);

  return {
    lemma,
    zh: "待补充中文释义",
    pos: words.length > 1 ? ["词组 / 句子"] : ["单词"],
    phonetic: "",
    inflections
  };
}

function guessInflections(lemma: string) {
  if (!lemma) return [];
  if (lemma.endsWith("e")) {
    return [lemma, `${lemma}s`, `${lemma}d`, `${lemma.slice(0, -1)}ing`];
  }
  return [lemma, `${lemma}s`, `${lemma}ed`, `${lemma}ing`];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[?.!,;:]+$/g, "")
    .replace(/\s+/g, " ");
}
