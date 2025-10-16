import { useState, useEffect, useRef } from 'react';

/**
 * useTypewriterStream
 * Animates a string as a typewriter effect, updating as new chunks arrive.
 * @param text The full text to animate (can be updated with new chunks)
 * @param speed Delay in ms between each character (default: 20)
 * @returns The animated string
 */
export function     useTypewriterStream(text: string, speed: number = 20): string {
  const [displayed, setDisplayed] = useState('');
  const prevTextRef = useRef('');
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // If new text chunk arrives, animate only the new part
    if (text !== prevTextRef.current) {
      const prev = prevTextRef.current;
      const next = text;
      let i = prev.length;
      if (intervalRef.current) clearInterval(intervalRef.current);
  intervalRef.current = window.setInterval(() => {
        if (i <= next.length) {
          setDisplayed(next.slice(0, i));
          i++;
        } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, speed);
      prevTextRef.current = text;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  return displayed;
}
