// Modern, mathematically sound pose geometry, visibility filtering,
// aspect-ratio-corrected angle calculation, side-mirror support, and skeleton rendering.

export const POSE_LANDMARK_INDEXES = {
  nose: 0,
  left_eye: 2,
  right_eye: 5,
  left_ear: 7,
  right_ear: 8,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
  left_heel: 29,
  right_heel: 30,
  left_foot_index: 31,
  right_foot_index: 32
};

export const SKELETON_CONNECTIONS = [
  // Torso
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  // Left arm
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  // Right arm
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  // Left leg
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  // Right leg
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle']
];

/**
 * Computes 2D Euclidean angle at vertex b between vectors (a - b) and (c - b)
 * Returns degrees between 0 and 180.
 */
export function angleBetween2D(a, b, c) {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);

  if (mag1 < 1e-5 || mag2 < 1e-5) return null;

  let cosVal = dot / (mag1 * mag2);
  cosVal = Math.max(-1, Math.min(1, cosVal));
  return (Math.acos(cosVal) * 180) / Math.PI;
}

/**
 * Extracts and maps landmarks with aspect-ratio correction into pixel space.
 * Prevents angular distortion caused by normalized non-square camera frames.
 */
export function mapLandmarks(landmarks, width = 640, height = 480, minVisibility = 0.45) {
  if (!landmarks || landmarks.length === 0) return {};

  const map = {};
  for (const [name, index] of Object.entries(POSE_LANDMARK_INDEXES)) {
    const lm = landmarks[index];
    if (lm) {
      const vis = lm.visibility !== undefined ? lm.visibility : 1.0;
      if (vis >= minVisibility) {
        map[name] = {
          x: lm.x * width,
          y: lm.y * height,
          rawX: lm.x,
          rawY: lm.y,
          z: lm.z || 0,
          visibility: vis
        };
      } else {
        map[name] = null;
      }
    } else {
      map[name] = null;
    }
  }
  return map;
}

/**
 * Validates that user's full body (head, shoulders, hips, knees, ankles) is visible.
 * Intelligent floor-pose relaxation prevents blocking Begin on Downward Dog and Cobra.
 */
export function checkFullBodyInFrame(landmarks, minVisibility = 0.45, options = {}) {
  const { requireFeet = true, minRequiredParts = 7, isFloorPose = false } = options;

  if (!landmarks || landmarks.length === 0) {
    return {
      isReady: false,
      message: "No person detected. Please step into the camera view.",
      visibleCount: 0,
      totalRequired: isFloorPose ? 2 : 8,
      missingParts: ['Body']
    };
  }

  const checkKeys = [
    { key: [POSE_LANDMARK_INDEXES.nose, POSE_LANDMARK_INDEXES.left_eye, POSE_LANDMARK_INDEXES.right_eye], name: 'Head' },
    { key: [POSE_LANDMARK_INDEXES.left_shoulder], name: 'Left Shoulder' },
    { key: [POSE_LANDMARK_INDEXES.right_shoulder], name: 'Right Shoulder' },
    { key: [POSE_LANDMARK_INDEXES.left_hip], name: 'Left Hip' },
    { key: [POSE_LANDMARK_INDEXES.right_hip], name: 'Right Hip' },
    { key: [POSE_LANDMARK_INDEXES.left_knee], name: 'Left Knee' },
    { key: [POSE_LANDMARK_INDEXES.right_knee], name: 'Right Knee' },
    { key: [POSE_LANDMARK_INDEXES.left_ankle, POSE_LANDMARK_INDEXES.right_ankle], name: 'Feet / Ankles' }
  ];

  let visibleCount = 0;
  const missingParts = [];

  for (const item of checkKeys) {
    const found = item.key.some(idx => {
      const lm = landmarks[idx];
      // Check both visibility threshold AND bounds inside [0, 1] camera frame
      const isVisible = lm && (lm.visibility === undefined || lm.visibility >= minVisibility);
      const isWithinBounds = lm && lm.x >= 0 && lm.x <= 1 && lm.y >= 0 && lm.y <= 1;
      return isVisible && isWithinBounds;
    });

    if (found) {
      visibleCount++;
    } else {
      missingParts.push(item.name);
    }
  }

  // Floor and inverted poses (Downward Dog, Cobra) have prone/inverted angles where
  // lower limbs are frequently occluded against the mat or foreshortened. Relax gate to prevent blocking Begin.
  if (isFloorPose) {
    const floorThreshold = Math.min(2, minRequiredParts);
    const isReady = visibleCount >= floorThreshold;
    return {
      isReady,
      message: isReady
        ? "Floor pose ready! Position yourself on your mat."
        : "Please position yourself on your mat within camera view.",
      visibleCount,
      totalRequired: floorThreshold,
      missingParts: isReady ? [] : missingParts
    };
  }

  const hasFeet = !missingParts.includes('Feet / Ankles');
  const feetSatisfied = requireFeet ? hasFeet : true;
  const threshold = Math.min(minRequiredParts, checkKeys.length);
  const isReady = visibleCount >= threshold && feetSatisfied;

  let message = "Perfect! Your full body is in frame.";
  if (!isReady) {
    if (requireFeet && missingParts.includes('Feet / Ankles')) {
      message = "Step back until your feet and mat are visible.";
    } else if (missingParts.includes('Head')) {
      message = "Adjust your camera so your head is visible.";
    } else {
      message = `Please step back: ${missingParts.slice(0, 2).join(', ')} not in view.`;
    }
  }

  return { isReady, message, visibleCount, totalRequired: threshold, missingParts };
}

