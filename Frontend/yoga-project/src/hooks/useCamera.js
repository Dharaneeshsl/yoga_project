import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export function useCamera() {
  const videoElementRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState('');

  // Enumerate video devices with populated labels
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0) {
        setSelectedDeviceIdState(prev => prev || videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
    setIsActive(false);
    setIsLoading(false);
  }, []);

  // Safely play video element with timeout guard
  const bindStreamToVideo = useCallback(async (videoEl, stream) => {
    if (!videoEl || !stream) return;
    videoEl.srcObject = stream;

    if (videoEl.readyState >= 1 && videoEl.videoWidth > 0) {
      try {
        await videoEl.play();
      } catch (e) {
        console.warn('Video play caught:', e);
      }
      return;
    }

    await new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          clearTimeout(timer);
          videoEl.play().catch(e => console.warn('Video play error:', e)).finally(resolve);
        }
      };
      const onLoaded = () => done();
      const timer = setTimeout(done, 4000); // 4s timeout prevents indefinite freeze

      videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
    });
  }, []);

  // Attach video element callback ref used by LevelScreen
  const attachVideo = useCallback((node) => {
    videoElementRef.current = node;
    if (node && streamRef.current) {
      // Re-attach active stream if video element was re-mounted
      bindStreamToVideo(node, streamRef.current);
    }
  }, [bindStreamToVideo]);

  const startCamera = useCallback(async (deviceIdOverride) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        type: 'UNSUPPORTED',
        message: 'Camera API is not supported in this browser or context (HTTPS required).'
      });
      return false;
    }

    setIsLoading(true);
    setError(null);

    const targetDevice = deviceIdOverride || selectedDeviceId;
    const constraints = {
      audio: false,
      video: {
        facingMode: targetDevice ? undefined : 'user',
        deviceId: targetDevice ? { exact: targetDevice } : undefined,
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      }
    };

    try {
      // Stop old tracks before opening new device stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (e) { void e; }
        });
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        // Fall back to facingMode: 'user' if target deviceId throws OverconstrainedError or NotFound
        if (targetDevice && (firstErr.name === 'OverconstrainedError' || firstErr.name === 'NotFoundError')) {
          console.warn('Target camera device unavailable, falling back to facingMode: user:', firstErr);
          setSelectedDeviceIdState('');
          const fallbackConstraints = {
            audio: false,
            video: {
              facingMode: 'user',
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            }
          };
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;

      if (videoElementRef.current) {
        await bindStreamToVideo(videoElementRef.current, stream);
      }

      setIsActive(true);
      setIsLoading(false);
      // Refresh device labels now that camera permission is granted
      refreshDevices();
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      let errorType = 'GENERIC';
      let message = 'Unable to access your camera. Please check permissions.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorType = 'PERMISSION_DENIED';
        message = 'Camera permission was denied. Please allow camera access in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorType = 'NOT_FOUND';
        message = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorType = 'IN_USE';
        message = 'Your camera is currently in use by another application.';
      }

      setError({ type: errorType, message });
      setIsLoading(false);
      setIsActive(false);
      return false;
    }
  }, [selectedDeviceId, bindStreamToVideo, refreshDevices]);

  // Set device and auto-restart if active
  const setSelectedDeviceId = useCallback((deviceId) => {
    setSelectedDeviceIdState(deviceId);
    if (streamRef.current) {
      startCamera(deviceId);
    }
  }, [startCamera]);

  const clearError = useCallback(() => setError(null), []);

  const pauseCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }, []);

  const resumeCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = true;
      });
    }
  }, []);

  // Clean up stream tracks on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Return a stable memoized object
  return useMemo(() => ({
    videoRef: videoElementRef,
    attachVideo,
    isActive,
    isLoading,
    error,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startCamera,
    stopCamera,
    pauseCameraTracks,
    resumeCameraTracks,
    clearError
  }), [
    attachVideo,
    isActive,
    isLoading,
    error,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startCamera,
    stopCamera,
    pauseCameraTracks,
    resumeCameraTracks,
    clearError
  ]);
}
