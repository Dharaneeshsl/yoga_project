import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePoseSimilarity } from './poseUtils.js';
import {
  parseUnlockedLevels,
  parseSavedScores,
  computeHoldScore,
  calculateHoldProgress
} from './storageUtils.js';

describe('Scoring Logic: Score Accumulation & Pass Threshold', () => {
  it('correctly passes when average similarity meets the threshold (>= 60%)', () => {
    const samples = [0.76, 0.80, 0.84, 0.72];
    const { score, isPassed } = computeHoldScore(samples, 60);

    assert.equal(score, 78);
    assert.equal(isPassed, true);
  });

  it('fails when average similarity is below the threshold (< 60%)', () => {
    const samples = [0.45, 0.50, 0.52, 0.48];
    const { score, isPassed } = computeHoldScore(samples, 60);

    assert.equal(score, 49);
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

describe('LocalStorage Validation & Clamping (Production Functions)', () => {
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
  });
});
