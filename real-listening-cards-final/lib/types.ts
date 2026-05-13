export type SourceType = "real_video" | "real_audio" | "standard_fallback" | "pending";

export type LexicalInfo = {
  lemma: string;
  zh: string;
  pos: string[];
  phonetic?: string;
  inflections: string[];
  variants: {
    from: string;
    to: string;
    label: string;
  }[];
};

export type ClipResult = {
  id: string;
  sourceType: SourceType;
  title: string;
  sourceName: string;
  videoId?: string;
  externalUrl?: string;
  startTime: number;
  endTime: number;
  standardText: string;
  spokenText: string;
  subtitle: string;
  translationZh: string;
  lexical: LexicalInfo;
  accent: string;
  speed: "slow" | "normal" | "fast";
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1";
  notes: string;
  tags: string[];
};

export type WordbookCard = ClipResult & {
  addedAt: string;
  dueAt: string;
  reviews: ReviewRecord[];
};

export type ReviewRecord = {
  reviewedAt: string;
  rating: "again" | "hard" | "good" | "easy";
  answer: string;
};
