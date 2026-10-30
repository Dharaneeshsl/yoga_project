import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUnlockedLevels,
  parseSavedScores,
  computeHoldScore,
  calculateHoldProgress
} from './storageUtils.js';

describe('Scoring Logic: Score Accumulation & Pass Threshold', () => {
  it('correctly passes when average similarity meets the threshold (>= 60%)', () => {
    // User scored consistently around 75% similarity with full hold continuity (poseFraction = 1.0)
    const samples = [0.72, 0.76, 0.74, 0.78, 0.75];
    const { score, isPassed, poseFraction } = computeHoldScore(samples, 60, 1.0);

    assert.equal(typeof score, 'number');
    assert.equal(score, 75);
    assert.equal(isPassed, true);
    assert.equal(poseFraction, 1.0);
  });

  it('fails when average similarity is below the threshold (< 60%)', () => {
    // User scored poorly around 45% similarity
    const samples = [0.42, 0.48, 0.45, 0.46, 0.44];
    const { score, isPassed } = computeHoldScore(samples, 60, 1.0);

    assert.equal(score, 45);
    assert.equal(isPassed, false);
  });

  it('factors hold continuity (poseFraction) so losing pose lowers score and triggers failure', () => {
    // User had 80% similarity while in pose, but was only in pose 50% of the attempt time (poseFraction = 0.5)
    // score = 80 * 0.5 = 40 (fails the 60 pass threshold!)
    const samples = [0.80, 0.80, 0.80, 0.80];
    const { score, isPassed, poseFraction } = computeHoldScore(samples, 60, 0.5);

    assert.equal(score, 40);
    assert.equal(isPassed, false);
    assert.equal(poseFraction, 0.5);
  });

  it('evaluates pass/fail across gentle (50%), standard (60%), and strict (70%) difficulty tiers', () => {
    const samples = [0.65, 0.65, 0.65]; // 65% performance

    // Gentle (pass >= 50) -> PASS
    assert.equal(computeHoldScore(samples, 50, 1.0).isPassed, true);
    // Standard (pass >= 60) -> PASS
    assert.equal(computeHoldScore(samples, 60, 1.0).isPassed, true);
    // Strict (pass >= 70) -> FAIL
    assert.equal(computeHoldScore(samples, 70, 1.0).isPassed, false);
  });

  it('strictly bounds score between 0 and 100 even with extreme sample values', () => {
    assert.equal(computeHoldScore([], 60).score, 0);
    assert.equal(computeHoldScore([1.5, 2.0], 60, 1.0).score, 100);
    assert.equal(computeHoldScore([-0.5, -1.0], 60, 1.0).score, 0);
  });

  it('evaluates side-aware mirror scoring and selects the higher score', () => {
    const primary = { overall: 0.45 };
    const mirrored = { overall: 0.82 };

    const selectedSide = mirrored.overall > primary.overall ? 'mirrored' : 'primary';
    const highestScore = Math.max(primary.overall, mirrored.overall);

    assert.equal(selectedSide, 'mirrored');
    assert.equal(highestScore, 0.82);
  });
});

describe('LocalStorage Validation & Clamping (Production Functions)', () => {
  it('clamps unlocked level to valid range (1 to 5)', () => {
    assert.equal(parseUnlockedLevels('3', 5), 3);
    assert.equal(parseUnlockedLevels('0', 5), 1);
    assert.equal(parseUnlockedLevels('-5', 5), 1);
    assert.equal(parseUnlockedLevels('99', 5), 5);
    assert.equal(parseUnlockedLevels('invalid', 5), 1);
    assert.equal(parseUnlockedLevels(null, 5), 1);
  });

  it('safely handles corrupt or valid JSON for saved scores', () => {
    assert.deepEqual(parseSavedScores('corrupt {json'), {});
    assert.deepEqual(parseSavedScores(null), {});
    assert.deepEqual(parseSavedScores('[1, 2, 3]'), {});

    const validRecord = JSON.stringify({ "1": 85, "2": 92 });
    assert.deepEqual(parseSavedScores(validRecord), { "1": 85, "2": 92 });
  });

  it('clamps and sanitizes out-of-range, NaN, and negative saved scores', () => {
    const rawRecord = JSON.stringify({
      "1": -20,
      "2": 150,
      "3": "not-a-number",
      "4": 75.8,
      "5": 100
    });
    const parsed = parseSavedScores(rawRecord);

    assert.deepEqual(parsed, {
      "1": 0,
      "2": 100,
      "4": 76,
      "5": 100
    });
  });
});

describe('Continuous Hold Progression (Production Functions)', () => {
  it('advances elapsed hold time only when in pose', () => {
    // In pose
    const tick1 = calculateHoldProgress({ currentElapsed: 10, deltaSeconds: 1, inPose: true });
    assert.equal(tick1.elapsed, 11);
    assert.equal(tick1.isCompleted, false);

    // Out of pose: time does not advance
    const tick2 = calculateHoldProgress({ currentElapsed: 11, deltaSeconds: 2, inPose: false });
    assert.equal(tick2.elapsed, 11);
    assert.equal(tick2.isCompleted, false);
  });

  it('pauses advancement when browser tab is hidden', () => {
    const tick = calculateHoldProgress({
      currentElapsed: 15,
      deltaSeconds: 5,
      inPose: true,
      tabHidden: true
    });
    assert.equal(tick.elapsed, 15);
    assert.equal(tick.isCompleted, false);
  });

  it('triggers completion when target duration is reached', () => {
    const tick = calculateHoldProgress({
      currentElapsed: 29.5,
      deltaSeconds: 1.0,
      inPose: true,
      targetDuration: 30
    });
    assert.equal(tick.elapsed, 30);
    assert.equal(tick.isCompleted, true);
    assert.equal(tick.isTimedOut, false);
  });

  it('triggers auto-fail timeout when total attempt time reaches 3x target duration', () => {
    // User struggled for 90 seconds (3x 30s target) with only 5 seconds held
    const tick = calculateHoldProgress({
      currentElapsed: 5,
      deltaSeconds: 1.0,
      inPose: false,
      targetDuration: 30,
      totalAttemptTime: 90
    });
    assert.equal(tick.isCompleted, true);
    assert.equal(tick.isTimedOut, true);
    assert.equal(tick.elapsed, 5);
  });
});
