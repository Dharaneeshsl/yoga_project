import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleBetween2D,
  checkFullBodyInFrame,
  classifyScore,
  drawPoseSkeleton
} from './poseUtils.js';
import {
  generateJointInstruction,
  getTopCorrectionHint,
  HintDebouncer
} from './poseFeedback.js';

describe('Pose Math: angleBetween2D', () => {
  it('calculates a 90-degree right angle correctly', () => {
    const a = { x: 0, y: 10 };
    const b = { x: 0, y: 0 };
    const c = { x: 10, y: 0 };
    const angle = angleBetween2D(a, b, c);
    assert.ok(Math.abs(angle - 90) < 1e-4, `Expected 90°, got ${angle}`);
  });

  it('calculates a 180-degree straight line angle correctly', () => {
    const a = { x: 0, y: -10 };
    const b = { x: 0, y: 0 };
    const c = { x: 0, y: 10 };
    const angle = angleBetween2D(a, b, c);
    assert.ok(Math.abs(angle - 180) < 1e-4, `Expected 180°, got ${angle}`);
  });

  it('handles zero length or invalid points gracefully', () => {
    assert.equal(angleBetween2D(null, { x: 0, y: 0 }, { x: 1, y: 1 }), null);
    assert.equal(angleBetween2D({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }), null);
  });
});

describe('Pose Visibility: checkFullBodyInFrame', () => {
  it('reports isReady=true when head, shoulders, hips, knees, ankles have visibility >= 0.5', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    const result = checkFullBodyInFrame(landmarks);
    assert.equal(result.isReady, true);
  });

  it('reports isReady=false and identifies missing feet when ankles have low visibility', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    // Occlude ankles (indices 27, 28)
    landmarks[27].visibility = 0.1;
    landmarks[28].visibility = 0.1;
    const result = checkFullBodyInFrame(landmarks);
    assert.equal(result.isReady, false);
    assert.ok(result.missingParts.includes('Feet / Ankles'));
  });

  it('reports isReady=false when landmarks fall outside [0, 1] frame bounds', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    // Landmark extrapolated beyond viewport (e.g. feet cut off below camera: y > 1.0)
    landmarks[27].y = 1.15;
    landmarks[28].y = 1.12;
    const result = checkFullBodyInFrame(landmarks);
    assert.equal(result.isReady, false);
    assert.ok(result.missingParts.includes('Feet / Ankles'));
  });

  it('relaxes feet requirement for floor/inverted poses when requireFeet=false', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    landmarks[27].visibility = 0.1;
    landmarks[28].visibility = 0.1;
    const result = checkFullBodyInFrame(landmarks, 0.45, { requireFeet: false, minRequiredParts: 5 });
    assert.equal(result.isReady, true);
  });

  it('guarantees floor poses (Downward Dog, Cobra) are not blocked when user is on mat', () => {
    // Only head and shoulders visible on mat (prone posture)
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
    landmarks[0].visibility = 0.8; // nose
    landmarks[11].visibility = 0.8; // left shoulder
    landmarks[12].visibility = 0.8; // right shoulder
    const result = checkFullBodyInFrame(landmarks, 0.3, { isFloorPose: true, requireFeet: false });
    assert.equal(result.isReady, true);
    assert.ok(result.message.includes('Floor pose ready'));
  });

  it('reports isReady=false for floor poses when no person is in camera view', () => {
    const result = checkFullBodyInFrame([], 0.3, { isFloorPose: true });
    assert.equal(result.isReady, false);
    assert.ok(result.message.includes('No person detected'));
  });
});

