// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '@/constants/theme';

interface StatsCardProps {
  label: string;
  value: number;
  color: string;
  dimColor: string;
  iconName: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
}

export const StatsCard = memo(({ label, value, color, dimColor, iconName, onPress }: StatsCardProps) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: dimColor, borderColor: color + '40' },
        onPress && pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.content}>
        <View style={styles.valueGroup}>
          <View style={[styles.iconCircle, { backgroundColor: color + '25' }]}>
            <MaterialIcons name={iconName} size={12} color={color} />
          </View>
          <Text style={[styles.value, { color }]}>{value}</Text>
        </View>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 5,
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 0,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
  },
  valueGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconCircle: {
    width: 16,
    height: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 0,
  },
  label: {
    alignSelf: 'stretch',
    fontSize: 8,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 12,
  },
});
