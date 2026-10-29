// Natural language corrective feedback engine with correct anatomical directions,
// tolerance-normalized prioritization, and persistent debounce.

export const JOINT_NAMES = {
  LShoulder: 'Left Arm / Shoulder',
  RShoulder: 'Right Arm / Shoulder',
  LElbow: 'Left Elbow',
  RElbow: 'Right Elbow',
  LHip: 'Left Hip',
  RHip: 'Right Hip',
  LKnee: 'Left Knee',
  RKnee: 'Right Knee'
};

/**
 * Produces accurate, friendly guidance text based on anatomical joint angles.
 * Note on joint angles:
 * - Knees and Elbows: 180° is fully straight; smaller angles (~90°) mean bent.
 *   - If current > target: user is too straight -> "Bend your [joint] more"
 *   - If current < target: user is too bent -> "Straighten your [joint] more"
 * - Shoulders (overhead / lateral reach):
 *   - If current < target: arm is too low / collapsed -> "Raise your [arm] higher"
 *   - If current > target: arm is over-extended or too high -> "Lower your [arm] slightly"
 * - Hips:
 *   - If current > target: stance too shallow / hips too open -> "Bend deeper into your hips"
 *   - If current < target: hips collapsed too deep -> "Lift and open your hips slightly"
 */
export function generateJointInstruction(jointKey, currentAngle, targetAngle) {
  const isTooLarge = currentAngle > targetAngle;

  switch (jointKey) {
    case 'LElbow':
      return isTooLarge ? 'Bend your left elbow slightly' : 'Straighten your left arm more';
    case 'RElbow':
      return isTooLarge ? 'Bend your right elbow slightly' : 'Straighten your right arm more';

    case 'LKnee':
      return isTooLarge ? 'Bend your left knee deeper' : 'Straighten your left leg more';
    case 'RKnee':
      return isTooLarge ? 'Bend your right knee deeper' : 'Straighten your right leg more';

    case 'LShoulder':
      return isTooLarge ? 'Lower your left arm slightly' : 'Raise your left arm higher';
    case 'RShoulder':
      return isTooLarge ? 'Lower your right arm slightly' : 'Raise your right arm higher';

    case 'LHip':
      return isTooLarge ? 'Sink lower into your left hip' : 'Lift and square your left hip';
    case 'RHip':
      return isTooLarge ? 'Sink lower into your right hip' : 'Lift and square your right hip';

    default:
      return isTooLarge
        ? `Gently adjust your ${JOINT_NAMES[jointKey] || jointKey}`
        : `Extend your ${JOINT_NAMES[jointKey] || jointKey}`;
  }
}

/**
 * Evaluates the similarity map and selects the most critical correction needed,
 * prioritizing by (diff / tolerance) rather than raw degrees.
 */
export function getTopCorrectionHint(simMap, minimumSeverityRatio = 1.05) {
  if (!simMap) return null;

  let worstJoint = null;
  let maxErrorRatio = 0;

  for (const [key, data] of Object.entries(simMap)) {
    if (!data || !data.hasValue || data.current == null) continue;

    // Relative error ratio: how many times tolerance is exceeded
    const errorRatio = data.diff / Math.max(1, data.tol);

    if (errorRatio > maxErrorRatio) {
      maxErrorRatio = errorRatio;
      worstJoint = key;
    }
  }

  if (!worstJoint || maxErrorRatio < minimumSeverityRatio) {
    return null; // Pose is within acceptable tolerance!
  }

  const worstData = simMap[worstJoint];
  const instruction = generateJointInstruction(worstJoint, worstData.current, worstData.target);

  return {
    joint: worstJoint,
    jointKey: worstJoint,
    jointName: JOINT_NAMES[worstJoint] || worstJoint,
    instruction,
    degreesOff: Math.round(worstData.diff),
    severity: maxErrorRatio > 1.8 ? 'high' : 'medium',
    ratio: maxErrorRatio
  };
}

/**
 * Creates a debounced hint tracker that requires an error to persist
 * for at least `persistenceMs` (default 700ms) before emitting a hint,
 * preventing single-frame flickering.
 */
export class HintDebouncer {
  constructor(persistenceMs = 700, cooldownMs = 2200) {
    this.persistenceMs = persistenceMs;
    this.cooldownMs = cooldownMs;
    this.candidateJoint = null;
    this.candidateFirstSeenAt = 0;
    this.lastEmittedAt = 0;
    this.activeHint = null;
  }

  update(currentHint) {
    const now = Date.now();

    if (!currentHint) {
      this.candidateJoint = null;
      // Fade out hint if pose is corrected
      if (this.activeHint && now - this.lastEmittedAt > 1500) {
        this.activeHint = null;
      }
      return this.activeHint;
    }

    // If cooldown is active, continue showing active hint
    if (now - this.lastEmittedAt < this.cooldownMs) {
      return this.activeHint;
    }

    if (this.candidateJoint !== currentHint.jointKey) {
      // New candidate detected; start tracking persistence
      this.candidateJoint = currentHint.jointKey;
      this.candidateFirstSeenAt = now;
      return this.activeHint;
    }

    // Candidate has persisted
    if (now - this.candidateFirstSeenAt >= this.persistenceMs) {
      this.activeHint = currentHint;
      this.lastEmittedAt = now;
      this.candidateJoint = null; // Reset candidate
    }

    return this.activeHint;
  }

  clear() {
    this.candidateJoint = null;
    this.candidateFirstSeenAt = 0;
    this.lastEmittedAt = 0;
    this.activeHint = null;
  }
}
