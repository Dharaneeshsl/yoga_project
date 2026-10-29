import React, { useRef, useEffect, useState, useMemo, memo } from 'react';
import { drawPoseSkeleton, computePoseSimilarity } from '../utils/poseUtils';
import { getTopCorrectionHint, HintDebouncer } from '../utils/poseFeedback';
import { playCountdownTick, playSuccessChime } from '../utils/soundEffects';

// Memoized Checklist Component for optimal performance
const ChecklistTab = memo(function ChecklistTab({ checklist = [], simMap = {}, isMirrored = false }) {
  return (
    <div className="checklist-list">
      {checklist.map(item => {
        // Accurate side-aware joint lookup
        const targetJoint = isMirrored
          ? (item.mirroredJoint || item.primaryJoint)
          : (item.primaryJoint || item.mirroredJoint);

        const isChecked = targetJoint
          ? Boolean(simMap[targetJoint]?.isGood)
          : Boolean(item.primaryJoints?.some(j => simMap[j]?.isGood));

        return (
          <div key={item.id} className={`checklist-item ${isChecked ? 'checked' : 'pending'}`}>
            <div className="check-box" aria-hidden="true">
              {isChecked ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <span className="empty-check"></span>
              )}
            </div>
            <span className="checklist-text">{item.text}</span>
          </div>
        );
      })}
    </div>
  );
});

// Memoized Reference Info Panel
const ReferenceGuideTab = memo(function ReferenceGuideTab({ levelData }) {
  return (
    <div className="guide-content">
      <h4 className="guide-subtitle">Step-by-Step Execution:</h4>
      <ol className="steps-list">
        {levelData.steps?.map((step, idx) => (
          <li key={idx} className="step-list-item">{step}</li>
        ))}
      </ol>

      <h4 className="guide-subtitle mistakes-header">Common Mistakes to Avoid:</h4>
      <ul className="mistakes-list">
        {levelData.commonMistakes?.map((mistake, idx) => (
          <li key={idx} className="mistake-item">{mistake}</li>
        ))}
      </ul>
    </div>
  );
});

