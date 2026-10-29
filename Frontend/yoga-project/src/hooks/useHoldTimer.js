import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const targetDurationRef = useRef(targetHoldSeconds);
  targetDurationRef.current = targetHoldSeconds;

  const similarityThresholdRef = useRef(similarityThreshold);
  similarityThresholdRef.current = similarityThreshold;

  const passScoreThresholdRef = useRef(passScoreThreshold);
  passScoreThresholdRef.current = passScoreThreshold;

  const holdElapsedRef = useRef(0);

  // Statistics accumulators over the entire hold duration
  const similaritySamplesRef = useRef([]);
  const jointDiffAccRef = useRef({});
  const jointCountAccRef = useRef({});
  const completedPayloadRef = useRef(null);

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
    phaseRef.current = 'idle';
    setPhase('idle');
    setCountdownRemaining(countdownSeconds);
    setHoldElapsed(0);
    setIsCurrentlyInPose(false);
    setIsTabPaused(false);
    holdElapsedRef.current = 0;
    lastTimestampRef.current = null;
    similaritySamplesRef.current = [];
    jointDiffAccRef.current = {};
    jointCountAccRef.current = {};
    completedPayloadRef.current = null;
  }, [countdownSeconds]);

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
        lastTimestampRef.current = performance.now();
      }
    }, 1000);
  }, [countdownSeconds, reset]);

  // Update status and accumulate metrics
  const updatePoseStatus = useCallback((similarity, isBodyReady, simMap = {}, isMirrored = false) => {
    if (phaseRef.current !== 'holding') return;

    const meetsPose = isBodyReady && similarity >= similarityThresholdRef.current;
    setIsCurrentlyInPose(meetsPose);

    const now = performance.now();
    if (lastTimestampRef.current == null) {
      lastTimestampRef.current = now;
      return;
    }

    const deltaSeconds = (now - lastTimestampRef.current) / 1000;
    lastTimestampRef.current = now;

    // Only accumulate hold time and quality samples if actively in pose!
    if (meetsPose && deltaSeconds > 0 && deltaSeconds < 0.5) {
      holdElapsedRef.current += deltaSeconds;
      const currentElapsed = Math.min(targetDurationRef.current, holdElapsedRef.current);
      setHoldElapsed(currentElapsed);

      // Accumulate similarity and per-joint error during the hold
      similaritySamplesRef.current.push(similarity);
      for (const [jointKey, jointData] of Object.entries(simMap)) {
        if (jointData && jointData.hasValue) {
          jointDiffAccRef.current[jointKey] = (jointDiffAccRef.current[jointKey] || 0) + jointData.diff;
          jointCountAccRef.current[jointKey] = (jointCountAccRef.current[jointKey] || 0) + 1;
        }
      }

      if (currentElapsed >= targetDurationRef.current) {
        phaseRef.current = 'completed';
        setPhase('completed');

        // Calculate average similarity across all in-hold frames
        const samples = similaritySamplesRef.current;
        const avgSimilarity = samples.length > 0
          ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 100)
          : Math.round(similarity * 100);

        // Build accumulated per-joint error breakdown
        const accumulatedSimMap = {};
        for (const key of Object.keys(simMap)) {
          const totalDiff = jointDiffAccRef.current[key] || 0;
          const count = jointCountAccRef.current[key] || 1;
          const avgDiff = totalDiff / count;
          const template = simMap[key] || {};
          const tol = template.tol || 30;
          const score = Math.exp(-0.5 * Math.pow(avgDiff / tol, 2));

          accumulatedSimMap[key] = {
            ...template,
            diff: avgDiff,
            score,
            isGood: avgDiff <= tol,
            hasValue: count > 0
          };
        }

        const isPassed = avgSimilarity >= passScoreThresholdRef.current;

        const summary = {
          score: avgSimilarity,
          holdElapsed: currentElapsed,
          simMap: accumulatedSimMap,
          isMirrored,
          isPassed
        };

        completedPayloadRef.current = summary;
        if (onCompleteRef.current) {
          onCompleteRef.current(summary);
        }
      }
    }
  }, []);

  // Pause timing when browser tab loses focus / is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastTimestampRef.current = null;
        if (phaseRef.current === 'holding') {
          setIsTabPaused(true);
        }
      } else {
        lastTimestampRef.current = performance.now();
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
