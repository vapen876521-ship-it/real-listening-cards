export const pronunciationRules = [
  {
    from: "going to",
    to: "gonna",
    label: "缩读",
    note: "going to 在日常口语里常读成 gonna。"
  },
  {
    from: "want to",
    to: "wanna",
    label: "缩读",
    note: "want to 在快语速中常读成 wanna。"
  },
  {
    from: "what do you",
    to: "whaddaya",
    label: "连读",
    note: "what do you 在口语中可能连成 whaddaya。"
  },
  {
    from: "kind of",
    to: "kinda",
    label: "弱读",
    note: "kind of 常弱读成 kinda。"
  },
  {
    from: "sort of",
    to: "sorta",
    label: "弱读",
    note: "sort of 常弱读成 sorta。"
  },
  {
    from: "let me",
    to: "lemme",
    label: "连读",
    note: "let me 常连读成 lemme。"
  },
  {
    from: "give me",
    to: "gimme",
    label: "连读",
    note: "give me 常连读成 gimme。"
  },
  {
    from: "did you",
    to: "didja",
    label: "同化",
    note: "did you 在快语速中可能接近 didja。"
  },
  {
    from: "could have",
    to: "coulda",
    label: "缩读",
    note: "could have 在口语里可能弱化成 coulda。"
  },
  {
    from: "should have",
    to: "shoulda",
    label: "缩读",
    note: "should have 在口语里可能弱化成 shoulda。"
  },
  {
    from: "would have",
    to: "woulda",
    label: "缩读",
    note: "would have 在口语里可能弱化成 woulda。"
  }
];

export function getOralVariants(input: string) {
  const lower = input.toLowerCase();
  const matched = pronunciationRules.filter(
    (rule) => lower.includes(rule.from) || lower.includes(rule.to)
  );

  const variants = new Set<string>();
  variants.add(input);

  for (const rule of matched) {
    const fromRegex = new RegExp(`\\b${escapeRegExp(rule.from)}\\b`, "gi");
    const toRegex = new RegExp(`\\b${escapeRegExp(rule.to)}\\b`, "gi");
    variants.add(input.replace(fromRegex, rule.to));
    variants.add(input.replace(toRegex, rule.from));
  }

  return {
    variants: Array.from(variants),
    rules: matched
  };
}

export function highlightTerms(text: string, terms: string[]) {
  if (!text) return "";

  const escapedTerms = [...new Set(terms.filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  if (escapedTerms.length === 0) return escapeHtml(text);

  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(value: string) {
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
