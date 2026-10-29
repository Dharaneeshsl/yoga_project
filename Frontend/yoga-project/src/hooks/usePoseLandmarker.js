import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { calculatePoseAngles, checkFullBodyInFrame } from '../utils/poseUtils';

const MODEL_LOCAL_PATH = '/models/pose_landmarker_lite.task';
const MODEL_CDN_FALLBACK = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
// Exact pinned version matching package.json to prevent CDN breaking changes
const PINNED_WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';

async function createLandmarkerWithFallback(vision, modelPath) {
  try {
    // Try GPU acceleration first
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  } catch (gpuErr) {
    console.warn('GPU delegate failed, falling back to CPU delegate:', gpuErr);
    // Graceful CPU fallback for devices with disabled/incompatible WebGL
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  }
}

export function usePoseLandmarker() {
  const landmarkerRef = useRef(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [modelProgress, setModelProgress] = useState('Initializing MediaPipe...');

  // React state throttled to ~5 Hz to eliminate unnecessary re-renders
  const [landmarks, setLandmarks] = useState([]);
  const [detectedAngles, setDetectedAngles] = useState({});
  const [bodyCheck, setBodyCheck] = useState({ isReady: false, message: 'Looking for yogi...' });

  // High-frequency refs for 60fps canvas drawing and calculations
  const latestLandmarksRef = useRef([]);
  const latestAnglesRef = useRef({});
  const latestBodyCheckRef = useRef({ isReady: false, message: 'Looking for yogi...' });

  const animFrameIdRef = useRef(null);
  const videoFrameCallbackIdRef = useRef(null);
  const isDetectingRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const lastStateUpdateTimeRef = useRef(0);
  const activeVideoRef = useRef(null);
  const onFrameCallbackRef = useRef(null);
  const triggerDetectionLoopRef = useRef(null);

  // Initialize model
  useEffect(() => {
    let isCancelled = false;

    async function initModel() {
      try {
        setIsModelLoading(true);
        setModelProgress('Loading WebAssembly core...');

        // 1. Try local wasm first, then pinned CDN
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks('/wasm');
        } catch (wasmErr) {
          console.warn('Local WASM failed, falling back to pinned CDN:', wasmErr);
          vision = await FilesetResolver.forVisionTasks(PINNED_WASM_CDN);
        }

        if (isCancelled) return;
        setModelProgress('Loading Pose AI model...');

        // 2. Try local model first, then CDN
        let landmarker;
        try {
          landmarker = await createLandmarkerWithFallback(vision, MODEL_LOCAL_PATH);
        } catch (localModelErr) {
          console.warn('Local model load failed, falling back to CDN:', localModelErr);
          landmarker = await createLandmarkerWithFallback(vision, MODEL_CDN_FALLBACK);
        }

        if (isCancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsModelLoading(false);
        setModelProgress('Ready');

        // If video was already waiting to start detection, start now
        if (activeVideoRef.current && isDetectingRef.current && triggerDetectionLoopRef.current) {
          triggerDetectionLoopRef.current(activeVideoRef.current);
        }
      } catch (err) {
        console.error('Failed to load MediaPipe PoseLandmarker:', err);
        if (!isCancelled) {
          setModelError('Failed to initialize pose detection engine: ' + (err.message || 'WebGL error'));
          setIsModelLoading(false);
        }
      }
    }

    initModel();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (e) {
          console.warn('Error closing landmarker:', e);
        }
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Core frame loop handler
  const processFrame = useCallback((videoElement) => {
    if (!isDetectingRef.current || !landmarkerRef.current || !videoElement) return;

    if (
      videoElement.readyState >= 2 &&
      !videoElement.paused &&
      !videoElement.ended
    ) {
      if (videoElement.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = videoElement.currentTime;
        const timestamp = performance.now();

        try {
          const results = landmarkerRef.current.detectForVideo(videoElement, timestamp);
          if (results && results.landmarks && results.landmarks.length > 0) {
            const detected = results.landmarks[0];
            latestLandmarksRef.current = detected;

            const vw = videoElement.videoWidth || 640;
            const vh = videoElement.videoHeight || 480;

            const angles = calculatePoseAngles(detected, vw, vh);
            latestAnglesRef.current = angles;

            const check = checkFullBodyInFrame(detected);
            latestBodyCheckRef.current = check;

            // Notify direct subscriber (e.g. canvas rendering at full frame rate)
            if (onFrameCallbackRef.current) {
              onFrameCallbackRef.current({
                landmarks: detected,
                angles,
                bodyCheck: check,
                videoWidth: vw,
                videoHeight: vh
              });
            }
          } else {
            latestLandmarksRef.current = [];
            latestAnglesRef.current = {};
            const noPersonCheck = { isReady: false, message: 'No person detected. Step into frame.' };
            latestBodyCheckRef.current = noPersonCheck;

            if (onFrameCallbackRef.current) {
              onFrameCallbackRef.current({
                landmarks: [],
                angles: {},
                bodyCheck: noPersonCheck,
                videoWidth: videoElement.videoWidth || 640,
                videoHeight: videoElement.videoHeight || 480
              });
            }
          }

          // Throttle React state commits to ~5 Hz (every 200ms) to avoid runaway renders
          const now = performance.now();
          if (now - lastStateUpdateTimeRef.current >= 200) {
            lastStateUpdateTimeRef.current = now;
            setLandmarks(latestLandmarksRef.current);
            setDetectedAngles(latestAnglesRef.current);
            setBodyCheck(latestBodyCheckRef.current);
          }
        } catch (detErr) {
          console.warn('Detection frame error:', detErr);
        }
      }
    }
  }, []);

  const triggerDetectionLoop = useCallback((videoElement) => {
    if (!videoElement) return;
    activeVideoRef.current = videoElement;

    const useVideoFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

    function step() {
      if (!isDetectingRef.current) return;
      processFrame(videoElement);

      if (useVideoFrameCallback && videoElement.requestVideoFrameCallback) {
        videoFrameCallbackIdRef.current = videoElement.requestVideoFrameCallback(step);
      } else {
        animFrameIdRef.current = requestAnimationFrame(step);
      }
    }

    if (useVideoFrameCallback && videoElement.requestVideoFrameCallback) {
      videoFrameCallbackIdRef.current = videoElement.requestVideoFrameCallback(step);
    } else {
      animFrameIdRef.current = requestAnimationFrame(step);
    }
  }, [processFrame]);

  triggerDetectionLoopRef.current = triggerDetectionLoop;

  const startDetectionLoop = useCallback((videoElement) => {
    if (!videoElement) return;
    activeVideoRef.current = videoElement;
    isDetectingRef.current = true;

    // Cancel existing loop before starting new one
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (videoFrameCallbackIdRef.current && videoElement.cancelVideoFrameCallback) {
      videoElement.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      videoFrameCallbackIdRef.current = null;
    }

    if (landmarkerRef.current) {
      triggerDetectionLoop(videoElement);
    }
  }, [triggerDetectionLoop]);

  const stopDetectionLoop = useCallback(() => {
    isDetectingRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (activeVideoRef.current && videoFrameCallbackIdRef.current && activeVideoRef.current.cancelVideoFrameCallback) {
      activeVideoRef.current.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      videoFrameCallbackIdRef.current = null;
    }

    // Only update state if not already empty
    if (latestLandmarksRef.current.length > 0) {
      latestLandmarksRef.current = [];
      latestAnglesRef.current = {};
      setLandmarks([]);
      setDetectedAngles({});
    }
  }, []);

  const setOnFrameCallback = useCallback((callback) => {
    onFrameCallbackRef.current = callback;
  }, []);

  return useMemo(() => ({
    isModelLoading,
    modelError,
    modelProgress,
    landmarks,
    detectedAngles,
    bodyCheck,
    latestLandmarksRef,
    latestAnglesRef,
    latestBodyCheckRef,
    startDetectionLoop,
    stopDetectionLoop,
    setOnFrameCallback
  }), [
    isModelLoading,
    modelError,
    modelProgress,
    landmarks,
    detectedAngles,
    bodyCheck,
    startDetectionLoop,
    stopDetectionLoop,
    setOnFrameCallback
  ]);
}
