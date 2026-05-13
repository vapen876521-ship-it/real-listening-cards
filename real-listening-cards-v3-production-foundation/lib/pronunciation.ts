import type { OralVariant } from "./types";

export const pronunciationRules: OralVariant[] = [
  { from: "going to", to: "gonna", label: "缩读", note: "going to 在日常口语中常读成 gonna。" },
  { from: "want to", to: "wanna", label: "缩读", note: "want to 在快语速中常读成 wanna。" },
  { from: "got to", to: "gotta", label: "缩读", note: "got to 在口语中常读成 gotta。" },
  { from: "have to", to: "hafta", label: "弱读", note: "have to 中的 v 常弱化，整体接近 hafta。" },
  { from: "has to", to: "hasta", label: "弱读", note: "has to 在快语速中可能接近 hasta。" },
  { from: "kind of", to: "kinda", label: "弱读", note: "kind of 常弱读成 kinda。" },
  { from: "sort of", to: "sorta", label: "弱读", note: "sort of 常弱读成 sorta。" },
  { from: "out of", to: "outta", label: "弱读", note: "out of 常弱读成 outta。" },
  { from: "let me", to: "lemme", label: "连读", note: "let me 常连读成 lemme。" },
  { from: "give me", to: "gimme", label: "连读", note: "give me 常连读成 gimme。" },
  { from: "what do you", to: "whaddaya", label: "连读", note: "what do you 在口语中可能连成 whaddaya。" },
  { from: "what are you", to: "whatcha", label: "连读", note: "what are you 在快语速里可能接近 whatcha。" },
  { from: "did you", to: "didja", label: "同化", note: "did you 在快语速中可能接近 didja。" },
  { from: "don't you", to: "doncha", label: "同化", note: "don't you 在快语速中可能接近 doncha。" },
  { from: "could have", to: "coulda", label: "缩读", note: "could have 在口语里可能弱化成 coulda。" },
  { from: "should have", to: "shoulda", label: "缩读", note: "should have 在口语里可能弱化成 shoulda。" },
  { from: "would have", to: "woulda", label: "缩读", note: "would have 在口语里可能弱化成 woulda。" }
];

export function detectOralVariants(input: string) {
  const normalized = normalize(input);
  const rules = pronunciationRules.filter(
    (rule) => normalized.includes(rule.from) || normalized.includes(rule.to)
  );

  const terms = new Set<string>();
  terms.add(input);
  terms.add(normalized);

  for (const rule of rules) {
    terms.add(rule.from);
    terms.add(rule.to);
    terms.add(normalized.replace(new RegExp(escapeRegExp(rule.from), "gi"), rule.to));
    terms.add(normalized.replace(new RegExp(escapeRegExp(rule.to), "gi"), rule.from));
  }

  return {
    rules,
    terms: Array.from(terms).filter(Boolean)
  };
}

export function findSpokenVariant(input: string) {
  const normalized = normalize(input);
  return pronunciationRules.find((rule) => normalized === rule.to || normalized.includes(rule.to));
}

export function highlightTerms(text: string, terms: string[]) {
  let output = escapeHtml(text || "");
  const sorted = [...new Set(terms.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  if (sorted.length === 0) return output;

  const regex = new RegExp(`(${sorted.join("|")})`, "gi");
  return output.replace(regex, "<mark>$1</mark>");
}

export function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[“”‘’]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[。！？]+$/g, "")
    .replace(/[?!.,;:]+$/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return map[char] ?? char;
  });
}
