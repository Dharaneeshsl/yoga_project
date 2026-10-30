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
 * Computes hold score and pass status.
 * score = Math.round(average similarity * 100 * poseFraction)
 * Evaluates both alignment accuracy and hold continuity.
 * Guarantees score is an integer bounded strictly between 0 and 100.
 */
export function computeHoldScore(samples = [], passScoreThreshold = 60, poseFraction = 1.0) {
  if (!samples || samples.length === 0) {
    return { score: 0, isPassed: false, poseFraction: 0, avgSimilarity: 0 };
  }
  const validFraction = typeof poseFraction === 'number' && !isNaN(poseFraction)
    ? Math.max(0, Math.min(1, poseFraction))
    : 1.0;
  const avgSimilarity = samples.reduce((acc, val) => acc + val, 0) / samples.length;
  const score = Math.max(0, Math.min(100, Math.round(avgSimilarity * 100 * validFraction)));
  const isPassed = score >= passScoreThreshold;
  return { score, isPassed, poseFraction: validFraction, avgSimilarity };
}

/**
 * Pure simulation tick for continuous hold progression and timeout detection.
 */
export function calculateHoldProgress({
  currentElapsed,
  deltaSeconds,
  inPose,
  targetDuration = 30,
  tabHidden = false,
  totalAttemptTime = 0,
  maxTimeoutMultiplier = 3
}) {
  const timeoutLimit = targetDuration * maxTimeoutMultiplier;
  const isTimedOut = totalAttemptTime >= timeoutLimit;

  if (tabHidden || !inPose) {
    return {
      elapsed: currentElapsed,
      isCompleted: currentElapsed >= targetDuration || isTimedOut,
      isTimedOut
    };
  }

  const nextElapsed = Math.min(targetDuration, currentElapsed + Math.max(0, deltaSeconds));
  return {
    elapsed: nextElapsed,
    isCompleted: nextElapsed >= targetDuration || isTimedOut,
    isTimedOut
  };
}
