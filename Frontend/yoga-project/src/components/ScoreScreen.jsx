import React, { useEffect, useState } from 'react';
import { classifyScore } from '../utils/poseUtils';

const JOINT_DISPLAY_NAMES = {
  LShoulder: 'Left Arm / Shoulder',
  RShoulder: 'Right Arm / Shoulder',
  LElbow: 'Left Elbow',
  RElbow: 'Right Elbow',
  LHip: 'Left Hip / Pelvis',
  RHip: 'Right Hip / Pelvis',
  LKnee: 'Left Knee',
  RKnee: 'Right Knee'
};

const ScoreScreen = ({
  levelData,
  levelIndex,
  totalLevels,
  resultData,
  onNextLevel,
  onRetryLevel,
  onExit
}) => {
  const hasData = Boolean(resultData && typeof resultData.score === 'number');
  const targetScore = hasData ? Math.min(100, Math.max(0, Math.round(resultData.score))) : 0;
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animated count-up honoring prefers-reduced-motion
  useEffect(() => {
    if (!hasData) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimatedScore(targetScore);
      return;
    }

    const duration = 1200;
    const startTime = performance.now();
    let animId;

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * targetScore));

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    }

    animId = requestAnimationFrame(animate);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [targetScore, hasData]);

  if (!hasData) {
    return (
      <div className="score-screen-container">
        <div className="score-card">
          <h2 className="score-title">No Practice Session Data</h2>
          <p className="score-assessment">No score recorded for this level. Please retry the practice run.</p>
          <div className="score-actions-row">
            <button className="btn btn-primary" onClick={onRetryLevel}>Retry Level</button>
            <button className="btn btn-ghost" onClick={onExit}>Practice Menu</button>
          </div>
        </div>
      </div>
    );
  }

  const classification = classifyScore(targetScore);
  const isPassed = Boolean(resultData.isPassed !== undefined ? resultData.isPassed : targetScore >= 60);
  const simMap = resultData.simMap || {};

  return (
    <div className="score-screen-container">
      <div className="score-card">
        <div className="score-header">
          <span className="score-subtitle">
            {isPassed ? `Level ${levelData.id} Passed` : `Level ${levelData.id} Needs Alignment`}
          </span>
          <h2 className="score-title">{levelData.name}</h2>
        </div>

        {/* Big Animated Score Display */}
        <div className="score-display-row">
          <div className="score-circle">
            <span className="score-num">{animatedScore}</span>
            <span className="score-percent">%</span>
          </div>

          <div className="score-badge-col">
            <div
              className="classification-badge"
              style={{
                backgroundColor: classification.bg,
                color: classification.text,
                border: `1.5px solid ${classification.color}`
              }}
            >
              <span className="badge-icon">★</span>
              <span>{classification.label}</span>
            </div>
            <p className="score-assessment">
              {isPassed
                ? 'Outstanding alignment! You satisfied both the posture threshold and hold duration.'
                : 'Good attempt! To unlock the next level, maintain average posture alignment above 60%.'}
            </p>
          </div>
        </div>

        {/* Per-Joint Alignment Breakdown (Cumulative over whole hold) */}
        <div className="breakdown-section">
          <h3 className="breakdown-title">Accumulated Joint Alignment</h3>
          <div className="breakdown-grid">
            {Object.entries(levelData.angles).map(([jointKey]) => {
              const jointData = simMap[jointKey];
              const jointHasValue = Boolean(jointData && jointData.hasValue);
              const diff = jointHasValue ? Math.round(jointData.diff) : null;
              const jointScore = jointHasValue ? Math.round(jointData.score * 100) : null;
              const name = JOINT_DISPLAY_NAMES[jointKey] || jointKey;

              let barColor = '#10b981'; // Green
              if (jointScore !== null) {
                if (jointScore < 60) barColor = '#ef4444'; // Red
                else if (jointScore < 80) barColor = '#f59e0b'; // Amber
              }

              return (
                <div key={jointKey} className="breakdown-item">
                  <div className="joint-info-row">
                    <span className="joint-name">{name}</span>
                    <span className="joint-deviation">
                      {jointHasValue ? `avg error: ~${diff}°` : 'Joint hidden / unverified'}
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: jointHasValue ? `${jointScore}%` : '0%',
                        backgroundColor: barColor
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions Hierarchy */}
        <div className="score-actions-row">
          {isPassed ? (
            <button className="btn btn-primary btn-large" onClick={onNextLevel}>
              <span>{levelIndex + 1 < totalLevels ? 'Next Level' : 'View Final Summary'}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          ) : (
            <button className="btn btn-primary btn-large" onClick={onRetryLevel}>
              <span>Try Again</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
            </button>
          )}

          {isPassed && (
            <button className="btn btn-secondary btn-large" onClick={onRetryLevel}>
              <span>Improve Score</span>
            </button>
          )}

          <button className="btn btn-ghost" onClick={onExit}>
            <span>Practice Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreScreen;
