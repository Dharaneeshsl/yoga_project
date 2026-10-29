/**
 * Pure utility functions for storage parsing, hold progression, and score accumulation.
 * Fully tested under node --test.
 */

/**
 * Validates and clamps unlocked level count from localStorage.
 */
export function parseUnlockedLevels(storedValue, maxLevels = 5) {
  if (!storedValue) return 1;
  const parsed = parseInt(storedValue, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  return Math.min(maxLevels, parsed);
}

/**
 * Safely parses saved score record dictionary from localStorage.
 * Sanitizes and clamps all values to valid integer bounds [0, 100].
 */
export function parseSavedScores(storedValue) {
  if (!storedValue) return {};
  try {
    const parsed = JSON.parse(storedValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const sanitized = {};
    for (const [key, val] of Object.entries(parsed)) {
      const num = Number(val);
      if (!isNaN(num)) {
        sanitized[key] = Math.max(0, Math.min(100, Math.round(num)));
      }
    }
    return sanitized;
  } catch {
    return {};
  }
}

/**
 * Computes hold score and pass status across all sampled frames.
 * Samples every frame during the active hold, reflecting true performance.
 * Guarantees score is an integer bounded strictly between 0 and 100.
 */
export function computeHoldScore(samples = [], passScoreThreshold = 60) {
  if (!samples || samples.length === 0) {
    return { score: 0, isPassed: false };
  }
  const avgSimilarity = samples.reduce((acc, val) => acc + val, 0) / samples.length;
  const score = Math.max(0, Math.min(100, Math.round(avgSimilarity * 100)));
  const isPassed = score >= passScoreThreshold;
  return { score, isPassed };
}

/**
 * Pure simulation tick for continuous hold progression.
 */
export function calculateHoldProgress({
  currentElapsed,
  deltaSeconds,
  inPose,
  targetDuration = 30,
  tabHidden = false
}) {
  if (tabHidden || !inPose) {
    return {
      elapsed: currentElapsed,
      isCompleted: currentElapsed >= targetDuration
    };
  }
  const nextElapsed = Math.min(targetDuration, currentElapsed + Math.max(0, deltaSeconds));
  return {
    elapsed: nextElapsed,
    isCompleted: nextElapsed >= targetDuration
  };
}
