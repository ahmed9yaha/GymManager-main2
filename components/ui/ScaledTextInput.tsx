import React, { forwardRef } from 'react';
import { StyleSheet, TextInput as NativeTextInput, type TextInputProps } from 'react-native';
import { useFontScale } from '@/contexts/FontScaleContext';

const NATIVE_DEFAULT_FONT_SIZE = 14;

export const ScaledTextInput = forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(
  ({ style, ...props }, ref) => {
    const { fontScale } = useFontScale();
    const flattenedStyle = StyleSheet.flatten(style);
    const fontSize = flattenedStyle?.fontSize ?? NATIVE_DEFAULT_FONT_SIZE;
    return <NativeTextInput {...props} ref={ref} style={[style, { fontSize: fontSize * fontScale }]} />;
  }
);

ScaledTextInput.displayName = 'ScaledTextInput';
