import { useEffect, useState } from 'react';

export interface VisualViewportState {
  height: number | null;
  offsetTop: number;
  isKeyboardOpen: boolean;
}

/**
 * Tracks browser visualViewport height and vertical offset so mobile chat shells
 * keep their top header pinned when virtual keyboards open on iOS and Android.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height: typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : null,
    offsetTop: typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.offsetTop : 0,
    isKeyboardOpen: false,
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const vv = window.visualViewport;
    let baselineHeight = Math.max(window.innerHeight, vv.height);

    const syncViewport = () => {
      // Update baseline when rotating device or resizing desktop browser window
      if (vv.height > baselineHeight || Math.abs(window.innerHeight - vv.height) < 40) {
        baselineHeight = Math.max(window.innerHeight, vv.height);
      }

      const keyboardLikelyOpen = baselineHeight - vv.height > 120;

      // Prevent iOS Safari from pushing the document scroll offset above the header
      if (keyboardLikelyOpen && window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }

      setState({
        height: vv.height,
        offsetTop: vv.offsetTop,
        isKeyboardOpen: keyboardLikelyOpen,
      });
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);

    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  return state;
}
