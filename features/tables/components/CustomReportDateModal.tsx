import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

interface CustomReportDateModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (from: Date, to: Date) => void;
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateISO(value: string): Date | null {
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function CustomReportDateModal({ visible, onClose, onApply }: CustomReportDateModalProps) {
  const today = new Date();
  const [fromStr, setFromStr] = useState(formatDateISO(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toStr, setToStr] = useState(formatDateISO(today));
  const [error, setError] = useState('');

  const handleApply = () => {
    const from = parseDateISO(fromStr);
    const to = parseDateISO(toStr);
    if (!from || !to) {
      setError('صيغة التاريخ غير صحيحة (YYYY-MM-DD)');
      return;
    }
    if (from > to) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }
    setError('');
    onApply(startOfDay(from), endOfDay(to));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={[styles.strip, { backgroundColor: Colors.reports }]} />
          <View style={styles.header}>
            <Text style={styles.title}>تقرير مخصص</Text>
            <Pressable onPress={onClose}><MaterialIcons name="close" size={22} color={Colors.textSecondary} /></Pressable>
          </View>
          <View style={styles.body}>
            <View style={styles.row}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>من تاريخ</Text>
                <TextInput style={styles.input} value={fromStr} onChangeText={setFromStr} placeholder="2025-01-01" placeholderTextColor={Colors.textMuted} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} textAlign="center" />
              </View>
              <MaterialIcons name="arrow-back" size={20} color={Colors.textMuted} style={{ marginTop: 28 }} />
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>إلى تاريخ</Text>
                <TextInput style={styles.input} value={toStr} onChangeText={setToStr} placeholder="2025-12-31" placeholderTextColor={Colors.textMuted} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} textAlign="center" />
              </View>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.hint}>أدخل التواريخ بصيغة: YYYY-MM-DD</Text>
            <Pressable style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.85 }]} onPress={handleApply}>
              <MaterialIcons name="search" size={20} color={Colors.white} /><Text style={styles.applyText}>عرض التقرير</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  strip: { height: 4, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: 36, gap: Spacing.md },
  row: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: Spacing.sm },
  fieldWrap: { flex: 1, alignItems: 'flex-end' },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  input: { width: '100%', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600' },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  error: { fontSize: FontSize.xs, color: Colors.danger, textAlign: 'center' },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.reports, paddingVertical: 14, borderRadius: Radius.lg, gap: Spacing.sm, marginTop: Spacing.sm },
  applyText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
