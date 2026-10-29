import { useCallback, useRef, useEffect, useMemo } from 'react';

export function useVoiceGuidance(enabled = true) {
  const lastSpokenTextRef = useRef('');
  const lastSpokenTimeRef = useRef(0);
  const voicesRef = useRef([]);

  // Populate voices including asynchronous loading
  useEffect(() => {
    if (!window.speechSynthesis) return;

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

  const speak = useCallback((text, priority = false) => {
    if (!enabled || !window.speechSynthesis || !text) return;

    const now = Date.now();
    // Prevent repeating identical non-priority utterance within 4 seconds
    if (!priority && text === lastSpokenTextRef.current && now - lastSpokenTimeRef.current < 4000) {
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
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return useMemo(() => ({ speak, stop }), [speak, stop]);
}
