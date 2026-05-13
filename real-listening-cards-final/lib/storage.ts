import type { WordbookCard, ReviewRecord } from "./types";

const KEY = "real-listening-cards-final-wordbook";

export function loadWordbook(): WordbookCard[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as WordbookCard[];
  } catch {
    return [];
  }
}

export function saveWordbook(cards: WordbookCard[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(cards));
}

export function toWordbookCard(card: Omit<WordbookCard, "addedAt" | "dueAt" | "reviews">): WordbookCard {
  const now = new Date().toISOString();
  return {
    ...card,
    addedAt: now,
    dueAt: now,
    reviews: []
  };
}

export function nextDueDate(rating: ReviewRecord["rating"]) {
  const date = new Date();

  if (rating === "again") date.setMinutes(date.getMinutes() + 10);
  if (rating === "hard") date.setDate(date.getDate() + 1);
  if (rating === "good") date.setDate(date.getDate() + 3);
  if (rating === "easy") date.setDate(date.getDate() + 7);

  return date.toISOString();
}
