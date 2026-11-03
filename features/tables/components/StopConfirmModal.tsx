import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { GameType } from '@/services/tableGames';

export interface StopConfirmModalProps {
  visible: boolean;
  tableNumber: number;
  tableName?: string;
  gameType: GameType;
  gameLabel?: string;
  color: string;
  finalCost: number;
  onCancel: () => void;
  amountPaid: string;
  debtorName: string;
  debtorPhone: string;
  onAmountPaidChange: (value: string) => void;
  onDebtorNameChange: (value: string) => void;
  onDebtorPhoneChange: (value: string) => void;
  onConfirm: () => void;
}

export function StopConfirmModal({
  visible,
  tableNumber,
  tableName,
  gameType,
  gameLabel: customGameLabel,
  color,
  finalCost,
  amountPaid,
  debtorName,
  debtorPhone,
  onAmountPaidChange,
  onDebtorNameChange,
  onDebtorPhoneChange,
  onCancel,
  onConfirm,
}: StopConfirmModalProps) {
  const gameLabel = customGameLabel ?? (gameType === 'billiards' ? 'بلياردو' : gameType === 'tabletennis' ? 'تنس الطاولة' : 'ألعاب أخرى');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.strip, { backgroundColor: Colors.danger }]} />
          <View style={styles.body}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.danger + '20' }]}>
              <MaterialIcons name="stop-circle" size={40} color={Colors.danger} />
            </View>
            <Text style={styles.title}>إيقاف الجلسة</Text>
            <Text style={styles.subtitle}>{tableName || `طاولة ${tableNumber}`} — {gameLabel}</Text>
            <View style={[styles.costBox, { backgroundColor: color + '15', borderColor: color + '40' }]}>
              <MaterialIcons name="payments" size={20} color={color} />
              <View style={styles.costTextWrap}>
                <Text style={[styles.costLabel, { color: Colors.textSecondary }]}>المبلغ المستحق</Text>
                <Text style={[styles.costValue, { color }]}>{finalCost.toLocaleString('ar-SA')} ريال يمني</Text>
              </View>
            </View>
            <TextInput style={styles.input} value={amountPaid} onChangeText={(value) => onAmountPaidChange(value.replace(/[^0-9]/g, ''))} placeholder="المبلغ المدفوع كاش" placeholderTextColor={Colors.textMuted} keyboardType="numeric" textAlign="right" />
            {Math.max(0, finalCost - (Number(amountPaid) || 0)) > 0 ? <>
              <Text style={styles.dueText}>المتبقي (يمكن تسجيله كدين أو تسويته كخصم): {Math.max(0, finalCost - (Number(amountPaid) || 0)).toLocaleString('ar-SA')} ر.ي</Text>
              <TextInput style={styles.input} value={debtorName} onChangeText={onDebtorNameChange} placeholder="اسم المدين (اختياري)" placeholderTextColor={Colors.textMuted} textAlign="right" />
              <TextInput style={styles.input} value={debtorPhone} onChangeText={onDebtorPhoneChange} placeholder="رقم الهاتف (اختياري)" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" textAlign="right" />
            </> : null}
            <Text style={styles.note}>سيُضاف هذا المبلغ إلى تقارير اليوم تلقائياً</Text>
            <View style={styles.actions}>
              <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.75 }]} onPress={onCancel}><Text style={styles.cancelText}>إلغاء</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]} onPress={onConfirm}>
                <MaterialIcons name="check" size={18} color={Colors.white} /><Text style={styles.confirmText}>تأكيد الإيقاف</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, width: '100%', overflow: 'hidden' },
  strip: { height: 4 },
  body: { padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md },
  iconWrap: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  costBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl, marginVertical: Spacing.sm, width: '100%' },
  costTextWrap: { flex: 1, alignItems: 'flex-end' },
  costLabel: { fontSize: FontSize.xs, marginBottom: 3 },
  costValue: { fontSize: FontSize.xxl, fontWeight: '800' },
  note: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  input: { width: '100%', backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, paddingVertical: 11, paddingHorizontal: Spacing.md, color: Colors.textPrimary, fontSize: FontSize.sm },
  dueText: { width: '100%', textAlign: 'right', color: Colors.warning, fontSize: FontSize.sm, fontWeight: '700' },
  actions: { flexDirection: 'row-reverse', gap: Spacing.md, marginTop: Spacing.sm, width: '100%' },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.card },
  cancelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  confirmBtn: { flex: 1.5, flexDirection: 'row', paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  confirmText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
