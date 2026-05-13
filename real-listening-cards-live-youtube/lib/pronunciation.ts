export const pronunciationRules = [
  { from: "going to", to: "gonna", label: "缩读", note: "going to 常读成 gonna。" },
  { from: "want to", to: "wanna", label: "缩读", note: "want to 常读成 wanna。" },
  { from: "what do you", to: "whaddaya", label: "连读", note: "what do you 可能连成 whaddaya。" },
  { from: "kind of", to: "kinda", label: "弱读", note: "kind of 常弱读成 kinda。" },
  { from: "sort of", to: "sorta", label: "弱读", note: "sort of 常弱读成 sorta。" },
  { from: "let me", to: "lemme", label: "连读", note: "let me 常连读成 lemme。" },
  { from: "give me", to: "gimme", label: "连读", note: "give me 常连读成 gimme。" },
  { from: "did you", to: "didja", label: "同化", note: "did you 常接近 didja。" },
  { from: "could have", to: "coulda", label: "缩读", note: "could have 可弱化成 coulda。" },
  { from: "should have", to: "shoulda", label: "缩读", note: "should have 可弱化成 shoulda。" },
  { from: "would have", to: "woulda", label: "缩读", note: "would have 可弱化成 woulda。" }
];

export function getOralVariants(input: string) {
  const normalized = input.toLowerCase().trim();
  const rules = pronunciationRules.filter(
    (rule) => normalized.includes(rule.from) || normalized.includes(rule.to)
  );

  const variants = new Set<string>([input]);
  for (const rule of rules) {
    variants.add(input.replace(new RegExp(escapeRegExp(rule.from), "gi"), rule.to));
    variants.add(input.replace(new RegExp(escapeRegExp(rule.to), "gi"), rule.from));
    variants.add(rule.from);
    variants.add(rule.to);
  }

  return { variants: Array.from(variants), rules };
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
