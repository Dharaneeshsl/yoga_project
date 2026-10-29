import React, { useEffect, useRef } from 'react';

const SettingsModal = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  devices,
  selectedDeviceId,
  onSelectDevice
}) => {
  const modalContentRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalContentRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll('button, select, input, [tabindex="0"]');
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="modal-content"
        ref={modalContentRef}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-title" className="modal-title">Practice Settings</h2>
          <button className="btn-close" onClick={onClose} aria-label="Close settings">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Hold Duration */}
          <div className="setting-group">
            <label className="setting-label">Hold Duration</label>
            <div className="button-group">
              {[15, 30, 45].map(seconds => (
                <button
                  key={seconds}
                  type="button"
                  className={`btn-choice ${settings.holdDuration === seconds ? 'active' : ''}`}
                  onClick={() => onUpdateSettings({ holdDuration: seconds })}
                >
                  {seconds}s
                </button>
              ))}
            </div>
            <span className="setting-desc">How long you must maintain alignment to complete each level.</span>
          </div>

          {/* Difficulty */}
          <div className="setting-group">
            <label className="setting-label">Difficulty / Tolerance</label>
            <div className="button-group">
              {[
                { id: 'gentle', label: 'Gentle', multiplier: 1.25 },
                { id: 'standard', label: 'Standard', multiplier: 1.0 },
                { id: 'strict', label: 'Strict', multiplier: 0.8 }
              ].map(diff => (
                <button
                  key={diff.id}
                  type="button"
                  className={`btn-choice ${settings.difficulty === diff.id ? 'active' : ''}`}
                  onClick={() => onUpdateSettings({ difficulty: diff.id, difficultyMultiplier: diff.multiplier })}
                >
                  {diff.label}
                </button>
              ))}
            </div>
            <span className="setting-desc">Adjusts how strictly joint angles must match the reference pose.</span>
          </div>

          {/* Voice Guidance Toggle */}
          <div className="setting-group">
            <div className="toggle-row">
              <div>
                <div className="setting-label">Audio & Voice Cues</div>
                <div className="setting-desc">Spoken countdowns, alignment reminders, and cheer cues.</div>
              </div>
              <label className="switch" aria-label="Toggle audio cues">
                <input
                  type="checkbox"
                  checked={settings.voiceEnabled}
                  onChange={e => onUpdateSettings({ voiceEnabled: e.target.checked })}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          {/* Mirror Toggle */}
          <div className="setting-group">
            <div className="toggle-row">
              <div>
                <div className="setting-label">Mirror Camera View</div>
                <div className="setting-desc">Flips camera horizontally like a mirror (recommended).</div>
              </div>
              <label className="switch" aria-label="Toggle mirror camera">
                <input
                  type="checkbox"
                  checked={settings.mirrorView}
                  onChange={e => onUpdateSettings({ mirrorView: e.target.checked })}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          {/* Camera Selection */}
          {devices && devices.length > 1 && (
            <div className="setting-group">
              <label className="setting-label" htmlFor="camera-select">Webcam Source</label>
              <select
                id="camera-select"
                className="select-input"
                value={selectedDeviceId}
                onChange={e => onSelectDevice(e.target.value)}
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