/**
 * Calculates all anatomical joint angles using aspect-ratio corrected coordinates.
 */
export function calculatePoseAngles(landmarks, width = 640, height = 480) {
  const L = mapLandmarks(landmarks, width, height);
  const angles = {};

  try {
    // Shoulder angles: angle between hip - shoulder - elbow
    if (L.left_hip && L.left_shoulder && L.left_elbow) {
      angles.LShoulder = angleBetween2D(L.left_hip, L.left_shoulder, L.left_elbow);
    }
    if (L.right_hip && L.right_shoulder && L.right_elbow) {
      angles.RShoulder = angleBetween2D(L.right_hip, L.right_shoulder, L.right_elbow);
    }

    // Elbow angles: angle between shoulder - elbow - wrist
    if (L.left_shoulder && L.left_elbow && L.left_wrist) {
      angles.LElbow = angleBetween2D(L.left_shoulder, L.left_elbow, L.left_wrist);
    }
    if (L.right_shoulder && L.right_elbow && L.right_wrist) {
      angles.RElbow = angleBetween2D(L.right_shoulder, L.right_elbow, L.right_wrist);
    }

    // Hip angles: angle between shoulder - hip - knee
    if (L.left_shoulder && L.left_hip && L.left_knee) {
      angles.LHip = angleBetween2D(L.left_shoulder, L.left_hip, L.left_knee);
    }
    if (L.right_shoulder && L.right_hip && L.right_knee) {
      angles.RHip = angleBetween2D(L.right_shoulder, L.right_hip, L.right_knee);
    }

    // Knee angles: angle between hip - knee - ankle
    if (L.left_hip && L.left_knee && L.left_ankle) {
      angles.LKnee = angleBetween2D(L.left_hip, L.left_knee, L.left_ankle);
    }
    if (L.right_hip && L.right_knee && L.right_ankle) {
      angles.RKnee = angleBetween2D(L.right_hip, L.right_knee, L.right_ankle);
    }
  } catch (err) {
    console.warn("Angle computation exception:", err);
  }

  return angles;
}

/**
 * Computes similarity against a specific target angle set using smooth Gaussian scoring.
 */
function scoreAgainstAngleSet(detectedAngles, targetAngles, tolerances, weights, difficulty = 1.0) {
  const map = {};
  let totalWeight = 0;
  let weightedScore = 0;
  let validJointCount = 0;
  const targetKeys = Object.keys(targetAngles);

  for (const key of targetKeys) {
    const target = targetAngles[key];
    const tol = (tolerances[key] || 30) * difficulty;
    const weight = weights[key] || 1.0;
    const current = detectedAngles[key];

    if (typeof current === 'number' && !isNaN(current)) {
      const diff = Math.abs(current - target);
      // Smooth Gaussian similarity: 1.0 at diff=0, ~0.61 at diff=tol
      const score = Math.exp(-0.5 * Math.pow(diff / tol, 2));
      const isGood = diff <= tol;

      map[key] = {
        diff,
        score,
        target,
        current,
        tol,
        weight,
        isGood,
        hasValue: true
      };
      weightedScore += score * weight;
      totalWeight += weight;
      validJointCount++;
    } else {
      map[key] = {
        diff: 180,
        score: 0,
        target,
        current: null,
        tol,
        weight,
        isGood: false,
        hasValue: false
      };
      // For unseen joints, we only lightly penalize if enough joints are visible
    }
  }

  // Minimum visible joints threshold (at least 50% of defined joints, bounded by total defined)
  const minRequiredJoints = Math.min(targetKeys.length, Math.max(1, Math.floor(targetKeys.length * 0.5)));
  let overall = 0;

  if (validJointCount >= minRequiredJoints && totalWeight > 0) {
    overall = weightedScore / totalWeight;
    // Coverage ratio scaling if some joints are hidden
    const coverage = validJointCount / targetKeys.length;
    if (coverage < 0.8) {
      overall *= (0.7 + 0.3 * coverage);
    }
  }

  return { map, overall, validJointCount, totalJoints: targetKeys.length };
}

/**
 * Compares detected angles with level specifications.
 * Supports automatic side detection by comparing against primary and mirrored poses!
 */
