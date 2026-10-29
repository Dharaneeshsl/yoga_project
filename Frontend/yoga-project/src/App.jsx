import React, { useState, useEffect, useCallback } from 'react';
import './index.css';
import { LEVELS } from './data/levels';
import Landing from './components/Landing';
import LevelScreen from './components/LevelScreen';
import ScoreScreen from './components/ScoreScreen';
import FinalScreen from './components/FinalScreen';
import SettingsModal from './components/SettingsModal';

import { useCamera } from './hooks/useCamera';
import { usePoseLandmarker } from './hooks/usePoseLandmarker';
import { useHoldTimer } from './hooks/useHoldTimer';
import { useVoiceGuidance } from './hooks/useVoiceGuidance';
import { parseUnlockedLevels, parseSavedScores } from './utils/storageUtils';

const STORAGE_KEY_UNLOCKED = 'poseyoga_unlocked_levels';
const STORAGE_KEY_SCORES = 'poseyoga_saved_scores';
const STORAGE_KEY_SETTINGS = 'poseyoga_user_settings';

const DIFFICULTY_MAP = {
  gentle: { similarityThreshold: 0.58, passScoreThreshold: 50, multiplier: 1.25 },
  standard: { similarityThreshold: 0.65, passScoreThreshold: 60, multiplier: 1.0 },
  strict: { similarityThreshold: 0.75, passScoreThreshold: 70, multiplier: 0.8 }
};

