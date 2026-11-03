// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { MaterialIcons } from '@expo/vector-icons';
import { GameType, SessionMode, modeLabel, modeDuration } from '@/services/tableGames';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';

interface TableSessionModalProps {
  visible: boolean;
  tableNumber: number;
  tableName?: string;
  gameType: GameType;
  gameLabel?: string;
  color: string;
  hourlyRate: number;
  onClose: () => void;
  onStart: (mode: SessionMode, customRate?: number) => void;
}

const MODES: SessionMode[] = ['1h', '2h', '3h', 'open'];

const MODE_ICONS: Record<SessionMode, keyof typeof MaterialIcons.glyphMap> = {
  '1h': 'access-time',
  '2h': 'schedule',
  '3h': 'timelapse',
  'open': 'all-inclusive',
  'custom': 'timer',
};

export function TableSessionModal({
  visible,
  tableNumber,
  tableName,
  gameType,
  gameLabel,
  color,
  hourlyRate,
  onClose,
  onStart,
}: TableSessionModalProps) {
  const [selected, setSelected] = useState<SessionMode | null>(null);
  const [customRate, setCustomRate] = useState('');

  const effectiveRate =
    customRate && !isNaN(Number(customRate)) && Number(customRate) > 0
      ? Number(customRate)
      : hourlyRate;

  const calcPreviewCost = (mode: SessionMode): number | null => {
    if (mode === 'open') return null;
    const mins = modeDuration(mode);
    return Math.ceil((mins / 60) * effectiveRate);
  };

  const handleStart = () => {
    if (!selected) return;
    onStart(selected, customRate ? effectiveRate : undefined);
    setSelected(null);
    setCustomRate('');
  };

  const handleClose = () => {
    setSelected(null);
    setCustomRate('');
    onClose();
  };

  const sessionGameLabel = gameLabel ?? (gameType === 'billiards' ? 'بلياردو' : gameType === 'tabletennis' ? 'تنس الطاولة' : 'ألعاب أخرى');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoidWrap}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            {/* Color strip */}
            <View style={[styles.strip, { backgroundColor: color }]} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>بدء جلسة جديدة</Text>
                <Text style={[styles.subtitle, { color }]}>
                  {sessionGameLabel} — {tableName || `طاولة ${tableNumber}`}
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>

              {/* Hourly rate input */}
              <View style={styles.rateRow}>
                <MaterialIcons name="payments" size={18} color={Colors.reports} />
                <View style={styles.rateInfo}>
                  <Text style={styles.rateLabel}>سعر الساعة</Text>
                  <Text style={[styles.rateDefault, { color: Colors.reports }]}>
                    الافتراضي: {hourlyRate.toLocaleString('ar-SA')} ر.ي
                  </Text>
                </View>
                <TextInput
                  style={[styles.rateInput, { borderColor: color + '50' }]}
                  placeholder={String(hourlyRate)}
                  placeholderTextColor={Colors.textMuted}
                  value={customRate}
                  onChangeText={setCustomRate}
                  keyboardType="numeric"
                  textAlign="center"
                />
              </View>

              <Text style={styles.sectionLabel}>اختر مدة الجلسة</Text>

              {/* Mode buttons grid */}
              <View style={styles.modeGrid}>
                {MODES.map((mode) => {
                  const isSelected = selected === mode;
                  const previewCost = calcPreviewCost(mode);
                  return (
                    <Pressable
                      key={mode}
                      style={({ pressed }) => [
                        styles.modeBtn,
                        isSelected
                          ? { backgroundColor: color, borderColor: color }
                          : { backgroundColor: Colors.card, borderColor: Colors.border },
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setSelected(mode)}
                    >
                      <MaterialIcons
                        name={MODE_ICONS[mode]}
                        size={26}
                        color={isSelected ? Colors.white : color}
                      />
                      <Text
                        style={[
                          styles.modeLabel,
                          { color: isSelected ? Colors.white : Colors.textPrimary },
                        ]}
                      >
                        {modeLabel(mode)}
                      </Text>
                      {previewCost !== null ? (
                        <Text
                          style={[
                            styles.modeCost,
                            {
                              color: isSelected
                                ? Colors.white + 'CC'
                                : Colors.reports,
                            },
                          ]}
                        >
                          {previewCost.toLocaleString('ar-SA')} ر.ي
                        </Text>
                      ) : (
                        <Text
                          style={[
                            styles.modeCost,
                            {
                              color: isSelected
                                ? Colors.white + 'CC'
                                : Colors.textMuted,
                            },
                          ]}
                        >
                          يُحسب لاحقاً
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Open time explanation */}
              {selected === 'open' ? (
                <View
                  style={[
                    styles.openNote,
                    {
                      backgroundColor: Colors.statBlueDim,
                      borderColor: Colors.statBlue + '30',
                    },
                  ]}
                >
                  <MaterialIcons name="info-outline" size={16} color={Colors.statBlue} />
                  <Text style={[styles.openNoteText, { color: Colors.statBlue }]}>
                    سيبدأ عداد تصاعدي يحسب التكلفة بدقة حتى تضغط "إيقاف" يدوياً.
                  </Text>
                </View>
              ) : null}

              {/* Cost summary */}
              {selected && selected !== 'open' ? (
                <View
                  style={[
                    styles.summary,
                    { backgroundColor: color + '15', borderColor: color + '30' },
                  ]}
                >
                  <Text style={[styles.summaryText, { color }]}>
                    المدة: {modeLabel(selected)} — التكلفة: {calcPreviewCost(selected)?.toLocaleString('ar-SA')} ر.ي
                  </Text>
                </View>
              ) : null}

              {/* Start button */}
              <Pressable
                style={({ pressed }) => [
                  styles.startBtn,
                  { backgroundColor: selected ? color : Colors.border },
                  pressed && selected ? { opacity: 0.85 } : {},
                ]}
                onPress={handleStart}
                disabled={!selected}
              >
                <MaterialIcons name="play-arrow" size={22} color={Colors.white} />
                <Text style={styles.startBtnText}>بدء الجلسة</Text>
              </Pressable>

              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  avoidWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  strip: {
    height: 4,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: Spacing.xl,
  },
  rateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rateInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rateLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  rateDefault: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  rateInput: {
    width: 80,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
    marginBottom: Spacing.lg,
  },
  modeGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modeBtn: {
    width: '47.5%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  modeLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  modeCost: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  openNote: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    alignItems: 'flex-start',
  },
  openNoteText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'right',
  },
  summary: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    alignItems: 'flex-end',
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'right',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
