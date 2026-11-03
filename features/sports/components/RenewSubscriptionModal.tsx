import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { Member } from '@/services/storage';

interface RenewSubscriptionModalProps {
  visible: boolean;
  member: Member | null;
  sportColor: string;
  onClose: () => void;
  onRenew: (id: string, dates: { startDate: string; endDate: string }, amount: number) => Promise<void>;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function parseDateInput(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
}

function getDefaultDates() {
  const today = new Date();
  const nextMonthLastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
  const end = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    Math.min(today.getDate(), nextMonthLastDay)
  );
  const toInput = (date: Date) =>
    `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  return { startDate: toInput(today), endDate: toInput(end) };
}

export function RenewSubscriptionModal({
  visible,
  member,
  sportColor,
  onClose,
  onRenew,
}: RenewSubscriptionModalProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      const defaults = getDefaultDates();
      setStartDate(defaults.startDate);
      setEndDate(defaults.endDate);
      setAmount(member ? String(member.fee) : '');
      setError('');
      setSaving(false);
    }
  }, [visible, member?.id]);

  const handleRenew = async () => {
    if (!member) return;
    const parsedStart = parseDateInput(startDate);
    const parsedEnd = parseDateInput(endDate);
    if (!parsedStart || !parsedEnd) {
      setError('يرجى إدخال تاريخ صحيح بالصيغة يوم/شهر/سنة');
      return;
    }
    const collectedAmount = Number(amount);
    if (!Number.isFinite(collectedAmount) || collectedAmount < 0) {
      setError('يرجى إدخال مبلغ تحصيل صحيح (صفر أو أكثر)');
      return;
    }
    if (new Date(parsedEnd).getTime() <= new Date(parsedStart).getTime()) {
      setError('يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onRenew(member.id, { startDate: parsedStart, endDate: parsedEnd }, collectedAmount);
      onClose();
    } catch {
      setError('تعذر تجديد الاشتراك. يرجى المحاولة مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoidContainer}
        >
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={[styles.header, { borderBottomColor: sportColor + '40' }]}>
              <View style={[styles.headerAccent, { backgroundColor: sportColor }]} />
              <Text style={styles.title}>تجديد الاشتراك</Text>
              <Text style={[styles.subtitle, { color: sportColor }]}>{member?.name}</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn} disabled={saving}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={styles.hint}>حدد تاريخ بدء وانتهاء الاشتراك الجديد</Text>
              <Text style={styles.label}>المبلغ المحصل (ر.ي)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                value={amount}
                onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                textAlign="right"
                editable={!saving}
              />
              <View style={styles.row}>
                <View style={[styles.field, { flex: 1, marginLeft: Spacing.sm }]}>
                  <Text style={styles.label}>تاريخ البدء *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="يوم/شهر/سنة"
                    placeholderTextColor={Colors.textMuted}
                    value={startDate}
                    onChangeText={(value) => setStartDate(formatDateInput(value))}
                    keyboardType="numeric"
                    maxLength={10}
                    textAlign="right"
                    editable={!saving}
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>تاريخ الانتهاء *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="يوم/شهر/سنة"
                    placeholderTextColor={Colors.textMuted}
                    value={endDate}
                    onChangeText={(value) => setEndDate(formatDateInput(value))}
                    keyboardType="numeric"
                    maxLength={10}
                    textAlign="right"
                    editable={!saving}
                  />
                </View>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                style={({ pressed }) => [
                  styles.renewBtn,
                  { backgroundColor: sportColor },
                  pressed && { opacity: 0.85 },
                  saving && styles.disabledBtn,
                ]}
                onPress={handleRenew}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <MaterialIcons name="autorenew" size={20} color={Colors.white} />
                )}
                <Text style={styles.renewBtnText}>{saving ? 'جارٍ التجديد...' : 'تجديد الاشتراك'}</Text>
              </Pressable>
              <View style={{ height: Spacing.lg }} />
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  avoidContainer: {
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerAccent: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    padding: 4,
  },
  form: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    minHeight: 46,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  renewBtn: {
    minHeight: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  renewBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
