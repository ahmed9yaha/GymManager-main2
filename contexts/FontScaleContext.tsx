import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FONT_SCALE_STORAGE_KEY = 'app_font_scale_v1';
export const DEFAULT_FONT_SCALE = 1.25;

interface FontScaleContextValue {
  fontScale: number;
  setFontScale: (scale: number) => Promise<void>;
}

const FontScaleContext = createContext<FontScaleContextValue>({
  fontScale: DEFAULT_FONT_SCALE,
  setFontScale: async () => undefined,
});

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState(DEFAULT_FONT_SCALE);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY).then((saved) => {
      const parsed = Number(saved);
      if (mounted && Number.isFinite(parsed) && parsed >= 0.75 && parsed <= 2) setFontScaleState(parsed);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const setFontScale = useCallback(async (scale: number) => {
    if (!Number.isFinite(scale) || scale < 0.75 || scale > 2) {
      throw new Error('Font scale must be between 0.75 and 2.');
    }
    await AsyncStorage.setItem(FONT_SCALE_STORAGE_KEY, String(scale));
    setFontScaleState(scale);
  }, []);

  const value = useMemo(() => ({ fontScale, setFontScale }), [fontScale, setFontScale]);
  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale(): FontScaleContextValue {
  return useContext(FontScaleContext);
}
