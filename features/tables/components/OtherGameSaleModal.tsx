import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { OtherGame } from '@/services/tableGames';

interface OtherGameSaleModalProps {
  game: OtherGame | null;
  onClose: () => void;
  onSave: (values: { totalAmount: number; amountPaid: number; debtorName: string; debtorPhone: string }) => Promise<void>;
}

export function OtherGameSaleModal({ game, onClose, onSave }: OtherGameSaleModalProps) {
  const [totalAmount, setTotalAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [debtorName, setDebtorName] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!game) return;
    setTotalAmount(String(game.defaultRate));
    setAmountPaid(String(game.defaultRate));
    setDebtorName('');
    setDebtorPhone('');
    setError('');
  }, [game]);

  const due = Math.max(0, (Number(totalAmount) || 0) - (Number(amountPaid) || 0));
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave({ totalAmount: Number(totalAmount), amountPaid: Number(amountPaid), debtorName, debtorPhone });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تسجيل العملية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!game} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>تسجيل تحصيل — {game?.name}</Text>
          <TextInput style={styles.input} value={totalAmount} onChangeText={setTotalAmount} placeholder="المبلغ الإجمالي" placeholderTextColor={Colors.textMuted} keyboardType="numeric" textAlign="right" />
          <TextInput style={styles.input} value={amountPaid} onChangeText={setAmountPaid} placeholder="المبلغ المدفوع كاش" placeholderTextColor={Colors.textMuted} keyboardType="numeric" textAlign="right" />
          {due > 0 ? <>
            <Text style={styles.due}>المتبقي دين: {due.toLocaleString('ar-SA')} ر.ي</Text>
            <TextInput style={styles.input} value={debtorName} onChangeText={setDebtorName} placeholder="اسم المدين" placeholderTextColor={Colors.textMuted} textAlign="right" />
            <TextInput style={styles.input} value={debtorPhone} onChangeText={setDebtorPhone} placeholder="رقم الهاتف" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" textAlign="right" />
          </> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.actionText}>إلغاء</Text></Pressable>
            <Pressable style={styles.submit} disabled={saving} onPress={() => void submit()}><Text style={styles.actionText}>{saving ? 'جارٍ الحفظ…' : 'حفظ التحصيل'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: Spacing.xl },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'right', marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: FontSize.sm },
  due: { color: Colors.warning, textAlign: 'right', fontWeight: '700' },
  error: { color: Colors.danger, textAlign: 'right', fontSize: FontSize.xs },
  actions: { flexDirection: 'row-reverse', gap: Spacing.sm, marginTop: Spacing.sm },
  cancel: { flex: 1, borderRadius: Radius.md, backgroundColor: Colors.border, alignItems: 'center', padding: Spacing.md },
  submit: { flex: 1.5, borderRadius: Radius.md, backgroundColor: Colors.reports, alignItems: 'center', padding: Spacing.md },
  actionText: { color: Colors.white, fontWeight: '700' },
});
