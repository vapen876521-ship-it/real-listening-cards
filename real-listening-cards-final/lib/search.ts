import type { ClipResult } from "./types";
import { getLexicalInfo } from "./lexicon";
import { getOralVariants } from "./pronunciation";

const mockClips: Omit<ClipResult, "lexical">[] = [
  {
    id: "clip-whaddaya-wanna",
    sourceType: "real_video",
    title: "Casual question in fast American speech",
    sourceName: "YouTube indexed subtitle demo",
    videoId: "M7lc1UVf-VE",
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=0s",
    startTime: 0,
    endTime: 8,
    standardText: "What do you want to do?",
    spokenText: "Whaddaya wanna do?",
    subtitle: "What do you want to do? / Whaddaya wanna do?",
    translationZh: "你想做什么？",
    accent: "American",
    speed: "fast",
    difficulty: "B1",
    notes:
      "what do you 可能连成 whaddaya；want to 可能弱化成 wanna。真实语速下它们会更像一个声音块。",
    tags: ["连读", "缩读", "whaddaya", "wanna"]
  },
  {
    id: "clip-gonna-call",
    sourceType: "real_video",
    title: "Future plan in casual conversation",
    sourceName: "YouTube indexed subtitle demo",
    videoId: "M7lc1UVf-VE",
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=10s",
    startTime: 10,
    endTime: 18,
    standardText: "I am going to call you later.",
    spokenText: "I'm gonna call you later.",
    subtitle: "I'm gonna call you later.",
    translationZh: "我晚点给你打电话。",
    accent: "American",
    speed: "normal",
    difficulty: "A2",
    notes: "going to 在口语里常变成 gonna。",
    tags: ["缩读", "gonna"]
  },
  {
    id: "clip-kinda-hard",
    sourceType: "real_video",
    title: "A common reduced phrase",
    sourceName: "YouTube indexed subtitle demo",
    videoId: "M7lc1UVf-VE",
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=30s",
    startTime: 30,
    endTime: 38,
    standardText: "It's kind of hard.",
    spokenText: "It's kinda hard.",
    subtitle: "It's kinda hard.",
    translationZh: "这有点难。",
    accent: "American",
    speed: "fast",
    difficulty: "A2",
    notes: "kind of 常弱读成 kinda。",
    tags: ["弱读", "kinda"]
  },
  {
    id: "clip-lemme-think",
    sourceType: "real_video",
    title: "Let me in connected speech",
    sourceName: "YouTube indexed subtitle demo",
    videoId: "M7lc1UVf-VE",
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=20s",
    startTime: 20,
    endTime: 28,
    standardText: "Let me think about it.",
    spokenText: "Lemme think about it.",
    subtitle: "Lemme think about it.",
    translationZh: "让我想一想。",
    accent: "American",
    speed: "normal",
    difficulty: "A2",
    notes: "let me 常连读成 lemme。",
    tags: ["连读", "lemme"]
  },
  {
    id: "standard-want-to",
    sourceType: "standard_fallback",
    title: "Standard pronunciation fallback",
    sourceName: "Dictionary audio fallback demo",
    externalUrl: "",
    startTime: 0,
    endTime: 0,
    standardText: "want to",
    spokenText: "want to",
    subtitle: "want to",
    translationZh: "想要；想做",
    accent: "Standard",
    speed: "slow",
    difficulty: "A1",
    notes: "这是标准发音替代，不是真实生活口语音源。真实口语里 want to 常变成 wanna。",
    tags: ["标准发音替代"]
  }
];

export function searchClips(query: string): ClipResult[] {
  const normalized = query.toLowerCase().trim();
  const oral = getOralVariants(normalized);
  const terms = [
    normalized,
    ...oral.variants.map((item) => item.toLowerCase()),
    ...oral.rules.flatMap((rule) => [rule.from, rule.to])
  ].filter(Boolean);

  const scored = mockClips
    .map((clip) => {
      const haystack = [
        clip.standardText,
        clip.spokenText,
        clip.subtitle,
        clip.translationZh,
        clip.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      const score = terms.reduce((sum, term) => {
        if (!term) return sum;
        return haystack.includes(term) ? sum + term.length : sum;
      }, 0);

      return { clip, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const results =
    scored.length > 0
      ? scored.map(({ clip }) => clip)
      : mockClips.slice(0, 3);

  return results.map((clip) => ({
    ...clip,
    lexical: getLexicalInfo(clip.standardText)
  }));
}
