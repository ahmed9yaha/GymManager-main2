import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { WorkShift } from '@/contexts/ShiftContext';

interface ShiftGateModalProps {
  loaded: boolean;
  activeShift: WorkShift | null;
  closedShifts: WorkShift[];
  startShift: (employeeName: string) => Promise<void>;
}

export function ShiftGateModal({ loaded, activeShift, closedShifts, startShift }: ShiftGateModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [previousNames, setPreviousNames] = useState<string[]>([]);

  useEffect(() => {
    setPreviousNames([...new Set(closedShifts.map((shift) => shift.employeeName).filter(Boolean))].slice(0, 8));
  }, [closedShifts]);

  const handleStart = async () => {
    if (!name.trim()) {
      setError('يرجى إدخال اسم الموظف.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await startShift(name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر بدء الوردية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!loaded || !activeShift} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.gateCard}>
          <View style={styles.gateIcon}><MaterialIcons name="badge" size={30} color={Colors.reports} /></View>
          <Text style={styles.title}>{!loaded ? 'جارٍ استعادة بيانات الوردية' : 'بدء وردية العمل'}</Text>
          <Text style={styles.subtitle}>يلزم تسجيل اسم الموظف قبل استخدام النظام. تُحفظ جميع البيانات محلياً على هذا الجهاز.</Text>
          {!loaded ? <ActivityIndicator color={Colors.reports} style={{ marginTop: Spacing.lg }} /> : (
            <>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(value) => { setName(value); setError(''); }}
                placeholder="اسم الموظف"
                placeholderTextColor={Colors.textMuted}
                textAlign="right"
                maxLength={60}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void handleStart()}
              />
              {previousNames.length > 0 ? (
                <View style={styles.namesRow}>
                  {previousNames.map((previousName) => (
                    <Pressable key={previousName} style={styles.nameChip} onPress={() => setName(previousName)}>
                      <Text style={styles.nameChipText}>{previousName}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleStart()} style={[styles.startButton, saving && { opacity: 0.7 }]}>
                {saving ? <ActivityIndicator color={Colors.white} /> : <MaterialIcons name="play-arrow" size={22} color={Colors.white} />}
                <Text style={styles.startButtonText}>{saving ? 'جارٍ بدء الوردية…' : 'بدء الوردية'}</Text>
              </Pressable>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  gateCard: { width: '100%', maxWidth: 440, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: Colors.border },
  gateIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.reportsDim, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
  input: { backgroundColor: Colors.card, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: FontSize.md },
  namesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  nameChip: { backgroundColor: Colors.cardElevated, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  nameChipText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  error: { color: Colors.danger, textAlign: 'right', marginTop: Spacing.sm, fontSize: FontSize.sm },
  startButton: { marginTop: Spacing.lg, backgroundColor: Colors.reports, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  startButtonText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '800' },
});
