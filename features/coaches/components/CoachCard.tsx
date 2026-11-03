import React, { memo, useState } from 'react';
import { Alert, Linking, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { Coach } from '@/services/coaches';

interface CoachCardProps {
  coach: Coach;
  color: string;
  compact?: boolean;
  gameLabel?: string;
  profit?: number;
  freeMemberNames?: string[];
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

async function callCoach(phone: string): Promise<void> {
  const number = phone.trim();
  if (!number) {
    Alert.alert('رقم الهاتف غير متوفر', 'أضف رقم هاتف للكابتن من شاشة الإدارة.');
    return;
  }
  const url = `tel:${number.replace(/[\s().-]/g, '')}`;
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  } catch (error) {
    console.warn('Unable to start a call to the coach:', error);
  }

  try {
    await Clipboard.setStringAsync(number);
    Alert.alert('الاتصال غير متاح', 'تم نسخ رقم الكابتن إلى الحافظة.');
  } catch (error) {
    console.warn('Unable to copy the coach phone number:', error);
    Alert.alert('تعذر الاتصال', 'يرجى الاتصال بالكابتن يدوياً باستخدام الرقم المسجل.');
  }
}

export const CoachCard = memo(({ coach, color, compact = false, gameLabel, profit = 0, freeMemberNames = [] }: CoachCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((expanded) => !expanded);
  };

  return (
    <View style={[styles.card, compact && styles.compactCard, { borderColor: `${color}45` }]}>
      <View style={[styles.accent, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.identity}>
          <Pressable
            style={styles.identityToggle}
            onPress={toggleExpanded}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={`${coach.name}، كابتن ${gameLabel ?? coach.gameLabel}. ${isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}`}
          >
            <Text style={styles.name} numberOfLines={1}>{coach.name}</Text>
            <Text style={styles.gameLabel} numberOfLines={1}>كابتن {gameLabel ?? coach.gameLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`الاتصال بالكابتن ${coach.name}`}
            accessibilityHint="يفتح تطبيق الهاتف لإجراء مكالمة أو ينسخ الرقم إذا تعذر الاتصال"
            onPress={() => void callCoach(coach.phone)}
            style={({ pressed }) => [styles.callButton, { backgroundColor: color }, pressed && styles.pressed]}
          >
            <MaterialIcons name="call" size={12} color={Colors.white} />
            <Text style={styles.callText}>اتصال</Text>
          </Pressable>
        </View>
        {isExpanded ? (
          <View style={styles.details}>
            <Text style={styles.metricText}>أرباح الكابتن: {profit.toLocaleString('ar-SA')} ر.ي ({coach.profitPercentage}%)</Text>
            <View style={styles.freeMembersRow}>
              <Text style={styles.freeMembersLabel}>المشتركين مجاناً: {freeMemberNames.length}/{coach.maxFreeMembers}</Text>
              <MaterialIcons name="people-outline" size={14} color={color} />
            </View>
            {freeMemberNames.length > 0 ? (
              <Text style={styles.freeNames}>
                {freeMemberNames.join('، ')}
              </Text>
            ) : (
              <Text style={styles.freeNames}>لا يوجد مشتركون مجاناً حالياً</Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row-reverse', overflow: 'hidden', backgroundColor: Colors.card, borderWidth: 1, borderRadius: 5, marginHorizontal: Spacing.xl, marginTop: 3, marginBottom: 2 },
  compactCard: { marginHorizontal: 0, marginTop: 2, marginBottom: 3 },
  accent: { width: 3 },
  content: { flex: 1, paddingHorizontal: 5, paddingTop: 4, paddingBottom: 6 },
  identity: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 30 },
  identityToggle: { flex: 1, minWidth: 0, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 3 },
  name: { flexShrink: 1, color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '800', textAlign: 'right', lineHeight: 16, includeFontPadding: true },
  gameLabel: { flexShrink: 1, color: Colors.textSecondary, fontSize: 9, textAlign: 'right', lineHeight: 13, includeFontPadding: true },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, marginTop: 3, paddingTop: 3, gap: 3 },
  metricText: { color: Colors.success, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  freeMembersRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  freeMembersLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  freeNames: { color: Colors.textSecondary, fontSize: 9, textAlign: 'right', lineHeight: 13 },
  callButton: { minWidth: 36, height: 22, borderRadius: 5, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  callText: { color: Colors.white, fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
