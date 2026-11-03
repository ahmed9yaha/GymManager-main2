// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import type { Coach } from '@/services/coaches';

interface AddMemberModalProps {
  visible: boolean;
  sportLabel: string;
  sportColor: string;
  coach: Coach | undefined;
  currentFreeMemberCount: number;
  onClose: () => void;
  onAdd: (data: { name: string; fee: number; phone?: string; photo?: string; startDate: string; endDate: string; coachId?: string; isComplimentary?: boolean }) => Promise<void> | void;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function parseDateInput(value: string): string | null {
  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length < 4) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function AddMemberModal({ visible, sportLabel, sportColor, coach, currentFreeMemberCount, onClose, onAdd }: AddMemberModalProps) {
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [pickingImage, setPickingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = 'الاسم مطلوب';
    if (!isComplimentary && (!fee || isNaN(Number(fee)) || Number(fee) <= 0)) newErrors.fee = 'قيمة مالية صحيحة مطلوبة';
    if (isComplimentary && (!coach || currentFreeMemberCount >= coach.maxFreeMembers)) {
      newErrors.freeMember = 'اكتمل الحد الأقصى للمشتركين مجاناً لهذا الكابتن.';
    }
    if (!parseDateInput(startDate)) newErrors.startDate = 'تاريخ غير صحيح (يوم/شهر/سنة)';
    if (!parseDateInput(endDate)) newErrors.endDate = 'تاريخ غير صحيح (يوم/شهر/سنة)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmissionError('');
    try {
      await onAdd({
        name: name.trim(),
        fee: isComplimentary ? 0 : Number(fee),
        phone: phone.trim() || undefined,
        photo: photo || undefined,
        startDate: parseDateInput(startDate)!,
        endDate: parseDateInput(endDate)!,
        coachId: coach?.id,
        isComplimentary,
      });
      resetForm();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'تعذر حفظ الاشتراك والتحصيل محلياً.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setFee('');
    setIsComplimentary(false);
    setPhone('');
    setPhoto(null);
    setStartDate('');
    setEndDate('');
    setErrors({});
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  const handlePickImage = async () => {
    setPickingImage(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setPickingImage(false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Image pick error:', e);
    }
    setPickingImage(false);
  };

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const nextMonthStr = `${String(nextMonth.getDate()).padStart(2, '0')}/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;

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
              <Text style={styles.title}>إضافة مشترك جديد</Text>
              <Text style={[styles.subtitle, { color: sportColor }]}>{sportLabel}</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>

              {/* Photo Picker */}
              <View style={styles.photoPicker}>
                <Pressable
                  style={({ pressed }) => [
                    styles.photoBtn,
                    { borderColor: sportColor + '60' },
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={handlePickImage}
                  disabled={pickingImage}
                >
                  {pickingImage ? (
                    <ActivityIndicator color={sportColor} />
                  ) : photo ? (
                    <Image
                      source={{ uri: photo }}
                      style={styles.photoPreview}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <MaterialIcons name="add-a-photo" size={28} color={sportColor} />
                      <Text style={[styles.photoPlaceholderText, { color: sportColor }]}>صورة شخصية</Text>
                    </View>
                  )}
                </Pressable>
                {photo ? (
                  <Pressable style={styles.removePhotoBtn} onPress={() => setPhoto(null)}>
                    <MaterialIcons name="close" size={14} color={Colors.danger} />
                    <Text style={styles.removePhotoText}>حذف الصورة</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>اسم المشترك *</Text>
                <TextInput
                  style={[styles.input, errors.name ? styles.inputError : null]}
                  placeholder="أدخل اسم المشترك"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  textAlign="right"
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>رقم الهاتف</Text>
                <TextInput
                  style={styles.input}
                  placeholder="مثال: 0777123456"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  textAlign="right"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>قيمة الاشتراك (ر.ي) *</Text>
                <TextInput
                  style={[styles.input, errors.fee ? styles.inputError : null]}
                  placeholder="مثال: 5000"
                  placeholderTextColor={Colors.textMuted}
                  value={isComplimentary ? '0' : fee}
                  onChangeText={setFee}
                  keyboardType="numeric"
                  textAlign="right"
                  editable={!isComplimentary}
                />
                {!isComplimentary && errors.fee ? <Text style={styles.errorText}>{errors.fee}</Text> : null}
              </View>

              {coach ? (
                <View style={styles.field}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isComplimentary }}
                    onPress={() => setIsComplimentary((checked) => !checked)} style={styles.freeMemberToggle}>
                    <MaterialIcons name={isComplimentary ? 'check-box' : 'check-box-outline-blank'} size={22} color={sportColor} />
                    <Text style={styles.freeMemberLabel}>Free Member via Coach / مشترك مجاني من قِبل الكابتن</Text>
                  </Pressable>
                  <Text style={styles.hint}>المتاح: {Math.max(0, coach.maxFreeMembers - currentFreeMemberCount)} من {coach.maxFreeMembers}</Text>
                  {errors.freeMember ? <Text style={styles.errorText}>{errors.freeMember}</Text> : null}
                </View>
              ) : null}

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1, marginLeft: Spacing.sm }]}>
                  <Text style={styles.label}>تاريخ البدء *</Text>
                  <TextInput
                    style={[styles.input, errors.startDate ? styles.inputError : null]}
                    placeholder={todayStr}
                    placeholderTextColor={Colors.textMuted}
                    value={startDate}
                    onChangeText={(t) => setStartDate(formatDateInput(t))}
                    keyboardType="numeric"
                    maxLength={10}
                    textAlign="right"
                  />
                  {errors.startDate ? <Text style={styles.errorText}>{errors.startDate}</Text> : null}
                </View>

                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>تاريخ الانتهاء *</Text>
                  <TextInput
                    style={[styles.input, errors.endDate ? styles.inputError : null]}
                    placeholder={nextMonthStr}
                    placeholderTextColor={Colors.textMuted}
                    value={endDate}
                    onChangeText={(t) => setEndDate(formatDateInput(t))}
                    keyboardType="numeric"
                    maxLength={10}
                    textAlign="right"
                  />
                  {errors.endDate ? <Text style={styles.errorText}>{errors.endDate}</Text> : null}
                </View>
              </View>

              <Text style={styles.hint}>الصيغة: يوم/شهر/سنة (مثال: 04/10/2026)</Text>

              {submissionError ? <Text style={styles.errorText}>{submissionError}</Text> : null}
              <Pressable
                style={({ pressed }) => [
                  styles.addBtn,
                  { backgroundColor: sportColor },
                  pressed && { opacity: 0.85 },
                  saving && { opacity: 0.7 },
                ]}
                onPress={() => void handleAdd()}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={Colors.white} /> : <MaterialIcons name="person-add" size={20} color={Colors.white} />}
                <Text style={styles.addBtnText}>{saving ? 'جارٍ الحفظ...' : 'إضافة المشترك'}</Text>
              </Pressable>

              <View style={{ height: 20 }} />
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  header: {
    padding: Spacing.xl,
    borderBottomWidth: 1,
    position: 'relative',
  },
  headerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
    marginTop: 8,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 2,
  },
  closeBtn: {
    position: 'absolute',
    left: Spacing.xl,
    top: Spacing.xl + 8,
    padding: 4,
  },
  form: {
    padding: Spacing.xl,
  },
  photoPicker: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  photoBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  photoPlaceholderText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  removePhotoText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  freeMemberToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  freeMemberLabel: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'right' },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: 4,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row-reverse',
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginBottom: Spacing.xl,
    marginTop: -Spacing.sm,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    gap: 8,
  },
  addBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
