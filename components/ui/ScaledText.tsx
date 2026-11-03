import React, { createContext, forwardRef, useContext } from 'react';
import { StyleSheet, Text as NativeText, type TextProps } from 'react-native';
import { DEFAULT_FONT_SCALE, useFontScale } from '@/contexts/FontScaleContext';

const TextAncestorContext = createContext(false);
const NATIVE_DEFAULT_FONT_SIZE = 14;

/** A shared Text component that scales explicit and default font sizes by 25%. */
export const Text = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(
  ({ children, style, ...props }, ref) => {
    const hasTextAncestor = useContext(TextAncestorContext);
    const { fontScale } = useFontScale();
    const flattenedStyle = StyleSheet.flatten(style);
    const fontSize = flattenedStyle?.fontSize;
    const scaledStyle = hasTextAncestor && fontSize == null
      ? style
      : [style, { fontSize: (fontSize ?? NATIVE_DEFAULT_FONT_SIZE) * (fontScale || DEFAULT_FONT_SCALE) }];

    return (
      <NativeText {...props} ref={ref} style={scaledStyle}>
        <TextAncestorContext.Provider value>
          {children}
        </TextAncestorContext.Provider>
      </NativeText>
    );
  }
);

Text.displayName = 'ScaledText';