export function computePoseSimilarity(detectedAngles, levelRef, difficulty = 1.0) {
  if (!detectedAngles || !levelRef) {
    return { overall: 0, map: {}, isMirrored: false, validJointCount: 0 };
  }

  const primaryResult = scoreAgainstAngleSet(
    detectedAngles,
    levelRef.angles,
    levelRef.tolerances || {},
    levelRef.weights || {},
    difficulty
  );

  if (levelRef.mirroredAngles) {
    const mirroredResult = scoreAgainstAngleSet(
      detectedAngles,
      levelRef.mirroredAngles,
      levelRef.tolerances || {},
      levelRef.weights || {},
      difficulty
    );

    // Pick whichever side performs better
    if (mirroredResult.overall > primaryResult.overall) {
      return {
        ...mirroredResult,
        isMirrored: true
      };
    }
  }

  return {
    ...primaryResult,
    isMirrored: false
  };
}

/**
 * Classification score levels with high contrast, accessible colors.
 */
export function classifyScore(percent) {
  if (percent >= 88) {
    return { label: 'Masterful Posture', color: '#047857', badge: 'Master', bg: '#d1fae5', text: '#064e3b' };
  }
  if (percent >= 72) {
    return { label: 'Great Flow', color: '#059669', badge: 'Great', bg: '#ecfdf5', text: '#065f46' };
  }
  if (percent >= 55) {
    return { label: 'Steady Alignment', color: '#d97706', badge: 'Steady', bg: '#fef3c7', text: '#92400e' };
  }
  return { label: 'Keep Practicing', color: '#dc2626', badge: 'Improving', bg: '#fee2e2', text: '#991b1b' };
}

/**
 * Renders an optimized skeleton overlay with color-coded joints.
 * Only draws major body landmarks and lines.
 * Robustly accepts either:
 * - drawPoseSkeleton(canvas/ctx, landmarks, simMap, width, height, mirror)
 * - drawPoseSkeleton(canvas/ctx, landmarks, width, height, simMap, mirror)
 */
export function drawPoseSkeleton(target, landmarks, ...rest) {
  if (!target) return;
  const ctx = target.getContext ? target.getContext('2d') : target;
  if (!ctx || !ctx.save) return;

  let simMap = {};
  let width = 640;
  let height = 480;
  let mirror = true;

  if (typeof rest[0] === 'object' && rest[0] !== null) {
    simMap = rest[0];
    width = typeof rest[1] === 'number' ? rest[1] : 640;
    height = typeof rest[2] === 'number' ? rest[2] : 480;
    mirror = rest[3] !== undefined ? Boolean(rest[3]) : true;
  } else if (typeof rest[0] === 'number') {
    width = rest[0];
    height = typeof rest[1] === 'number' ? rest[1] : 480;
    simMap = typeof rest[2] === 'object' && rest[2] !== null ? rest[2] : {};
    mirror = rest[3] !== undefined ? Boolean(rest[3]) : true;
  }

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length === 0) {
    ctx.restore();
    return;
  }

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  // Draw Connections
  for (const [p1Name, p2Name] of SKELETON_CONNECTIONS) {
    const idx1 = POSE_LANDMARK_INDEXES[p1Name];
    const idx2 = POSE_LANDMARK_INDEXES[p2Name];
    const lm1 = landmarks[idx1];
    const lm2 = landmarks[idx2];

    if (!lm1 || !lm2) continue;
    const vis1 = lm1.visibility !== undefined ? lm1.visibility : 1;
    const vis2 = lm2.visibility !== undefined ? lm2.visibility : 1;
    if (vis1 < 0.35 || vis2 < 0.35) continue;

    const x1 = lm1.x * width;
    const y1 = lm1.y * height;
    const x2 = lm2.x * width;
    const y2 = lm2.y * height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)'; // Warm jade green
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Map landmarks for key joints to color code them based on accuracy
  const jointLandmarkMapping = {
    LShoulder: POSE_LANDMARK_INDEXES.left_shoulder,
    RShoulder: POSE_LANDMARK_INDEXES.right_shoulder,
    LElbow: POSE_LANDMARK_INDEXES.left_elbow,
    RElbow: POSE_LANDMARK_INDEXES.right_elbow,
    LHip: POSE_LANDMARK_INDEXES.left_hip,
    RHip: POSE_LANDMARK_INDEXES.right_hip,
    LKnee: POSE_LANDMARK_INDEXES.left_knee,
    RKnee: POSE_LANDMARK_INDEXES.right_knee
  };

  for (const [jointKey, lmIdx] of Object.entries(jointLandmarkMapping)) {
    const lm = landmarks[lmIdx];
    if (!lm) continue;
    const vis = lm.visibility !== undefined ? lm.visibility : 1;
    if (vis < 0.35) continue;

    const x = lm.x * width;
    const y = lm.y * height;
    const jointInfo = simMap[jointKey];

    let fillColor = '#10b981'; // Green (aligned)
    let strokeColor = '#ffffff';

    if (jointInfo && jointInfo.hasValue) {
      if (jointInfo.diff > jointInfo.tol * 1.5) {
        fillColor = '#ef4444'; // Red (off by a lot)
      } else if (jointInfo.diff > jointInfo.tol) {
        fillColor = '#f59e0b'; // Amber (slightly off)
      }
    }

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  ctx.restore();
}