function App() {
  // Navigation State
  const [screen, setScreen] = useState('landing'); // 'landing' | 'level' | 'score' | 'final'
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState([]);
  const [lastLevelResult, setLastLevelResult] = useState(null);

  // Persistence: Unlocked levels (clamped between 1 and LEVELS.length, with ?unlock=all demo shortcut)
  const [unlockedLevels, setUnlockedLevels] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('unlock') === 'all') {
        return LEVELS.length;
      }
    }
    try {
      return parseUnlockedLevels(localStorage.getItem(STORAGE_KEY_UNLOCKED), LEVELS.length);
    } catch {
      return 1;
    }
  });

  // Persistence: Saved best scores
  const [savedScores, setSavedScores] = useState(() => {
    try {
      return parseSavedScores(localStorage.getItem(STORAGE_KEY_SCORES));
    } catch {
      return {};
    }
  });

  // Settings State with safe fallback
  const [settings, setSettings] = useState(() => {
    const defaults = {
      holdDuration: 30,
      difficulty: 'standard',
      difficultyMultiplier: 1.0,
      voiceEnabled: true,
      mirrorView: true
    };
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaults, ...parsed };
        }
      }
      return defaults;
    } catch {
      return defaults;
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Update Settings with persistence
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
      return updated;
    });
  }, []);

  // Initialize Core Hooks
  const camera = useCamera();
  const landmarker = usePoseLandmarker();
  const voice = useVoiceGuidance(settings.voiceEnabled);

  // Dynamic difficulty configuration
  const diffConfig = DIFFICULTY_MAP[settings.difficulty] || DIFFICULTY_MAP.standard;

  // Handle level completion
  const handleFinishLevel = useCallback((levelRunData) => {
    const currentLevel = LEVELS[currentLevelIndex];
    const rawScore = levelRunData.score !== undefined ? levelRunData.score : (levelRunData.similarityAvg || 0);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));
    const isPassed = Boolean(levelRunData.isPassed !== undefined ? levelRunData.isPassed : score >= diffConfig.passScoreThreshold);

    const resultEntry = {
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      score,
      passThreshold: diffConfig.passScoreThreshold,
      holdSeconds: levelRunData.holdElapsed,
      simMap: levelRunData.simMap,
      isMirrored: levelRunData.isMirrored,
      isPassed,
      completedAt: new Date().toISOString()
    };

    setLastLevelResult(resultEntry);
    setSessionResults(prev => {
      const updated = [...prev];
      updated[currentLevelIndex] = resultEntry;
      return updated;
    });

    // Save score in localStorage (never decreases)
    setSavedScores(prev => {
      const currentBest = prev[currentLevel.id] || 0;
      const updated = { ...prev, [currentLevel.id]: Math.max(currentBest, score) };
      try {
        localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(updated));
      } catch (e) {
        console.warn('Score storage error:', e);
      }
      return updated;
    });

    // Unlock next level ONLY if score meets the passing threshold
    if (isPassed && currentLevelIndex + 1 >= unlockedLevels) {
      const nextUnlocked = Math.min(LEVELS.length, currentLevelIndex + 2);
      setUnlockedLevels(nextUnlocked);
      try {
        localStorage.setItem(STORAGE_KEY_UNLOCKED, String(nextUnlocked));
      } catch (e) {
        console.warn('Unlock storage error:', e);
      }
    }

    setScreen('score');
  }, [currentLevelIndex, unlockedLevels, diffConfig.passScoreThreshold]);

  const holdTimer = useHoldTimer({
    targetHoldSeconds: settings.holdDuration,
    countdownSeconds: 3,
    similarityThreshold: diffConfig.similarityThreshold,
    passScoreThreshold: diffConfig.passScoreThreshold,
    onComplete: handleFinishLevel
  });

  // Stable detection loop trigger:
  // Starts when screen is 'level', camera is active, model is ready, and video element exists.
  // Stops cleanly whenever user leaves the level screen.
  const { startDetectionLoop, stopDetectionLoop, isModelLoading } = landmarker;
  const {
    isActive: isCameraActive,
    videoRef,
    pauseCameraTracks,
    resumeCameraTracks,
    stopCamera,
    startCamera
  } = camera;

  useEffect(() => {
    if (screen === 'level' && isCameraActive && !isModelLoading && videoRef.current) {
      resumeCameraTracks();
      startDetectionLoop(videoRef.current);
    } else {
      stopDetectionLoop();
      if (screen === 'score') {
        pauseCameraTracks();
      } else if (screen === 'final' || screen === 'landing') {
        stopCamera();
      }
    }
  }, [screen, isCameraActive, isModelLoading, videoRef, startDetectionLoop, stopDetectionLoop, resumeCameraTracks, pauseCameraTracks, stopCamera]);

  // Handle start from landing (first-click camera trigger)
  const handleStartPractice = useCallback(() => {
    holdTimer.reset();
    setCurrentLevelIndex(0);
    setSessionResults([]);
    setScreen('level');
    startCamera();
  }, [holdTimer, startCamera]);

  // Handle direct level select from landing (first-click camera trigger)
  const handleSelectLevel = useCallback((index) => {
    holdTimer.reset();
    setCurrentLevelIndex(index);
    setScreen('level');
    startCamera();
  }, [holdTimer, startCamera]);

  // Navigate to next level
  const handleNextLevel = useCallback(() => {
    holdTimer.reset();
    if (currentLevelIndex + 1 < LEVELS.length) {
      setCurrentLevelIndex(prev => prev + 1);
      setScreen('level');
    } else {
      setScreen('final');
    }
  }, [currentLevelIndex, holdTimer]);

  // Retry current level
  const handleRetryLevel = useCallback(() => {
    holdTimer.reset();
    setScreen('level');
  }, [holdTimer]);

  // Exit practice back to landing
  const handleExitPractice = useCallback(() => {
    holdTimer.reset();
    stopCamera();
    voice.stop();
    setScreen('landing');
  }, [stopCamera, holdTimer, voice]);

  // Restart practice from beginning
  const handleRestartPractice = useCallback(() => {
    holdTimer.reset();
    stopCamera();
    voice.stop();
    setSessionResults([]);
    setCurrentLevelIndex(0);
    setScreen('landing');
  }, [stopCamera, holdTimer, voice]);

  // Download results JSON
  const handleDownloadResults = useCallback(() => {
    const payload = {
      appName: 'PoseYoga',
      timestamp: new Date().toISOString(),
      completedLevels: sessionResults.filter(Boolean),
      settings
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poseyoga-session-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [sessionResults, settings]);

  return (
    <div className="app-container">
      {/* Site Header */}
      <header className="site-header">
        <div className="header-inner">
          <button className="brand-group" onClick={handleExitPractice} aria-label="Go to home">
            <div className="brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3"></circle>
                <path d="M12 8v8"></path>
                <path d="m8 12 4-2 4 2"></path>
                <path d="m9 20 3-4 3 4"></path>
              </svg>
            </div>
            <div>
              <span className="brand-name">PoseYoga</span>
            </div>
            <span className="brand-badge">Flow AI</span>
          </button>

          <div className="header-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Screen Routing */}
      <main id="app-main">
        {screen === 'landing' && (
          <Landing
            onStart={handleStartPractice}
            onSelectLevel={handleSelectLevel}
            unlockedLevels={unlockedLevels}
            savedScores={savedScores}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {screen === 'level' && (
          <LevelScreen
            levelData={LEVELS[currentLevelIndex]}
            totalLevels={LEVELS.length}
            camera={camera}
            landmarker={landmarker}
            holdTimer={holdTimer}
            settings={settings}
            diffConfig={diffConfig}
            onFinishLevel={handleFinishLevel}
            onExit={handleExitPractice}
            voice={voice}
          />
        )}

        {screen === 'score' && (
          <ScoreScreen
            levelData={LEVELS[currentLevelIndex]}
            levelIndex={currentLevelIndex}
            totalLevels={LEVELS.length}
            resultData={lastLevelResult}
            onNextLevel={handleNextLevel}
            onRetryLevel={handleRetryLevel}
            onExit={handleExitPractice}
          />
        )}

        {screen === 'final' && (
          <FinalScreen
            results={sessionResults}
            levels={LEVELS}
            onRestart={handleRestartPractice}
            onDownload={handleDownloadResults}
          />
        )}
      </main>

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        devices={camera.devices}
        selectedDeviceId={camera.selectedDeviceId}
        onSelectDevice={camera.setSelectedDeviceId}
      />

      {/* Site Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>PoseYoga • On-Device AI Posture Analysis. No video leaves your browser.</div>
          <div className="footer-links">
            <span className="footer-link">Privacy Preserving</span>
            <span className="footer-link">WebAssembly Powered</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
