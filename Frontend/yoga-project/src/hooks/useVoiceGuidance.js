import { useCallback, useRef, useEffect, useMemo } from 'react';

export function useVoiceGuidance(enabled = true) {
  const lastSpokenTextRef = useRef('');
  const lastSpokenTimeRef = useRef(0);
  const voicesRef = useRef([]);

  // Populate voices including asynchronous loading
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      try {
        voicesRef.current = window.speechSynthesis.getVoices() || [];
      } catch (e) {
        console.warn('Could not retrieve speech voices:', e);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Cancel any ongoing speech immediately if voice is disabled or component unmounts
  useEffect(() => {
    if (!enabled && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        void e;
      }
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          void e;
        }
      }
    };
  }, []);

  const speak = useCallback((text, priority = false) => {
    if (!enabled || typeof window === 'undefined' || !window.speechSynthesis || !text) return;

    const now = Date.now();
    // Say an instruction once; do not repeat while the error persists until the instruction changes
    if (!priority && text === lastSpokenTextRef.current) {
      return;
    }

    try {
      if (priority) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.85;

      const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny'))
      );
      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      window.speechSynthesis.speak(utterance);
      lastSpokenTextRef.current = text;
      lastSpokenTimeRef.current = now;
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }, [enabled]);

  const stop = useCallback(() => {
    lastSpokenTextRef.current = '';
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        void e;
      }
    }
  }, []);

  return useMemo(() => ({ speak, stop }), [speak, stop]);
}
