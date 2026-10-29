import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePoseSimilarity } from './poseUtils.js';

describe('Scoring Logic: Score Accumulation & Pass Threshold', () => {
  it('correctly passes when average similarity meets the threshold (>= 60%)', () => {
    const samples = [0.76, 0.80, 0.84, 0.72];
    const avgScore = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 100);
    const passThreshold = 60;
    const isPassed = avgScore >= passThreshold;

    assert.equal(avgScore, 78);
    assert.equal(isPassed, true);
  });

  it('fails when average similarity is below the threshold (< 60%)', () => {
    const samples = [0.45, 0.50, 0.52, 0.48];
    const avgScore = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 100);
    const passThreshold = 60;
    const isPassed = avgScore >= passThreshold;

    assert.equal(avgScore, 49);
    assert.equal(isPassed, false);
  });

  it('evaluates side-aware mirror scoring and selects the higher score', () => {
    const levelRef = {
      id: 1,
      name: "Tree Pose",
      angles: { LKnee: 175, RKnee: 55 },
      mirroredAngles: { LKnee: 55, RKnee: 175 },
      tolerances: { LKnee: 25, RKnee: 25 }
    };

    // User is performing mirrored pose (left leg raised at 55°, right standing at 175°)
    const userAngles = { LKnee: 55, RKnee: 175 };
    const result = computePoseSimilarity(userAngles, levelRef);

    assert.equal(result.isMirrored, true, 'Should detect mirrored side');
    assert.ok(result.overall > 0.95, `Expected high similarity for matching mirrored side, got ${result.overall}`);
  });
});

describe('LocalStorage Validation & Clamping', () => {
  function parseUnlockedLevels(storedValue, maxLevels = 5) {
    if (!storedValue) return 1;
    const parsed = parseInt(storedValue, 10);
    if (isNaN(parsed) || parsed < 1) return 1;
    return Math.min(maxLevels, parsed);
  }

  function parseSavedScores(storedValue) {
    if (!storedValue) return {};
    try {
      const parsed = JSON.parse(storedValue);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
      return {};
    }
  }

  it('clamps unlocked level to valid range (1 to 5)', () => {
    assert.equal(parseUnlockedLevels(null), 1);
    assert.equal(parseUnlockedLevels('-3'), 1);
    assert.equal(parseUnlockedLevels('3'), 3);
    assert.equal(parseUnlockedLevels('99'), 5);
    assert.equal(parseUnlockedLevels('invalid'), 1);
  });

  it('safely handles corrupt or valid JSON for saved scores', () => {
    assert.deepEqual(parseSavedScores(null), {});
    assert.deepEqual(parseSavedScores('corrupt json {['), {});
    assert.deepEqual(parseSavedScores('[1,2,3]'), {});
    assert.deepEqual(parseSavedScores('{"1": 85, "2": 92}'), { "1": 85, "2": 92 });
  });
});

describe('Continuous Hold Progression', () => {
  function simulateHoldTick({
    currentElapsed,
    deltaSeconds,
    inPose,
    targetDuration = 30,
    tabHidden = false
  }) {
    if (tabHidden || !inPose) {
      return { elapsed: currentElapsed, isCompleted: false };
    }
    const nextElapsed = Math.min(targetDuration, currentElapsed + deltaSeconds);
    return {
      elapsed: nextElapsed,
      isCompleted: nextElapsed >= targetDuration
    };
  }

  it('advances elapsed hold time only when in pose', () => {
    // In pose
    const tick1 = simulateHoldTick({ currentElapsed: 10, deltaSeconds: 1, inPose: true });
    assert.equal(tick1.elapsed, 11);

    // Out of pose: pauses advancement
    const tick2 = simulateHoldTick({ currentElapsed: 11, deltaSeconds: 1, inPose: false });
    assert.equal(tick2.elapsed, 11);
  });

  it('pauses advancement when browser tab is hidden', () => {
    const tick = simulateHoldTick({ currentElapsed: 15, deltaSeconds: 1, inPose: true, tabHidden: true });
    assert.equal(tick.elapsed, 15);
  });

  it('triggers completion when target duration is reached', () => {
    const tick = simulateHoldTick({ currentElapsed: 29.5, deltaSeconds: 0.6, inPose: true, targetDuration: 30 });
    assert.equal(tick.elapsed, 30);
    assert.equal(tick.isCompleted, true);
  });
});
