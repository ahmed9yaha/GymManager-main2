import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { MartialArtsGame } from '@/services/tableGames';

const COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];
const ICONS = ['boxing-glove', 'karate', 'sword-cross', 'shield-sword', 'arm-flex', 'meditation', 'run', 'weight-lifter', 'trophy'] as const;

interface MartialArtsGameModalProps {
  visible: boolean;
  game: MartialArtsGame | null;
  onClose: () => void;
  onSave: (values: Omit<MartialArtsGame, 'id' | 'type'>, id?: string) => Promise<void>;
}

export function MartialArtsGameModal({ visible, game, onClose, onSave }: MartialArtsGameModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState<string>(ICONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(game?.name ?? '');
    setColor(game?.color ?? COLORS[0]);
    setIcon(game?.icon ?? ICONS[0]);
    setError('');
  }, [visible, game]);

  const save = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) return setError('يرجى إدخال اسم اللعبة القتالية.');
    setSaving(true);
    setError('');
    try {
      await onSave({ name: normalizedName, color, icon }, game?.id);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ اللعبة القتالية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoid}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={[styles.strip, { backgroundColor: color }]} />
            <View style={styles.header}>
              <View style={styles.headerIcon}><MaterialCommunityIcons name={icon as never} size={26} color={color} /></View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{game ? 'تعديل لعبة قتالية' : 'إضافة لعبة قتالية'}</Text>
                <Text style={styles.subtitle}>الألعاب القتالية تظهر في إدارة المشتركين وقائمة الكابتن</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={styles.close}>
                <MaterialIcons name="close" size={21} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>اسم اللعبة *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="مثال: تايكوندو" placeholderTextColor={Colors.textMuted} style={styles.input} maxLength={50} textAlign="right" />
              <Text style={styles.label}>لون الهوية</Text>
              <View style={styles.palette}>
                {COLORS.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: color === item }} accessibilityLabel={`لون ${item}`} onPress={() => setColor(item)} style={[styles.colorOption, { backgroundColor: item, borderColor: color === item ? Colors.white : 'transparent' }]} />)}
              </View>
              <Text style={styles.label}>الأيقونة</Text>
              <View style={styles.iconGrid}>
                {ICONS.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: icon === item }} accessibilityLabel={`أيقونة ${item}`} onPress={() => setIcon(item)} style={[styles.iconOption, icon === item && { borderColor: color, backgroundColor: `${color}20` }]}><MaterialCommunityIcons name={item as never} size={25} color={icon === item ? color : Colors.textSecondary} /></Pressable>)}
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.saveButton, { backgroundColor: color }, saving && styles.disabled]}>
                <Text style={styles.saveText}>{saving ? 'جارٍ الحفظ…' : game ? 'حفظ التعديلات' : 'إضافة اللعبة القتالية'}</Text>
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
  sheet: { maxHeight: '90%', backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  strip: { height: 4, marginHorizontal: -Spacing.xl },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  headerIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  headerCopy: { flex: 1, alignItems: 'flex-end' },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'right' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 3 },
  close: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right', marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { color: Colors.textPrimary, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md, textAlign: 'right' },
  palette: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, paddingVertical: Spacing.sm },
  colorOption: { width: 32, height: 32, borderRadius: Radius.full, borderWidth: 2 },
  iconGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  iconOption: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  error: { color: Colors.danger, fontSize: FontSize.sm, textAlign: 'right', marginTop: Spacing.md },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, marginTop: Spacing.lg },
  saveText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
