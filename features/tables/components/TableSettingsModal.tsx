// Powered by OnSpace.AI
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { GameSettings, OtherGame } from '@/services/tableGames';
import { persistAlarmSound } from '@/services/tableGames';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';

const BILLIARDS_COLOR = '#F97316';
const TT_COLOR = '#06B6D4';
const OTHER_GAME_COLORS = ['#8B5CF6', '#22C55E', '#EC4899', '#F59E0B', '#3B82F6'];

type DraftSetting = { hourlyRate: string; customSoundUri?: string };
type SettingsCategory = {
  key: string;
  label: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  hourlyRate: number;
  customSoundUri?: string;
};

interface TableSettingsModalProps {
  visible: boolean;
  settings: GameSettings;
  otherGames: OtherGame[];
  onClose: () => void;
  onSave: (settings: GameSettings) => void | Promise<void>;
}

export function TableSettingsModal({
  visible,
  settings,
  otherGames,
  onClose,
  onSave,
}: TableSettingsModalProps) {
  const [draft, setDraft] = useState<Record<string, DraftSetting>>({});
  const [testingSound, setTestingSound] = useState<string | null>(null);
  const [activeSoundRef, setActiveSoundRef] = useState<Audio.Sound | null>(null);
  const [saving, setSaving] = useState(false);

  const categories: SettingsCategory[] = [
    {
      key: 'billiards', label: 'البلياردو', color: BILLIARDS_COLOR,
      icon: 'sports-esports', hourlyRate: settings.billiards.hourlyRate,
      customSoundUri: settings.billiards.customSoundUri,
    },
    {
      key: 'tabletennis', label: 'تنس الطاولة', color: TT_COLOR,
      icon: 'sports-tennis', hourlyRate: settings.tabletennis.hourlyRate,
      customSoundUri: settings.tabletennis.customSoundUri,
    },
    ...otherGames.map((game, index) => ({
      key: `other:${game.id}`,
      label: game.name,
      color: OTHER_GAME_COLORS[index % OTHER_GAME_COLORS.length],
      icon: 'videogame-asset' as const,
      hourlyRate: settings.otherGames[game.id]?.hourlyRate ?? game.defaultRate,
      customSoundUri: settings.otherGames[game.id]?.customSoundUri,
    })),
  ];

  useEffect(() => {
    if (visible) {
      setDraft(Object.fromEntries(categories.map((category) => [category.key, {
        hourlyRate: String(category.hourlyRate),
        customSoundUri: category.customSoundUri,
      }])));
    }
  }, [visible, settings, otherGames]);

  const updateCategory = (key: string, changes: Partial<DraftSetting>) => {
    setDraft((current) => ({
      ...current,
      [key]: { ...current[key], ...changes },
    }));
  };

  const pickSound = async (key: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const supportedAudio = /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(asset.name)
          || asset.mimeType?.startsWith('audio/');
        if (!supportedAudio) {
          Alert.alert('ملف غير مدعوم', 'يرجى اختيار ملف صوتي مثل MP3 أو WAV.');
          return;
        }
        const uri = await persistAlarmSound(asset.uri, asset.name);
        updateCategory(key, { customSoundUri: uri });
      }
    } catch {
      Alert.alert('تعذر اختيار الصوت', 'لم نتمكن من حفظ الملف الصوتي على هذا الجهاز.');
    }
  };

  const testSound = async (key: string) => {
    if (testingSound) return;
    setTestingSound(key);
    try {
      if (activeSoundRef) {
        try { await activeSoundRef.unloadAsync(); } catch {}
        setActiveSoundRef(null);
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const uri = draft[key]?.customSoundUri;
      if (uri) {
        const { sound } = await Audio.Sound.createAsync({ uri });
        setActiveSoundRef(sound);
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setTestingSound(null);
            setActiveSoundRef(null);
          }
        });
      }
    } catch {
      setTestingSound(null);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const otherGameSettings = { ...settings.otherGames };
      for (const game of otherGames) {
        const value = draft[`other:${game.id}`];
        const rate = Number(value?.hourlyRate);
        otherGameSettings[game.id] = {
          hourlyRate: Number.isFinite(rate) && rate > 0
            ? rate : (settings.otherGames[game.id]?.hourlyRate ?? game.defaultRate),
          customSoundUri: value?.customSoundUri,
        };
      }
      await onSave({
        billiards: {
          hourlyRate: Number(draft.billiards?.hourlyRate) > 0
            ? Number(draft.billiards.hourlyRate) : settings.billiards.hourlyRate,
          tableCount: settings.billiards.tableCount,
          customSoundUri: draft.billiards?.customSoundUri,
        },
        tabletennis: {
          hourlyRate: Number(draft.tabletennis?.hourlyRate) > 0
            ? Number(draft.tabletennis.hourlyRate) : settings.tabletennis.hourlyRate,
          tableCount: settings.tabletennis.tableCount,
          customSoundUri: draft.tabletennis?.customSoundUri,
        },
        otherGames: otherGameSettings,
      });
      onClose();
    } catch {
      Alert.alert('تعذر حفظ الإعدادات', 'تحقق من مساحة التخزين وحاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoidWrap}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={[styles.strip, { backgroundColor: Colors.reports }]} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>إعدادات الألعاب</Text>
                <Text style={[styles.subtitle, { color: Colors.reports }]}>
                  الأسعار الافتراضية وأصوات التنبيه
                </Text>
                <Text style={styles.audioNote}>
                  الصوت الذي تختاره يعمل داخل التطبيق. عند قفل الجهاز أو إغلاق التطبيق، يستخدم النظام نغمة التنبيه المضمنة (20 ثانية)؛ لا يستطيع Expo تشغيل ملف مختار من الهاتف كصوت إشعار.
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

              {categories.map((category) => {
                const value = draft[category.key] ?? {
                  hourlyRate: String(category.hourlyRate),
                  customSoundUri: category.customSoundUri,
                };
                return (
                  <View key={category.key} style={[styles.section, { borderColor: `${category.color}30` }]}>
                    <View style={styles.sectionHeader}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: `${category.color}20` }]}>
                        <MaterialIcons name={category.icon} size={18} color={category.color} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: category.color }]}>{category.label}</Text>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>السعر الافتراضي للساعة (ر.ي)</Text>
                        <TextInput
                          style={[styles.input, { borderColor: `${category.color}40` }]}
                          value={value.hourlyRate}
                          onChangeText={(hourlyRate) => updateCategory(category.key, { hourlyRate })}
                          keyboardType="numeric"
                          textAlign="center"
                          placeholder={String(category.hourlyRate)}
                          placeholderTextColor={Colors.textMuted}
                        />
                      </View>
                    </View>

                    <View style={[styles.soundRow, { borderColor: `${category.color}30` }]}>
                      <View style={styles.soundInfo}>
                        <Text style={styles.soundLabel}>صوت التنبيه</Text>
                        <Text style={[styles.soundName, { color: value.customSoundUri ? Colors.reports : Colors.textMuted }]}>
                          {value.customSoundUri ? 'صوت مخصص محدد ✓' : 'الصوت الافتراضي (إشعار)'}
                        </Text>
                      </View>
                      <View style={styles.soundBtns}>
                        {value.customSoundUri ? (
                          <>
                            <Pressable style={[styles.soundBtn, { backgroundColor: Colors.reportsDim, borderColor: `${Colors.reports}40` }]}
                              onPress={() => void testSound(category.key)}>
                              {testingSound === category.key
                                ? <ActivityIndicator size="small" color={Colors.reports} />
                                : <MaterialIcons name="volume-up" size={16} color={Colors.reports} />}
                            </Pressable>
                            <Pressable style={[styles.soundBtn, { backgroundColor: Colors.statRedDim, borderColor: `${Colors.danger}40` }]}
                              onPress={() => updateCategory(category.key, { customSoundUri: undefined })}>
                              <MaterialIcons name="close" size={16} color={Colors.danger} />
                            </Pressable>
                          </>
                        ) : null}
                        <Pressable style={[styles.soundBtn, { backgroundColor: `${category.color}20`, borderColor: `${category.color}40` }]}
                          onPress={() => void pickSound(category.key)}>
                          <MaterialIcons name="audio-file" size={16} color={category.color} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}

              <Pressable
                style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.85 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color={Colors.white} /> : (
                  <MaterialIcons name="save" size={20} color={Colors.white} />
                )}
                <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</Text>
              </Pressable>

              <View style={{ height: 28 }} />
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
  avoidWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
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
    marginTop: 2,
    textAlign: 'right',
  },
  audioNote: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: Spacing.xl },
  section: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  inputLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'right',
  },
  input: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  soundRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  soundInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  soundLabel: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  soundName: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  soundBtns: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  soundBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.reports,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