const LevelScreen = ({
  levelData,
  totalLevels,
  camera,
  landmarker,
  holdTimer,
  settings,
  onFinishLevel,
  onExit,
  voice
}) => {
  const canvasRef = useRef(null);
  const debouncerRef = useRef(new HintDebouncer(650, 2200));
  const hasAnnouncedHoldRef = useRef(false);
  const hasAnnouncedCompleteRef = useRef(false);
  const completedOnceRef = useRef(false);

  const [activeHint, setActiveHint] = useState(null);
  const [activeTab, setActiveTab] = useState('checklist'); // 'checklist' | 'guide' | 'benefits'

  const { attachVideo, isActive: isCameraActive, isLoading: isCameraLoading, error: cameraError, startCamera } = camera;
  const { detectedAngles, bodyCheck, isModelLoading, modelProgress, modelError, setOnFrameCallback } = landmarker;
  const {
    phase,
    countdownRemaining,
    holdElapsed,
    holdProgressPct,
    secondsRemaining,
    isCurrentlyInPose,
    isTabPaused,
    completedPayloadRef,
    startRun,
    reset,
    updatePoseStatus
  } = holdTimer;

  // Reset hint debouncer and completion guards when level changes
  useEffect(() => {
    debouncerRef.current.clear();
    hasAnnouncedHoldRef.current = false;
    hasAnnouncedCompleteRef.current = false;
    completedOnceRef.current = false;
    setActiveHint(null);
  }, [levelData.id]);

  // Compute live similarity against target pose
  const simResult = useMemo(() => {
    return computePoseSimilarity(
      detectedAngles,
      levelData,
      settings.difficultyMultiplier || 1.0
    );
  }, [detectedAngles, levelData, settings.difficultyMultiplier]);

  const liveSimilarityPct = Math.round(simResult.overall * 100);

  // Update hold timer each time pose similarity or frame check updates
  useEffect(() => {
    if (phase === 'holding') {
      updatePoseStatus(simResult.overall, bodyCheck.isReady, simResult.map, simResult.isMirrored);
    }
  }, [simResult.overall, simResult.map, simResult.isMirrored, bodyCheck.isReady, phase, updatePoseStatus]);

  // Handle corrective hints debouncing (throttled at ~5 Hz)
  useEffect(() => {
    if (phase === 'holding') {
      const topHint = getTopCorrectionHint(simResult.map);
      const debounced = debouncerRef.current.update(topHint);
      setActiveHint(debounced);

      if (debounced && settings.voiceEnabled) {
        voice.speak(debounced.instruction);
      }
    } else {
      debouncerRef.current.clear();
      setActiveHint(null);
    }
  }, [simResult.map, phase, settings.voiceEnabled, voice]);

  // Voice & audio cues during phase transitions (fires exactly once per transition)
  useEffect(() => {
    if (phase === 'countdown') {
      hasAnnouncedHoldRef.current = false;
      hasAnnouncedCompleteRef.current = false;
      if (countdownRemaining > 0) {
        if (settings.voiceEnabled) {
          playCountdownTick();
          voice.speak(String(countdownRemaining), true);
        }
      }
    } else if (phase === 'holding') {
      if (!hasAnnouncedHoldRef.current) {
        hasAnnouncedHoldRef.current = true;
        if (settings.voiceEnabled) {
          voice.speak('Hold the pose now!', true);
        }
      }
    } else if (phase === 'completed') {
      if (!hasAnnouncedCompleteRef.current) {
        hasAnnouncedCompleteRef.current = true;
        if (settings.voiceEnabled) {
          playSuccessChime();
          voice.speak('Pose complete! Great work!', true);
        }
      }
    } else {
      hasAnnouncedHoldRef.current = false;
      hasAnnouncedCompleteRef.current = false;
    }
  }, [phase, countdownRemaining, voice, settings.voiceEnabled]);

  // Level completion handler: triggered reliably once without simResult race condition
  useEffect(() => {
    if (phase === 'completed' && !completedOnceRef.current) {
      completedOnceRef.current = true;
      const finalPayload = completedPayloadRef.current || {
        score: liveSimilarityPct,
        holdElapsed,
        simMap: simResult.map,
        isMirrored: simResult.isMirrored,
        isPassed: liveSimilarityPct >= 60
      };

      const timer = setTimeout(() => {
        onFinishLevel(finalPayload);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [phase, onFinishLevel, completedPayloadRef, liveSimilarityPct, holdElapsed, simResult]);

  // High-FPS Direct Canvas Drawing: subscribes directly to PoseLandmarker frame pipeline
  useEffect(() => {
    setOnFrameCallback(({ landmarks, videoWidth, videoHeight }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }

      const ctx = canvas.getContext('2d');
      drawPoseSkeleton(
        ctx,
        landmarks,
        simResult.map,
        videoWidth,
        videoHeight,
        settings.mirrorView !== false
      );
    });

    return () => {
      setOnFrameCallback(null);
    };
  }, [simResult.map, settings.mirrorView, setOnFrameCallback]);

  // SVG circular progress calculation
  const circleRadius = 38;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (holdProgressPct / 100) * circumference;

  return (
    <div className="level-screen-container">
      {/* Top Navigation Bar */}
      <div className="level-top-bar">
        <button className="btn btn-ghost btn-sm" onClick={onExit} aria-label="Exit practice to menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Exit Flow</span>
        </button>

        <div className="level-badge-header">
          <span className="level-tag">Level {levelData.id} of {totalLevels}</span>
          <h2 className="level-title-text">{levelData.name}</h2>
        </div>

        <div className="top-bar-controls">
          <span className={`pill-status ${bodyCheck.isReady ? 'status-ready' : 'status-pending'}`}>
            <span className="status-dot"></span>
            <span>{bodyCheck.isReady ? 'Full Body in Frame' : 'Step Back to Frame'}</span>
          </span>
        </div>
      </div>

      {/* Main Practice Workspace (2 columns on desktop) */}
      <div className="level-workspace-grid">
        {/* Left Column: Live Camera & Skeleton */}
        <div className="viewport-card">
          <div className="viewport-header">
            <div className="viewport-title-group">
              <span className="card-title">Live Posture Mirror</span>
              {simResult.isMirrored && (
                <span className="side-chip">Mirror Side Detected</span>
              )}
            </div>

            <div className="metrics-group">
              {/* Similarity Pill */}
              <div className="metric-pill">
                <span className="metric-label">Match</span>
                <span className="metric-val">{isCameraActive ? `${liveSimilarityPct}%` : '—'}</span>
              </div>

              {/* Circular Hold Progress */}
              <div className="circular-progress-wrap" title={`Hold progress: ${holdProgressPct}%`}>
                <svg className="progress-ring" width="54" height="54">
                  <circle
                    className="progress-ring-bg"
                    stroke="#e2e8f0"
                    strokeWidth="5"
                    fill="transparent"
                    r={circleRadius}
                    cx="27"
                    cy="27"
                  />
                  <circle
                    className="progress-ring-circle"
                    stroke={isCurrentlyInPose ? '#10b981' : '#f59e0b'}
                    strokeWidth="5"
                    strokeDasharray={`${circumference} ${circumference}`}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={circleRadius}
                    cx="27"
                    cy="27"
                  />
                </svg>
                <div className="progress-ring-text">
                  {phase === 'holding' ? `${secondsRemaining}s` : `${settings.holdDuration}s`}
                </div>
              </div>
            </div>
          </div>

          {/* Media Viewport Container */}
          <div className="media-viewport">
            {/* Native Video Feed */}
            <video
              ref={attachVideo}
              className={`live-video ${settings.mirrorView !== false ? 'mirrored' : ''}`}
              autoPlay
              playsInline
              muted
            />

            {/* AI Skeleton Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className={`skeleton-canvas ${settings.mirrorView !== false ? 'mirrored' : ''}`}
            />

            {/* Pre-Flight Silhouette Guide Overlay */}
            {!bodyCheck.isReady && isCameraActive && (
              <div className="framing-guide-overlay">
                <div className="body-silhouette-guide"></div>
                <div className="framing-guide-text" role="status">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{bodyCheck.message}</span>
                </div>
              </div>
            )}

            {/* Tab Pause Overlay */}
            {isTabPaused && phase === 'holding' && (
              <div className="paused-overlay">
                <div className="paused-card">
                  <h3>Practice Paused</h3>
                  <p>Switch back to this window to resume your hold timer.</p>
                </div>
              </div>
            )}

            {/* Countdown Overlay with ARIA Live */}
            {phase === 'countdown' && (
              <div className="countdown-overlay" aria-live="polite">
                <div className="countdown-number">{countdownRemaining}</div>
                <div className="countdown-label">Get Ready to Hold...</div>
              </div>
            )}

            {/* Real-Time Alignment Guidance Banner with ARIA Live */}
            {activeHint && phase === 'holding' && (
              <div className={`guidance-banner ${activeHint.severity}`} aria-live="polite">
                <div className="guidance-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </div>
                <div className="guidance-content">
                  <div className="guidance-text">{activeHint.instruction}</div>
                  <div className="guidance-sub">Adjusting {activeHint.jointName} (off by ~{activeHint.degreesOff}°)</div>
                </div>
              </div>
            )}

            {/* Camera Permission / Device Error Overlay */}
            {cameraError && (
              <div className="error-overlay" role="alert">
                <div className="error-card">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                  <h3>Camera Access Required</h3>
                  <p>{cameraError.message}</p>
                  <button className="btn btn-primary" onClick={() => startCamera()}>
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Model Loading State */}
            {isModelLoading && (
              <div className="loading-overlay" aria-live="polite">
                <div className="spinner"></div>
                <p>{modelProgress}</p>
              </div>
            )}

            {/* Model Error */}
            {modelError && (
              <div className="error-overlay" role="alert">
                <div className="error-card">
                  <h3>Model Engine Error</h3>
                  <p>{modelError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Controls Bar */}
          <div className="viewport-actions-bar">
            {!isCameraActive ? (
              <button
                className="btn btn-primary btn-large btn-full"
                onClick={() => startCamera()}
                disabled={isCameraLoading || isModelLoading}
              >
                {isCameraLoading ? 'Starting Camera...' : 'Start Camera'}
              </button>
            ) : (
              <div className="action-buttons-group">
                {phase === 'idle' ? (
                  <button
                    className="btn btn-primary btn-large"
                    onClick={startRun}
                    disabled={!bodyCheck.isReady}
                  >
                    <span>Begin Hold ({settings.holdDuration}s)</span>
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={reset}>
                    <span>Reset Timer</span>
                  </button>
                )}

                <div className="status-indicator-box">
                  {phase === 'holding' ? (
                    <span className={`status-pill ${isCurrentlyInPose ? 'in-pose' : 'out-pose'}`}>
                      {isCurrentlyInPose ? 'Holding Pose! Maintain...' : 'Re-align to continue timer'}
                    </span>
                  ) : phase === 'countdown' ? (
                    <span className="status-pill countdown">Get into posture</span>
                  ) : (
                    <span className="status-pill ready">
                      {bodyCheck.isReady ? 'Ready! Press Begin' : 'Step back to frame body'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Reference Pose, Alignment Checklist, and Guide */}
        <div className="reference-card">
          <div className="reference-header">
            <div>
              <span className="card-subtitle">{levelData.sanskritName || levelData.category}</span>
              <h3 className="reference-title">{levelData.name}</h3>
            </div>
            <div className="tab-pill-group" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'checklist'}
                className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
                onClick={() => setActiveTab('checklist')}
              >
                Checklist
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'guide'}
                className={`tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
                onClick={() => setActiveTab('guide')}
              >
                How-To
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'benefits'}
                className={`tab-btn ${activeTab === 'benefits' ? 'active' : ''}`}
                onClick={() => setActiveTab('benefits')}
              >
                Benefits
              </button>
            </div>
          </div>

          {/* Pose Illustration Image */}
          <div className="reference-illustration-wrap">
            <img
              src={levelData.image}
              alt={levelData.name}
              className="reference-image"
              loading="eager"
            />
            {levelData.cameraTip && (
              <div className="camera-tip-callout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <span><strong>Setup Tip:</strong> {levelData.cameraTip}</span>
              </div>
            )}
          </div>

          {/* Tab Content Area */}
          <div className="tab-content-area">
            {activeTab === 'checklist' && (
              <ChecklistTab
                checklist={levelData.checklist}
                simMap={simResult.map}
                isMirrored={simResult.isMirrored}
              />
            )}

            {activeTab === 'guide' && (
              <ReferenceGuideTab levelData={levelData} />
            )}

            {activeTab === 'benefits' && (
              <div className="benefits-content">
                <p className="pose-description">{levelData.desc}</p>
                <h4 className="guide-subtitle">Key Physiological Benefits:</h4>
                <ul className="benefits-list">
                  {levelData.benefits?.map((benefit, idx) => (
                    <li key={idx} className="benefit-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LevelScreen);
