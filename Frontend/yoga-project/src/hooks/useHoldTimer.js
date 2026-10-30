import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { computeHoldScore } from '../utils/storageUtils';

export function useHoldTimer({
  targetHoldSeconds = 30,
  countdownSeconds = 3,
  similarityThreshold = 0.65,
  passScoreThreshold = 60,
  onComplete
}) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'countdown' | 'holding' | 'completed'
  const [countdownRemaining, setCountdownRemaining] = useState(countdownSeconds);
  const [holdElapsed, setHoldElapsed] = useState(0);
  const [isCurrentlyInPose, setIsCurrentlyInPose] = useState(false);
  const [isTabPaused, setIsTabPaused] = useState(false);

  const phaseRef = useRef('idle');
  const lastTimestampRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const holdTickerRef = useRef(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const targetDurationRef = useRef(targetHoldSeconds);
  targetDurationRef.current = targetHoldSeconds;

  const similarityThresholdRef = useRef(similarityThreshold);
  similarityThresholdRef.current = similarityThreshold;

  const passScoreThresholdRef = useRef(passScoreThreshold);
  passScoreThresholdRef.current = passScoreThreshold;

  const holdElapsedRef = useRef(0);
  const totalHoldAttemptTimeRef = useRef(0);
  const isCurrentlyInPoseRef = useRef(false);
  const isTabPausedRef = useRef(false);
  const completedOnceRef = useRef(false);

  // Statistics accumulators over the entire hold duration
  // Samples every frame during active pose holding so scores reflect true performance
  const similaritySamplesRef = useRef([]);
  const jointDiffAccRef = useRef({});
  const jointCountAccRef = useRef({});
  const completedPayloadRef = useRef(null);
  const lastSimMapRef = useRef({});
  const lastIsMirroredRef = useRef(false);

  // Sync ref with phase state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Completely cancel any running timers and clear accumulators
  const reset = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (holdTickerRef.current) {
      clearInterval(holdTickerRef.current);
      holdTickerRef.current = null;
    }
    phaseRef.current = 'idle';
    setPhase('idle');
    setCountdownRemaining(countdownSeconds);
    setHoldElapsed(0);
    setIsCurrentlyInPose(false);
    setIsTabPaused(false);
    isCurrentlyInPoseRef.current = false;
    isTabPausedRef.current = false;
    completedOnceRef.current = false;
    holdElapsedRef.current = 0;
    totalHoldAttemptTimeRef.current = 0;
    lastTimestampRef.current = null;
    similaritySamplesRef.current = [];
    jointDiffAccRef.current = {};
    jointCountAccRef.current = {};
    completedPayloadRef.current = null;
    lastSimMapRef.current = {};
  }, [countdownSeconds]);

  // Complete level run and notify caller (guarded against multiple triggers)
  const finishRun = useCallback(() => {
    if (completedOnceRef.current) return;
    completedOnceRef.current = true;

    if (holdTickerRef.current) {
      clearInterval(holdTickerRef.current);
      holdTickerRef.current = null;
    }

    phaseRef.current = 'completed';
    setPhase('completed');

    // Fraction of total active hold session spent maintaining required pose
    const inPoseTime = holdElapsedRef.current;
    const totalTime = Math.max(inPoseTime, totalHoldAttemptTimeRef.current);
    const poseFraction = totalTime > 0 ? Math.min(1, inPoseTime / totalTime) : 1.0;

    // Calculate score = average similarity × fraction of hold time in pose
    const samples = similaritySamplesRef.current;
    const { score, isPassed } = computeHoldScore(samples, passScoreThresholdRef.current, poseFraction);

    // Build accumulated per-joint error breakdown
    const accumulatedSimMap = {};
    const baseMap = lastSimMapRef.current || {};
    for (const key of Object.keys(baseMap)) {
      const totalDiff = jointDiffAccRef.current[key] || 0;
      const count = jointCountAccRef.current[key] || 1;
      const avgDiff = totalDiff / count;
      const template = baseMap[key] || {};
      const tol = template.tol || 30;
      const jointScore = Math.exp(-0.5 * Math.pow(avgDiff / tol, 2));

      accumulatedSimMap[key] = {
        ...template,
        diff: avgDiff,
        score: jointScore,
        isGood: avgDiff <= tol,
        hasValue: count > 0
      };
    }

    const summary = {
      score,
      holdElapsed: targetDurationRef.current,
      totalAttemptSeconds: Math.round(totalTime * 10) / 10,
      poseFraction: Math.round(poseFraction * 100) / 100,
      simMap: accumulatedSimMap,
      isMirrored: lastIsMirroredRef.current,
      isPassed
    };

    completedPayloadRef.current = summary;
    if (onCompleteRef.current) {
      onCompleteRef.current(summary);
    }
  }, []);

  // Internal high-frequency hold timer loop (50ms interval, driven by performance.now())
  const startHoldLoop = useCallback(() => {
    if (holdTickerRef.current) {
      clearInterval(holdTickerRef.current);
    }
    lastTimestampRef.current = performance.now();

    holdTickerRef.current = setInterval(() => {
      if (phaseRef.current !== 'holding') return;
      if (isTabPausedRef.current) {
        lastTimestampRef.current = performance.now();
        return;
      }

      const now = performance.now();
      const deltaSeconds = (now - (lastTimestampRef.current || now)) / 1000;
      lastTimestampRef.current = now;

      if (deltaSeconds > 0 && deltaSeconds < 1.0) {
        // Track total wall time in holding phase
        totalHoldAttemptTimeRef.current += deltaSeconds;

        // Advance hold elapsed time ONLY when user is actively in pose and framed
        if (isCurrentlyInPoseRef.current) {
          holdElapsedRef.current += deltaSeconds;
          const currentElapsed = Math.min(targetDurationRef.current, holdElapsedRef.current);
          setHoldElapsed(currentElapsed);

          if (currentElapsed >= targetDurationRef.current) {
            finishRun();
          }
        }
      }
    }, 50);
  }, [finishRun]);

  // Start the 3-second countdown followed by continuous hold session
  const startRun = useCallback(() => {
    reset();

    setPhase('countdown');
    phaseRef.current = 'countdown';
    let count = countdownSeconds;
    setCountdownRemaining(count);

    countdownIntervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownRemaining(count);
      } else {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;

        // Transition to holding phase
        setPhase('holding');
        phaseRef.current = 'holding';
        startHoldLoop();
      }
    }, 1000);
  }, [countdownSeconds, reset, startHoldLoop]);

  // Update status and accumulate metrics across every frame
  const updatePoseStatus = useCallback((similarity, isBodyReady, simMap = {}, isMirrored = false) => {
    if (phaseRef.current !== 'holding') return;

    const meetsPose = Boolean(isBodyReady && similarity >= similarityThresholdRef.current);
    isCurrentlyInPoseRef.current = meetsPose;
    setIsCurrentlyInPose(meetsPose);

    lastSimMapRef.current = simMap;
    lastIsMirroredRef.current = isMirrored;

    // Sample frames while actively holding the pose so the final score reflects true posture alignment
    if (meetsPose) {
      similaritySamplesRef.current.push(similarity);

      for (const [jointKey, jointData] of Object.entries(simMap)) {
        if (jointData && jointData.hasValue) {
          jointDiffAccRef.current[jointKey] = (jointDiffAccRef.current[jointKey] || 0) + jointData.diff;
          jointCountAccRef.current[jointKey] = (jointCountAccRef.current[jointKey] || 0) + 1;
        }
      }
    }
  }, []);

  // Pause timing when browser tab loses focus / is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isTabPausedRef.current = true;
        setIsTabPaused(true);
      } else {
        lastTimestampRef.current = performance.now();
        isTabPausedRef.current = false;
        setIsTabPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reset();
    };
  }, [reset]);

  const holdProgressPct = Math.min(
    100,
    Math.round((holdElapsed / Math.max(1, targetHoldSeconds)) * 100)
  );

  const secondsRemaining = Math.max(0, Math.ceil(targetHoldSeconds - holdElapsed));

  return useMemo(() => ({
    phase,
    countdownRemaining,
    holdElapsed: Math.round(holdElapsed * 10) / 10,
    holdProgressPct,
    secondsRemaining,
    isCurrentlyInPose,
    isTabPaused,
    completedPayloadRef,
    startRun,
    reset,
    updatePoseStatus
  }), [
    phase,
    countdownRemaining,
    holdElapsed,
    holdProgressPct,
    secondsRemaining,
    isCurrentlyInPose,
    isTabPaused,
    startRun,
    reset,
    updatePoseStatus
  ]);
}
