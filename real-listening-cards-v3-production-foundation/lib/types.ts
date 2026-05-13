export type InputKind = "word" | "phrase" | "sentence" | "spoken_variant" | "unknown";

export type DictionarySource = "curated" | "external_dictionary" | "unconfirmed";

export type OralVariant = {
  from: string;
  to: string;
  label: string;
  note: string;
};

export type DictionaryEntry = {
  found: boolean;
  lemma: string;
  zh: string;
  pos: string[];
  phonetic?: string;
  inflections: string[];
  collocations: string[];
  source: DictionarySource;
  note?: string;
};

export type Analysis = {
  input: string;
  normalized: string;
  kind: InputKind;
  lemma: string;
  zh: string;
  pos: string[];
  phonetic?: string;
  inflections: string[];
  collocations: string[];
  standardForms: string[];
  oralVariants: OralVariant[];
  dictionarySource: DictionarySource;
  confidence: "known" | "partial" | "unknown";
  warning?: string;
};

export type PronunciationSample = {
  id: string;
  videoId: string;
  title: string;
  sourceName: string;
  externalUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  subtitle: string;
  captionFound: boolean;
  exactMatch: boolean;
  variantMatch: boolean;
  sourceDiversityKey: string;
  qualityScore: number;
  qualityLabel: "high" | "medium" | "low";
  reviewEligible: boolean;
  sourceType: "youtube_real_video" | "caption_unavailable";
  tags: string[];
  note: string;
};

export type SearchResponse = {
  analysis: Analysis;
  highQualitySamples: PronunciationSample[];
  backupSamples: PronunciationSample[];
  error?: string;
};

export type ReviewMode = "dictation" | "restore_standard";

export type WordbookItem = {
  id: string;
  query: string;
  analysis: Analysis;
  samples: PronunciationSample[];
  addedAt: string;
  dueAt: string;
  reviews: ReviewRecord[];
};

export type ReviewRecord = {
  reviewedAt: string;
  mode: ReviewMode;
  rating: "again" | "hard" | "good" | "easy";
  answer: string;
  accepted: boolean;
};
