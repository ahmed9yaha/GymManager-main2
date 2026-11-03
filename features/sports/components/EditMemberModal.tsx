// Powered by OnSpace.AI
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
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { Member, MemberUpdate, getMemberStatus } from '@/services/storage';

interface EditMemberModalProps {
  visible: boolean;
  member: Member | null;
  sportLabel: string;
  sportColor: string;
  onClose: () => void;
  onSave: (id: string, changes: MemberUpdate) => Promise<void>;
}

type EditableDateField = 'startDate' | 'endDate';
type FormErrors = Partial<Record<'name' | 'fee' | EditableDateField, string>>;

/** Render the stored ISO date as the app's day/month/year input format. */
function toDateInput(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parse a real calendar date and return its ISO representation. */
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

const STATUS_LABELS = {
  active: { label: 'نشط', color: Colors.success, icon: 'check-circle' as const },
  expiring: { label: 'ينتهي قريباً', color: Colors.warning, icon: 'warning' as const },
  expired: { label: 'منتهي', color: Colors.danger, icon: 'cancel' as const },
};

/** A reusable edit form. The status is derived from the end date, not stored separately. */
export function EditMemberModal({
  visible,
  member,
  sportLabel,
  sportColor,
  onClose,
  onSave,
}: EditMemberModalProps) {
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  // Reset the form each time a different member is opened for editing.
  useEffect(() => {
    if (!visible || !member) return;
    setName(member.name);
    setFee(String(member.fee));
    setPhone(member.phone ?? '');
    setPhoto(member.photo ?? null);
    setStartDate(toDateInput(member.startDate));
    setEndDate(toDateInput(member.endDate));
    setErrors({});
    setSaveError('');
  }, [visible, member]);

  const status = endDate ? getMemberStatus(parseDateInput(endDate) ?? '') : 'expired';
  const statusInfo = STATUS_LABELS[status];

  const handlePickImage = async () => {
    setPickingImage(true);
    try {
      const { status: permissionStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionStatus !== 'granted') {
        setSaveError('يرجى السماح بالوصول إلى الصور لاختيار صورة المشترك.');
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
        setSaveError('');
      }
    } catch (error) {
      console.warn('Unable to select a member photo:', error);
      setSaveError('تعذر اختيار الصورة. حاول مرة أخرى.');
    } finally {
      setPickingImage(false);
    }
  };

  const handleSave = async () => {
    if (!member || saving) return;

    const parsedStartDate = parseDateInput(startDate);
    const parsedEndDate = parseDateInput(endDate);
    const nextErrors: FormErrors = {};
    if (!name.trim()) nextErrors.name = 'الاسم مطلوب';
    if (!fee.trim() || !Number.isFinite(Number(fee)) || (member.isComplimentary ? Number(fee) !== 0 : Number(fee) <= 0)) {
      nextErrors.fee = 'أدخل قيمة مالية صحيحة';
    }
    if (!parsedStartDate) nextErrors.startDate = 'تاريخ غير صحيح (يوم/شهر/سنة)';
    if (!parsedEndDate) nextErrors.endDate = 'تاريخ غير صحيح (يوم/شهر/سنة)';
    if (parsedStartDate && parsedEndDate && new Date(parsedEndDate) < new Date(parsedStartDate)) {
      nextErrors.endDate = 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء';
    }
    setErrors(nextErrors);
    setSaveError('');
    if (Object.keys(nextErrors).length > 0 || !parsedStartDate || !parsedEndDate) return;

    setSaving(true);
    try {
      await onSave(member.id, {
        name: name.trim(),
        fee: Number(fee),
        phone: phone.trim() || undefined,
        photo: photo ?? undefined,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      });
      onClose();
    } catch (error) {
      console.error('Unable to update member:', error);
      setSaveError('تعذر حفظ التعديلات. تحقق من مساحة التخزين وحاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving && !pickingImage) onClose();
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
              <Text style={styles.title}>تعديل بيانات المشترك</Text>
              <Text style={[styles.subtitle, { color: sportColor }]}>{sportLabel}</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn} disabled={saving || pickingImage} accessibilityLabel="إغلاق">
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.photoPicker}>
                <Pressable
                  style={[styles.photoBtn, { borderColor: sportColor + '60' }]}
                  onPress={() => void handlePickImage()}
                  disabled={pickingImage || saving}
                  accessibilityRole="button"
                  accessibilityLabel={photo ? 'تغيير صورة المشترك' : 'اختيار صورة للمشترك'}
                >
                  {pickingImage ? (
                    <ActivityIndicator color={sportColor} />
                  ) : photo ? (
                    <Image source={{ uri: photo }} style={styles.photoPreview} contentFit="cover" transition={200} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <MaterialIcons name="add-a-photo" size={28} color={sportColor} />
                      <Text style={[styles.photoHint, { color: sportColor }]}>تغيير الصورة</Text>
                    </View>
                  )}
                </Pressable>
                {photo ? (
                  <View style={styles.photoActions}>
                    <Pressable style={styles.photoAction} onPress={() => void handlePickImage()} disabled={pickingImage || saving}>
                      <MaterialIcons name="photo-library" size={16} color={sportColor} />
                      <Text style={[styles.photoActionText, { color: sportColor }]}>تغيير الصورة</Text>
                    </Pressable>
                    <Pressable style={styles.photoAction} onPress={() => setPhoto(null)} disabled={pickingImage || saving}>
                      <MaterialIcons name="delete-outline" size={16} color={Colors.danger} />
                      <Text style={[styles.photoActionText, { color: Colors.danger }]}>إزالة الصورة</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.label}>حالة الاشتراك (تُحسب من تاريخ الانتهاء)</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18' }]}>
                  <MaterialIcons name={statusInfo.icon} size={15} color={statusInfo.color} />
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>اسم المشترك *</Text>
                <TextInput
                  style={[styles.input, errors.name ? styles.inputError : null]}
                  value={name}
                  onChangeText={setName}
                  placeholder="أدخل اسم المشترك"
                  placeholderTextColor={Colors.textMuted}
                  textAlign="right"
                  accessibilityLabel="اسم المشترك"
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>رقم الهاتف</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="رقم الهاتف"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  textAlign="right"
                  accessibilityLabel="رقم الهاتف"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>قيمة الاشتراك (ر.ي) *</Text>
                <TextInput
                  style={[styles.input, errors.fee ? styles.inputError : null]}
                  value={fee}
                  onChangeText={setFee}
                  placeholder="قيمة الاشتراك"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  textAlign="right"
                  editable={!member?.isComplimentary}
                  accessibilityLabel="قيمة الاشتراك"
                />
                {errors.fee ? <Text style={styles.errorText}>{errors.fee}</Text> : null}
              </View>

              <View style={styles.dateRow}>
                <View style={[styles.field, styles.dateField]}>
                  <Text style={styles.label}>تاريخ البدء *</Text>
                  <TextInput
                    style={[styles.input, errors.startDate ? styles.inputError : null]}
                    value={startDate}
                    onChangeText={(value) => setStartDate(formatDateInput(value))}
                    placeholder="يوم/شهر/سنة"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                    textAlign="right"
                    accessibilityLabel="تاريخ البدء"
                  />
                  {errors.startDate ? <Text style={styles.errorText}>{errors.startDate}</Text> : null}
                </View>
                <View style={[styles.field, styles.dateField]}>
                  <Text style={styles.label}>تاريخ الانتهاء *</Text>
                  <TextInput
                    style={[styles.input, errors.endDate ? styles.inputError : null]}
                    value={endDate}
                    onChangeText={(value) => setEndDate(formatDateInput(value))}
                    placeholder="يوم/شهر/سنة"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                    textAlign="right"
                    accessibilityLabel="تاريخ الانتهاء"
                  />
                  {errors.endDate ? <Text style={styles.errorText}>{errors.endDate}</Text> : null}
                </View>
              </View>
              <Text style={styles.hint}>صيغة التاريخ: يوم/شهر/سنة</Text>

              {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: sportColor }, pressed && !saving ? styles.pressed : null]}
                onPress={handleSave}
                disabled={saving || pickingImage}
                accessibilityRole="button"
              >
                {saving || pickingImage ? <ActivityIndicator color={Colors.white} /> : <MaterialIcons name="save" size={20} color={Colors.white} />}
                <Text style={styles.saveBtnText}>{pickingImage ? 'جارٍ اختيار الصورة...' : saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</Text>
              </Pressable>
              <View style={styles.bottomSpace} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  avoidContainer: { justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  header: { padding: Spacing.xl, borderBottomWidth: 1, position: 'relative' },
  headerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginTop: 8 },
  subtitle: { fontSize: FontSize.sm, fontWeight: '500', textAlign: 'right', marginTop: 2 },
  closeBtn: { position: 'absolute', left: Spacing.xl, top: Spacing.xl + 8, padding: 4 },
  form: { padding: Spacing.xl },
  photoPicker: { alignItems: 'center', marginBottom: Spacing.lg },
  photoBtn: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', gap: 4 },
  photoHint: { fontSize: FontSize.xs, fontWeight: '600' },
  photoActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.sm },
  photoAction: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  photoActionText: { fontSize: FontSize.xs, fontWeight: '600' },
  statusRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  statusText: { fontSize: FontSize.xs, fontWeight: '600' },
  field: { marginBottom: Spacing.lg },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, textAlign: 'right' },
  input: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary },
  inputError: { borderColor: Colors.danger },
  errorText: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4, textAlign: 'right' },
  dateRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  dateField: { flex: 1 },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right', marginTop: -Spacing.sm, marginBottom: Spacing.lg },
  saveError: { color: Colors.danger, fontSize: FontSize.sm, textAlign: 'right', marginBottom: Spacing.md },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.lg, gap: 8 },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  pressed: { opacity: 0.85 },
  bottomSpace: { height: 20 },
});