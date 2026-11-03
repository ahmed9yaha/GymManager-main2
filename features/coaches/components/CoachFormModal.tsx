import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { Coach, CoachGameKey, CoachInput } from '@/services/coaches';

export interface CoachGameOption {
  key: CoachGameKey;
  label: string;
  color: string;
}

interface CoachFormModalProps {
  visible: boolean;
  coach: Coach | null;
  gameOptions: CoachGameOption[];
  onClose: () => void;
  onSave: (input: CoachInput, id?: string) => Promise<void>;
}

function digitCount(value: string): number {
  const westernDigits = value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  return (westernDigits.match(/\d/g) ?? []).length;
}

export function CoachFormModal({ visible, coach, gameOptions, onClose, onSave }: CoachFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gameKey, setGameKey] = useState<CoachGameKey | null>(null);
  const [profitPercentage, setProfitPercentage] = useState('0');
  const [maxFreeMembers, setMaxFreeMembers] = useState('0');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(coach?.name ?? '');
    setPhone(coach?.phone ?? '');
    setGameKey(gameOptions.some((option) => option.key === coach?.gameKey)
      ? coach?.gameKey ?? null
      : gameOptions[0]?.key ?? null);
    setProfitPercentage(String(coach?.profitPercentage ?? 0));
    setMaxFreeMembers(String(coach?.maxFreeMembers ?? 0));
    setPhotoUri(coach?.photoUri ?? null);
    setError('');
  }, [visible, coach, gameOptions]);

  const selectedGame = gameOptions.find((option) => option.key === gameKey);
  const accent = selectedGame?.color ?? Colors.reports;

  const pickPhoto = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('إذن الصور مطلوب', 'اسمح بالوصول إلى الصور لاختيار صورة الكابتن من الجهاز.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]?.uri) setPhotoUri(result.assets[0].uri);
    } catch (pickerError) {
      console.warn('Unable to choose a coach photo:', pickerError);
      Alert.alert('تعذر اختيار الصورة', 'لم يتمكن التطبيق من فتح معرض الصور. حاول مرة أخرى.');
    } finally {
      setPickingImage(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    if (!normalizedName) return setError('يرجى إدخال اسم الكابتن.');
    const phoneDigits = digitCount(normalizedPhone);
    if (phoneDigits < 7 || phoneDigits > 15) return setError('أدخل رقم هاتف صحيحاً من 7 إلى 15 رقماً.');
    if (!selectedGame) return setError('اختر اللعبة أو الرياضة المسؤول عنها الكابتن.');
    const percentage = Number(profitPercentage);
    const freeMemberLimit = Number(maxFreeMembers);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return setError('أدخل نسبة أرباح بين 0 و100.');
    if (!Number.isInteger(freeMemberLimit) || freeMemberLimit < 0) return setError('أدخل حداً صحيحاً غير سالب للمشتركين مجاناً.');

    setSaving(true);
    setError('');
    try {
      await onSave({
        name: normalizedName,
        phone: normalizedPhone,
        gameKey: selectedGame.key,
        gameLabel: selectedGame.label,
        photoUri,
        profitPercentage: percentage,
        maxFreeMembers: freeMemberLimit,
      }, coach?.id);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ بيانات الكابتن على هذا الجهاز.');
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoid}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={[styles.strip, { backgroundColor: accent }]} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{coach ? 'تعديل بيانات الكابتن' : 'إضافة كابتن جديد'}</Text>
                <Text style={styles.subtitle}>تُحفظ البيانات والصورة على هذا الجهاز فقط</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" disabled={saving} onPress={handleClose} style={styles.close}>
                <MaterialIcons name="close" size={21} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.photoArea}>
                <Pressable accessibilityRole="button" accessibilityLabel="اختيار صورة الكابتن" onPress={() => void pickPhoto()} disabled={pickingImage || saving}
                  style={[styles.photoButton, { borderColor: `${accent}70` }]}>
                  {pickingImage ? <ActivityIndicator color={accent} /> : photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
                  ) : (
                    <View style={[styles.photoPlaceholder, { backgroundColor: `${accent}18` }]}>
                      <MaterialIcons name="add-a-photo" size={28} color={accent} />
                      <Text style={[styles.photoHint, { color: accent }]}>إضافة صورة</Text>
                    </View>
                  )}
                </Pressable>
                {photoUri ? <Pressable onPress={() => setPhotoUri(null)} style={styles.removePhoto}>
                  <MaterialIcons name="delete-outline" size={16} color={Colors.danger} />
                  <Text style={styles.removePhotoText}>إزالة الصورة</Text>
                </Pressable> : null}
              </View>

              <Text style={styles.label}>اسم الكابتن *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="أدخل اسم الكابتن" placeholderTextColor={Colors.textMuted}
                textAlign="right" maxLength={80} style={styles.input} accessibilityLabel="اسم الكابتن" />

              <Text style={styles.label}>رقم الهاتف *</Text>
              <TextInput value={phone} onChangeText={setPhone} placeholder="مثال: 0777123456" placeholderTextColor={Colors.textMuted}
                textAlign="right" keyboardType="phone-pad" maxLength={24} style={styles.input} accessibilityLabel="رقم الهاتف" />

              <Text style={styles.label}>اللعبة المسؤول عنها *</Text>
              <View style={styles.options}>
                {gameOptions.map((option) => {
                  const selected = option.key === gameKey;
                  return (
                    <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                      onPress={() => setGameKey(option.key)}
                      style={[styles.option, selected && { borderColor: option.color, backgroundColor: `${option.color}18` }]}>
                      <MaterialIcons name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={18} color={selected ? option.color : Colors.textMuted} />
                      <Text style={[styles.optionText, selected && { color: option.color }]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Coach Profit Percentage / نسبة أرباح الكابتن</Text>
              <TextInput value={profitPercentage} onChangeText={setProfitPercentage} placeholder="مثال: 20" placeholderTextColor={Colors.textMuted}
                textAlign="right" keyboardType="numeric" maxLength={5} style={styles.input} accessibilityLabel="نسبة أرباح الكابتن بالمئة" />
              <Text style={styles.label}>Max Free Members / الحد الأقصى للمشتركين مجاناً</Text>
              <TextInput value={maxFreeMembers} onChangeText={setMaxFreeMembers} placeholder="مثال: 3" placeholderTextColor={Colors.textMuted}
                textAlign="right" keyboardType="number-pad" maxLength={5} style={styles.input} accessibilityLabel="الحد الأقصى للمشتركين مجاناً" />

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={saving || pickingImage} onPress={() => void handleSave()}
                style={[styles.saveButton, { backgroundColor: accent }, (saving || pickingImage) && styles.disabled]}>
                {saving ? <ActivityIndicator color={Colors.white} /> : <MaterialIcons name="save" size={19} color={Colors.white} />}
                <Text style={styles.saveText}>{saving ? 'جارٍ الحفظ…' : coach ? 'حفظ التعديلات' : 'إضافة الكابتن'}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'flex-end' },
  avoid: { width: '100%', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  strip: { height: 4, marginHorizontal: -Spacing.xl },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  headerCopy: { flex: 1, alignItems: 'flex-end' },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'right' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 3, textAlign: 'right' },
  close: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  photoArea: { alignItems: 'center', marginBottom: Spacing.sm },
  photoButton: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoHint: { fontSize: FontSize.xs, fontWeight: '700' },
  removePhoto: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, padding: Spacing.xs, marginTop: 3 },
  removePhotoText: { color: Colors.danger, fontSize: FontSize.xs },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right', marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { color: Colors.textPrimary, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md, textAlign: 'right' },
  options: { gap: Spacing.xs },
  option: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  optionText: { flex: 1, color: Colors.textSecondary, textAlign: 'right', fontSize: FontSize.sm, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: FontSize.sm, textAlign: 'right', marginTop: Spacing.md },
  saveButton: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, marginTop: Spacing.lg, marginBottom: Spacing.md },
  saveText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
