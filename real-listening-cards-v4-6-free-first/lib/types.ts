export type InputKind = "word" | "phrase" | "sentence" | "spoken_variant" | "chinese" | "unknown";

export type DictionarySource = "curated" | "external_dictionary" | "free_english" | "unconfirmed";

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

export type SampleFeedback =
  | "good"
  | "not_target"
  | "unclear"
  | "caption_wrong"
  | "noisy";

export type PronunciationSample = {
  id: string;
  source: "youtube" | "uploaded_audio" | "manual";
  videoId?: string;
  title: string;
  sourceName: string;
  externalUrl?: string;
  audioUrl?: string;
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
  tags: string[];
  note: string;
  feedback?: SampleFeedback[];
};

export type SearchResponse = {
  analysis: Analysis;
  highQualitySamples: PronunciationSample[];
  backupSamples: PronunciationSample[];
  error?: string;
};

export type ReviewMode = "dictation" | "restore_standard" | "multi_sample";

export type StudyStatus = "new" | "learning" | "difficult" | "mastered" | "paused";

export type WordbookItem = {
  id: string;
  query: string;
  analysis: Analysis;
  samples: PronunciationSample[];
  tags: string[];
  category: string;
  status: StudyStatus;
  notes: string;
  mistakeCount: number;
  sourceType: "search" | "import" | "upload" | "manual";
  importBatchId?: string;
  addedAt: string;
  dueAt: string;
  reviews: ReviewRecord[];
};

export type ImportLog = {
  id: string;
  createdAt: string;
  total: number;
  created: number;
  duplicates: number;
  failed: number;
  source: "text" | "csv" | "manual";
};

export type ReviewRecord = {
  reviewedAt: string;
  mode: ReviewMode;
  rating: "again" | "hard" | "good" | "easy";
  answer: string;
  accepted: boolean;
};
