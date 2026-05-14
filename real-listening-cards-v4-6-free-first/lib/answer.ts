export function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function answerAccepted(userAnswer: string, targets: string[]) {
  const user = normalizeAnswer(userAnswer);
  if (!user) return false;

  return targets.some((target) => {
    const cleanTarget = normalizeAnswer(target);
    if (!cleanTarget) return false;
    if (user === cleanTarget) return true;
    const distance = levenshtein(user, cleanTarget);
    const maxLen = Math.max(user.length, cleanTarget.length);
    const similarity = maxLen === 0 ? 0 : 1 - distance / maxLen;
    return similarity >= 0.88;
  });
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}
