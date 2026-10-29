import React from 'react';
import { LEVELS } from '../data/levels';

const Landing = ({
  onStart,
  onSelectLevel,
  unlockedLevels = 1,
  savedScores = {},
  onOpenSettings
}) => {
  const appName = import.meta.env.VITE_APP_NAME || 'PoseYoga';

  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="badge-dot"></span>
          <span>{appName} — Browser AI Yoga Assistant</span>
        </div>

        <h1 className="hero-title">
          Master Your Flow with Real-Time Pose Guidance
        </h1>

        <p className="hero-subtitle">
          Intelligent yoga practice right in your browser. Real-time joint tracking,
          anatomical angle analysis, and continuous hold verification — completely private on your device.
        </p>

        <div className="hero-actions">
          <button className="btn btn-primary btn-large" onClick={onStart}>
            <span>Begin Flow Practice</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
          <button className="btn btn-secondary btn-large" onClick={onOpenSettings}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
        </div>

        {/* Privacy Assurance Badge */}
        <div className="privacy-pill">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span><strong>100% On-Device Privacy:</strong> Video is processed locally in WebAssembly. No camera streams ever leave your computer.</span>
        </div>
      </section>

      {/* How It Works (3 Steps) */}
      <section className="steps-section">
        <h2 className="section-title">How It Works in 3 Steps</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-num">1</div>
            <h3 className="step-title">Frame Your Mat</h3>
            <p className="step-desc">
              Position your webcam so your full body from head to feet is clearly visible on the screen.
            </p>
          </div>

          <div className="step-card">
            <div className="step-num">2</div>
            <h3 className="step-title">Align with Visual Cues</h3>
            <p className="step-desc">
              Watch real-time skeleton joints color-code green as you achieve the target anatomical angles.
            </p>
          </div>

          <div className="step-card">
            <div className="step-num">3</div>
            <h3 className="step-title">Hold Steadily</h3>
            <p className="step-desc">
              Maintain the posture continuously for 30 seconds to lock in muscle memory and unlock the next level.
            </p>
          </div>
        </div>
      </section>

      {/* Progressive Level Curriculum */}
      <section className="levels-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Practice Curriculum</h2>
            <p className="section-subtitle">5 progressive levels designed to build strength, balance, and mindful alignment.</p>
          </div>
        </div>

        <div className="level-cards-grid">
          {LEVELS.map((level, idx) => {
            const isUnlocked = idx < unlockedLevels;
            const bestScore = savedScores[level.id];

            return (
              <button
                key={level.id}
                type="button"
                className={`level-preview-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                onClick={() => isUnlocked && onSelectLevel(idx)}
                disabled={!isUnlocked}
                aria-label={`Level ${level.id}: ${level.name}${!isUnlocked ? ' (Locked)' : ''}`}
              >
                <div className="level-preview-thumb">
                  <img src={level.image} alt="" aria-hidden="true" loading="lazy" />
                  {!isUnlocked && (
                    <div className="lock-overlay">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <span>Complete Level {level.id - 1} to Unlock</span>
                    </div>
                  )}
                  {bestScore && (
                    <div className="score-ribbon">
                      Best: {bestScore}%
                    </div>
                  )}
                </div>

                <div className="level-preview-content">
                  <div className="level-tag">
                    <span>Level {level.id}</span>
                    <span className="dot">•</span>
                    <span>{level.category}</span>
                  </div>
                  <h3 className="level-name">{level.name}</h3>
                  <p className="level-brief">{level.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Landing;