describe('Corrective Feedback Directions: generateJointInstruction', () => {
  it('tells user to bend when elbow is too straight (current > target)', () => {
    // Current is 170° (straight), target is 90° (bent)
    const hint = generateJointInstruction('LElbow', 170, 90);
    assert.ok(hint.toLowerCase().includes('bend'), `Expected 'bend', got: ${hint}`);
  });

  it('tells user to straighten when elbow is too bent (current < target)', () => {
    // Current is 70° (too bent), target is 170° (straight)
    const hint = generateJointInstruction('LElbow', 70, 170);
    assert.ok(hint.toLowerCase().includes('straighten'), `Expected 'straighten', got: ${hint}`);
  });

  it('tells user to bend when knee is too straight (current > target)', () => {
    // Current is 175° (straight leg in Warrior 2), target is 90° (front bent knee)
    const hint = generateJointInstruction('RKnee', 175, 90);
    assert.ok(hint.toLowerCase().includes('bend'), `Expected 'bend', got: ${hint}`);
  });

  it('tells user to straighten when knee is too bent (current < target)', () => {
    // Current is 120° (bent), target is 175° (standing leg in Tree)
    const hint = generateJointInstruction('LKnee', 120, 175);
    assert.ok(hint.toLowerCase().includes('straighten'), `Expected 'straighten', got: ${hint}`);
  });

  it('tells user to raise arms when shoulder angle is too low (current < target)', () => {
    // Current is 70° (arms at side), target is 165° (overhead in Tree)
    const hint = generateJointInstruction('LShoulder', 70, 165);
    assert.ok(hint.toLowerCase().includes('raise'), `Expected 'raise', got: ${hint}`);
  });
});

describe('Priority Hint Selection: getTopCorrectionHint', () => {
  it('prioritizes joint by error relative to tolerance (diff / tol), not raw degrees', () => {
    const simMap = {
      // Joint A: diff 30, tol 40 -> ratio 0.75
      LShoulder: { diff: 30, tol: 40, current: 80, target: 110, hasValue: true },
      // Joint B: diff 25, tol 10 -> ratio 2.5 (much more severe violation!)
      LKnee: { diff: 25, tol: 10, current: 150, target: 175, hasValue: true }
    };

    const topHint = getTopCorrectionHint(simMap, 1.0);
    assert.ok(topHint, 'Expected a top hint');
    assert.equal(topHint.jointKey, 'LKnee', 'Should prioritize LKnee due to higher diff/tol ratio');
    assert.equal(topHint.joint, 'LKnee', 'Must provide joint alias for backwards compatibility');
  });
});

describe('Hint Debouncer: HintDebouncer', () => {
  it('does not emit hint until candidate has persisted for persistenceMs', () => {
    const debouncer = new HintDebouncer(100, 500);
    const hint = { jointKey: 'LKnee', instruction: 'Bend knee' };

    // First frame
    const first = debouncer.update(hint);
    assert.equal(first, null, 'Should not emit immediately on first frame');
  });

  it('resets candidate and cooldown cleanly when clear() is invoked', () => {
    const debouncer = new HintDebouncer(50, 200);
    debouncer.candidateJoint = 'RKnee';
    debouncer.activeHint = { jointKey: 'RKnee' };
    debouncer.lastEmittedAt = Date.now();

    debouncer.clear();
    assert.equal(debouncer.candidateJoint, null);
    assert.equal(debouncer.activeHint, null);
    assert.equal(debouncer.lastEmittedAt, 0);
  });
});

describe('Score Classification: classifyScore', () => {
  it('classifies high scores as Masterful with accessible high-contrast colors', () => {
    const cls = classifyScore(92);
    assert.ok(cls.label.includes('Masterful'));
    assert.ok(cls.text, 'Has explicit text color');
    assert.ok(cls.bg, 'Has explicit background color');
  });
});

describe('Skeleton Overlay: drawPoseSkeleton', () => {
  it('gracefully handles canvas mock and flexible argument signatures', () => {
    const mockCtx = {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      translate: () => {},
      scale: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {}
    };

    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));

    // Signature A: (ctx, landmarks, simMap, width, height, mirror)
    assert.doesNotThrow(() => {
      drawPoseSkeleton(mockCtx, landmarks, {}, 640, 480, true);
    });

    // Signature B: (ctx, landmarks, width, height, simMap, mirror)
    assert.doesNotThrow(() => {
      drawPoseSkeleton(mockCtx, landmarks, 640, 480, {}, true);
    });

    // Empty landmarks
    assert.doesNotThrow(() => {
      drawPoseSkeleton(mockCtx, [], {}, 640, 480, true);
    });
  });
});
