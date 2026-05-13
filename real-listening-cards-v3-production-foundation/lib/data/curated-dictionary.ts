import type { DictionaryEntry } from "@/lib/types";

export const curatedDictionary: Record<string, DictionaryEntry> = {
  april: {
    found: true,
    lemma: "April",
    zh: "四月",
    pos: ["名词", "专有名词", "月份"],
    phonetic: "/ˈeɪprəl/",
    inflections: ["April"],
    collocations: ["in April", "early April", "late April", "April Fool's Day", "April 1st"],
    source: "curated"
  },
  january: month("January", "一月"),
  february: month("February", "二月"),
  march: month("March", "三月"),
  may: {
    found: true,
    lemma: "May",
    zh: "五月；也可作情态动词，表示可能或许可",
    pos: ["名词", "专有名词", "月份", "情态动词"],
    phonetic: "/meɪ/",
    inflections: ["May", "may"],
    collocations: ["in May", "May I ...?", "may be", "may have"],
    source: "curated",
    note: "May 有月份和情态动词两种常见用法，需要结合句子判断。"
  },
  june: month("June", "六月"),
  july: month("July", "七月"),
  august: month("August", "八月"),
  september: month("September", "九月"),
  october: month("October", "十月"),
  november: month("November", "十一月"),
  december: month("December", "十二月"),

  do: word("do", "做；干；进行；也可作助动词", ["动词", "助动词"], "/duː/", ["do", "does", "did", "done", "doing"], ["do it", "do that", "do homework", "do your best"]),
  want: word("want", "想要；需要", ["动词", "名词"], "/wɑːnt/", ["want", "wants", "wanted", "wanting"], ["want to do", "want something", "really want", "want me to"]),
  call: word("call", "打电话；呼叫；称呼", ["动词", "名词"], "/kɔːl/", ["call", "calls", "called", "calling"], ["call me", "call you back", "phone call", "call it"]),
  know: word("know", "知道；认识；了解", ["动词"], "/noʊ/", ["know", "knows", "knew", "known", "knowing"], ["I know", "you know", "know about", "know what"]),
  think: word("think", "认为；思考", ["动词"], "/θɪŋk/", ["think", "thinks", "thought", "thinking"], ["I think", "think about", "think of", "think so"]),
  hard: word("hard", "困难的；努力地；坚硬的", ["形容词", "副词"], "/hɑːrd/", ["hard", "harder", "hardest"], ["hard work", "work hard", "kind of hard", "hard to say"]),
  later: word("later", "稍后；后来", ["副词", "形容词"], "/ˈleɪtər/", ["later"], ["see you later", "call you later", "later on"]),

  "want to": phrase("want to", "想要；想做", ["词组", "动词短语"], "/wɑːnt tuː/", ["want to", "wants to", "wanted to", "wanting to"], ["want to go", "want to know", "want to see", "want to do"]),
  "going to": phrase("going to", "将要；打算", ["词组", "助动结构"], "/ˈɡoʊɪŋ tuː/", ["am going to", "is going to", "are going to", "was going to", "were going to"], ["going to be", "going to do", "going to go", "going to have"]),
  "kind of": phrase("kind of", "有点；有几分；某种程度上", ["词组", "副词短语"], "/kaɪnd əv/", ["kind of"], ["kind of hard", "kind of weird", "kind of like", "kind of a big deal"]),
  "let me": phrase("let me", "让我", ["词组", "祈使结构"], "/let miː/", ["let me"], ["let me see", "let me know", "let me think", "let me do it"]),
  "what do you want to do": phrase("what do you want to do", "你想做什么？", ["句子", "疑问句"], "", ["What do you want to do?", "What do you wanna do?", "Whaddaya wanna do?"], ["what do you want to do next", "what do you want to do about it"]),
  "what do you mean": phrase("what do you mean", "你是什么意思？", ["句子", "疑问句"], "", ["What do you mean?", "Whaddaya mean?"], ["what do you mean by that", "what do you mean exactly"])
};

function month(lemma: string, zh: string): DictionaryEntry {
  return {
    found: true,
    lemma,
    zh,
    pos: ["名词", "专有名词", "月份"],
    phonetic: "",
    inflections: [lemma],
    collocations: [`in ${lemma}`, `early ${lemma}`, `late ${lemma}`],
    source: "curated"
  };
}

function word(
  lemma: string,
  zh: string,
  pos: string[],
  phonetic: string,
  inflections: string[],
  collocations: string[]
): DictionaryEntry {
  return {
    found: true,
    lemma,
    zh,
    pos,
    phonetic,
    inflections,
    collocations,
    source: "curated"
  };
}

function phrase(
  lemma: string,
  zh: string,
  pos: string[],
  phonetic: string,
  inflections: string[],
  collocations: string[]
): DictionaryEntry {
  return {
    found: true,
    lemma,
    zh,
    pos,
    phonetic,
    inflections,
    collocations,
    source: "curated"
  };
}
