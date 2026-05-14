import type { DictionaryEntry } from "@/lib/types";

export const curatedDictionary: Record<string, DictionaryEntry> = {
  april: word("April", "四月", ["名词", "专有名词", "月份"], "/ˈeɪprəl/", ["April"], ["in April", "early April", "late April", "April Fool's Day"]),
  card: word("card", "卡片；贺卡；银行卡；纸牌", ["名词"], "/kɑːrd/", ["card", "cards"], ["flash card", "credit card", "birthday card", "business card"]),
  tool: word("tool", "工具；用具；手段", ["名词", "动词"], "/tuːl/", ["tool", "tools", "tooled", "tooling"], ["learning tool", "use a tool", "software tool"]),
  work: word("work", "工作；起作用；作品", ["动词", "名词"], "/wɜːrk/", ["work", "works", "worked", "working"], ["work hard", "go to work", "work on something"]),
  make: word("make", "制作；使得；造成", ["动词"], "/meɪk/", ["make", "makes", "made", "making"], ["make sure", "make sense", "make it"]),
  take: word("take", "拿；带走；花费；乘坐；接受", ["动词"], "/teɪk/", ["take", "takes", "took", "taken", "taking"], ["take a look", "take off", "take time"]),
  get: word("get", "得到；变得；到达；理解", ["动词"], "/ɡet/", ["get", "gets", "got", "gotten", "getting"], ["get it", "get up", "get better"]),
  go: word("go", "去；走；进行", ["动词"], "/ɡoʊ/", ["go", "goes", "went", "gone", "going"], ["go home", "go ahead", "go out"]),
  see: word("see", "看见；明白；会见", ["动词"], "/siː/", ["see", "sees", "saw", "seen", "seeing"], ["see you", "I see", "see if"]),
  look: word("look", "看；看起来；表情", ["动词", "名词"], "/lʊk/", ["look", "looks", "looked", "looking"], ["look at", "look like", "look for"]),
  use: word("use", "使用；用途", ["动词", "名词"], "/juːz/", ["use", "uses", "used", "using"], ["use it", "easy to use", "make use of"]),
  listen: word("listen", "听；倾听", ["动词"], "/ˈlɪsən/", ["listen", "listens", "listened", "listening"], ["listen to", "listen carefully", "listen again"]),
  learn: word("learn", "学习；学会；得知", ["动词"], "/lɜːrn/", ["learn", "learns", "learned", "learnt", "learning"], ["learn English", "learn how to", "learn from"]),
  speak: word("speak", "说话；讲话；会说某种语言", ["动词"], "/spiːk/", ["speak", "speaks", "spoke", "spoken", "speaking"], ["speak English", "speak to", "speaking practice"]),

  "want to": phrase("want to", "想要；想做", ["词组", "动词短语"], "/wɑːnt tuː/", ["want to", "wants to", "wanted to", "wanting to"], ["want to go", "want to know", "want to see"]),
  "going to": phrase("going to", "将要；打算", ["词组", "助动结构"], "/ˈɡoʊɪŋ tuː/", ["am going to", "is going to", "are going to"], ["going to be", "going to do"]),
  "kind of": phrase("kind of", "有点；有几分；某种程度上", ["词组", "副词短语"], "/kaɪnd əv/", ["kind of"], ["kind of hard", "kind of weird"]),
  "let me": phrase("let me", "让我", ["词组", "祈使结构"], "/let miː/", ["let me"], ["let me see", "let me know"]),
  "what do you want to do": phrase("what do you want to do", "你想做什么？", ["句子", "疑问句"], "", ["What do you want to do?", "What do you wanna do?", "Whaddaya wanna do?"], ["what do you want to do next"]),
  "what do you mean": phrase("what do you mean", "你是什么意思？", ["句子", "疑问句"], "", ["What do you mean?", "Whaddaya mean?"], ["what do you mean by that"]),

  "卡片": chinese("卡片", "card; flash card", ["中文词"], ["card", "flash card"], ["学习卡片", "单词卡片"]),
  "工具": chinese("工具", "tool; instrument", ["中文词"], ["tool", "instrument"], ["学习工具", "软件工具"]),
  "学习": chinese("学习", "learn; study", ["中文词", "动词"], ["learn", "study"], ["学习英语", "学习单词"]),
  "听力": chinese("听力", "listening; listening comprehension", ["中文词"], ["listening", "listening comprehension"], ["英语听力", "听力练习"])
};

function word(
  lemma: string,
  zh: string,
  pos: string[],
  phonetic: string,
  inflections: string[],
  collocations: string[]
): DictionaryEntry {
  return { found: true, lemma, zh, pos, phonetic, inflections, collocations, source: "curated" };
}

function phrase(
  lemma: string,
  zh: string,
  pos: string[],
  phonetic: string,
  inflections: string[],
  collocations: string[]
): DictionaryEntry {
  return { found: true, lemma, zh, pos, phonetic, inflections, collocations, source: "curated" };
}

function chinese(
  lemma: string,
  zh: string,
  pos: string[],
  inflections: string[],
  collocations: string[]
): DictionaryEntry {
  return { found: true, lemma, zh, pos, phonetic: "", inflections, collocations, source: "curated" };
}
