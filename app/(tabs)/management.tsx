// Powered by OnSpace.AI
import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTableGames } from '@/hooks/useTableGames';
import { CoreGameType, ManagedTable, MartialArtsGame, OtherGame, OtherGamePricingType } from '@/services/tableGames';
import { exportComprehensiveWorkbook } from '@/services/reporting';
import { PurgeMode, purgeLocalData } from '@/services/storage';
import { useGym } from '@/hooks/useGym';
import { useShift } from '@/contexts/ShiftContext';
import { useCoaches } from '@/features/coaches/hooks/useCoaches';
import { CoachFormModal, CoachGameOption } from '@/features/coaches/components/CoachFormModal';
import type { Coach, CoachInput } from '@/services/coaches';
import { useAlert } from '@/contexts/AlertContext';
import { getSportOptions } from '@/features/sports/sportConfig';
import { MartialArtsGameModal } from '@/features/sports/components/MartialArtsGameModal';

const BILLIARDS_COLOR = '#F97316';
const TENNIS_COLOR = '#06B6D4';
const ADMIN_PURGE_PASSWORD = '12345678';

type TableDraft = { id?: string; name: string; gameType: CoreGameType; hourlyRate: string };
type GameDraft = { id?: string; name: string; pricingType: OtherGamePricingType; defaultRate: string };

export default function ManagementScreen() {
  const insets = useSafeAreaInsets();
  const {
    tables, otherGames, settings, configurationLoaded,
    sessions, records, refreshAfterPurge: refreshGames,
    addTable, updateTable, deleteTable, addOtherGame, updateOtherGame, deleteOtherGame,
    martialArtsGames, addMartialArtsGame, updateMartialArtsGame, deleteMartialArtsGame,
  } = useTableGames();
  const { members, refreshAll } = useGym();
  const { coaches, addCoach, updateCoach, removeCoach, removeCoachForGame, refreshCoaches } = useCoaches();
  const { activeShift, closedShifts, refreshAfterPurge: refreshShifts } = useShift();
  const { showAlert } = useAlert();
  const [tableModal, setTableModal] = useState(false);
  const [gameModal, setGameModal] = useState(false);
  const [martialArtsModal, setMartialArtsModal] = useState(false);
  const [editingMartialArtsGame, setEditingMartialArtsGame] = useState<MartialArtsGame | null>(null);
  const [coachModal, setCoachModal] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [tableDraft, setTableDraft] = useState<TableDraft>({
    name: '', gameType: 'billiards', hourlyRate: String(settings.billiards.hourlyRate),
  });
  const [gameDraft, setGameDraft] = useState<GameDraft>({ name: '', pricingType: 'open', defaultRate: '' });
  const [saving, setSaving] = useState(false);
  const [purgeModal, setPurgeModal] = useState(false);
  const [purgeMode, setPurgeMode] = useState<PurgeMode | null>(null);
  const [purgePassword, setPurgePasswordValue] = useState('');
  const [backupExported, setBackupExported] = useState(false);
  const [backupAcknowledged, setBackupAcknowledged] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const coachGameOptions = useMemo<CoachGameOption[]>(() => [
    { key: 'boxing', label: 'ملاكمة', color: Colors.boxing },
    { key: 'kickboxing', label: 'كيك بوكسينغ', color: Colors.kickboxing },
    { key: 'karate', label: 'كاراتيه', color: Colors.karate },
    { key: 'gymnastics', label: 'جمباز', color: Colors.gymnastics },
    ...martialArtsGames.map((game) => ({ key: `martial:${game.id}` as const, label: game.name, color: game.color })),
  ], [martialArtsGames]);

  useEffect(() => {
    if (!tableDraft.id) {
      const rate = tableDraft.gameType === 'billiards'
        ? settings.billiards.hourlyRate : settings.tabletennis.hourlyRate;
      setTableDraft((draft) => ({ ...draft, hourlyRate: String(rate) }));
    }
  }, [settings, tableDraft.gameType, tableDraft.id]);

  const showError = (message: string) => Alert.alert('تعذر إتمام العملية', message);

  const openPurgeModal = async () => {
    setPurgeMode(null);
    setPurgePasswordValue('');
    setBackupExported(false);
    setBackupAcknowledged(false);
    setPurgeModal(true);
  };

  const exportPurgeBackup = async () => {
    setPurgeBusy(true);
    try {
      await exportComprehensiveWorkbook({
        members,
        sportLabels: Object.fromEntries(getSportOptions(martialArtsGames).map((option) => [option.sport, option.label])),
        records,
        shifts: [...closedShifts, ...(activeShift ? [activeShift] : [])],
        activeSessions: sessions.filter((session) => session.isActive),
        includeAllHistory: true,
      });
      setBackupExported(true);
      setBackupAcknowledged(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'تعذر إنشاء نسخة Excel الاحتياطية.');
    } finally {
      setPurgeBusy(false);
    }
  };

  const executePurge = async () => {
    if (!purgeMode) {
      showError('يرجى اختيار فترة التصفير.');
      return;
    }
    if (purgePassword !== ADMIN_PURGE_PASSWORD) {
      showError('كلمة مرور المسؤول غير صحيحة.');
      return;
    }
    if (!backupExported || !backupAcknowledged) {
      showError('أنشئ نسخة Excel الاحتياطية وأكّدها قبل تنفيذ التصفير.');
      return;
    }
    setPurgeBusy(true);
    try {
      await purgeLocalData(purgeMode);
      await Promise.all([refreshAll(), refreshGames(), refreshShifts(), refreshCoaches()]);
      setPurgeModal(false);
      Alert.alert('اكتمل التصفير', purgeMode === 'daily'
        ? 'تم إنهاء الجلسات النشطة ومسح إحصاءات الجلسات المسجلة لليوم. تم الاحتفاظ بالإعدادات والورديات والتحصيلات والديون.'
        : purgeMode === 'monthly'
        ? 'تم حذف سجلات جلسات الطاولات والألعاب السابقة لهذا الشهر مع الاحتفاظ ببيانات الشهر الحالي وجميع الورديات والمشتركين.'
        : purgeMode === 'annual'
          ? 'تم حذف السجلات السابقة لهذه السنة مع الاحتفاظ بإعدادات النظام وملفات المشتركين.'
          : 'تم مسح بيانات التطبيق المحلية بالكامل.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'تعذر تنفيذ التصفير.');
    } finally {
      setPurgeBusy(false);
    }
  };

  const openNewTable = () => {
    setTableDraft({ name: '', gameType: 'billiards', hourlyRate: String(settings.billiards.hourlyRate) });
    setTableModal(true);
  };

  const openEditTable = (table: ManagedTable) => {
    setTableDraft({ ...table, hourlyRate: String(table.hourlyRate) });
    setTableModal(true);
  };

  const saveTable = async () => {
    const name = tableDraft.name.trim();
    const rate = Number(tableDraft.hourlyRate);
    if (!name) return showError('يرجى إدخال اسم الطاولة.');
    if (!Number.isFinite(rate) || rate <= 0) return showError('أدخل سعراً صحيحاً أكبر من صفر.');
    setSaving(true);
    try {
      const value = { name, gameType: tableDraft.gameType, hourlyRate: rate };
      if (tableDraft.id) await updateTable({ ...value, id: tableDraft.id });
      else await addTable(value);
      setTableModal(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'تحقق من البيانات ومساحة التخزين.');
    } finally {
      setSaving(false);
    }
  };

  const openNewGame = () => {
    setGameDraft({ name: '', pricingType: 'open', defaultRate: '' });
    setGameModal(true);
  };

  const openEditGame = (game: OtherGame) => {
    setGameDraft({ ...game, defaultRate: String(game.defaultRate) });
    setGameModal(true);
  };

  const openNewCoach = () => {
    setEditingCoach(null);
    setCoachModal(true);
  };

  const openEditCoach = (coach: Coach) => {
    setEditingCoach(coach);
    setCoachModal(true);
  };

  const saveCoach = async (input: CoachInput, id?: string) => {
    if (id) await updateCoach(id, input);
    else await addCoach(input);
  };

  const saveGame = async () => {
    const name = gameDraft.name.trim();
    const rate = Number(gameDraft.defaultRate);
    if (!name) return showError('يرجى إدخال اسم اللعبة.');
    if (!Number.isFinite(rate) || rate <= 0) return showError('أدخل سعراً صحيحاً أكبر من صفر.');
    setSaving(true);
    try {
      const value = { name, pricingType: 'open' as const, defaultRate: rate };
      if (gameDraft.id) await updateOtherGame({ ...value, id: gameDraft.id, type: 'other_games' });
      else await addOtherGame(value);
      setGameModal(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'تحقق من البيانات ومساحة التخزين.');
    } finally {
      setSaving(false);
    }
  };

  const saveMartialArtsGame = async (values: Omit<MartialArtsGame, 'id' | 'type'>, id?: string) => {
    if (id) await updateMartialArtsGame({ ...values, id, type: 'martial_arts' });
    else await addMartialArtsGame(values);
  };

  const confirmDeleteMartialArtsGame = (game: MartialArtsGame) => {
    showAlert('حذف اللعبة القتالية', `هل تريد حذف «${game.name}»؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try {
          await deleteMartialArtsGame(game.id);
          await removeCoachForGame(`martial:${game.id}`);
        } catch (error) {
          showAlert('تعذر حذف اللعبة القتالية', error instanceof Error ? error.message : 'تعذر حذف اللعبة القتالية.');
        }
      } },
    ]);
  };

  const confirmDeleteTable = async (table: ManagedTable) => {
    showAlert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا العنصر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try {
          await deleteTable(table.id);
        } catch (error) {
          showAlert('تعذر حذف الطاولة', error instanceof Error ? error.message : 'تعذر حذف الطاولة.');
        }
      } },
    ]);
  };

  const confirmDeleteGame = async (game: OtherGame) => {
    showAlert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا العنصر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try {
          await deleteOtherGame(game.id);
          await removeCoachForGame(`other:${game.id}`);
        } catch (error) {
          showAlert('تعذر حذف اللعبة', error instanceof Error ? error.message : 'تعذر حذف اللعبة.');
        }
      } },
    ]);
  };

  const confirmDeleteCoach = async (coach: Coach) => {
    showAlert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا العنصر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        try {
          await removeCoach(coach.id);
        } catch (error) {
          showAlert('تعذر حذف بيانات الكابتن', error instanceof Error ? error.message : 'تعذر حذف بيانات الكابتن.');
        }
      } },
    ]);
  };

  const renderActions = (onEdit: () => void, onDelete: () => void) => (
    <View style={styles.rowActions}>
      <Pressable accessibilityRole="button" accessibilityLabel="تعديل" onPress={onEdit} style={styles.iconButton}>
        <MaterialIcons name="edit" size={19} color={Colors.statBlue} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="حذف" onPress={onDelete} style={[styles.iconButton, styles.deleteButton]}>
        <MaterialIcons name="delete-outline" size={20} color={Colors.danger} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: Colors.reportsDim }]}>
          <MaterialIcons name="tune" size={23} color={Colors.reports} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>إدارة الألعاب والطاولات</Text>
          <Text style={styles.subtitle}>إعدادات محلية تعمل دون اتصال</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <MaterialIcons name="offline-pin" size={19} color={Colors.success} />
          <Text style={styles.noticeText}>يتم حفظ التغييرات على هذا الجهاز فقط.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.headingCopy}>
            <Text style={styles.sectionTitle}>المدربون والكباتن</Text>
            <Text style={styles.sectionHint}>كابتن واحد لكل رياضة أو لعبة — البيانات محفوظة دون اتصال</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={openNewCoach}>
            <MaterialIcons name="add" size={18} color={Colors.white} />
            <Text style={styles.addButtonText}>إضافة</Text>
          </Pressable>
        </View>

        {coaches.map((coach) => {
          const coachColor = coachGameOptions.find((option) => option.key === coach.gameKey)?.color ?? Colors.reports;
          return (
            <View key={coach.id} style={styles.itemCard}>
              <View style={[styles.itemIcon, { backgroundColor: `${coachColor}20`, overflow: 'hidden' }]}>
                {coach.photoUri ? <Image source={{ uri: coach.photoUri }} style={styles.coachAvatar} contentFit="cover" /> : (
                  <MaterialIcons name="person" size={21} color={coachColor} />
                )}
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{coach.name}</Text>
                <Text style={styles.itemMeta}>{coachGameOptions.find((option) => option.key === coach.gameKey)?.label ?? coach.gameLabel} · {coach.phone}</Text>
              </View>
              {renderActions(() => openEditCoach(coach), () => confirmDeleteCoach(coach))}
            </View>
          );
        })}
        {coaches.length === 0 ? <Text style={styles.emptyText}>لم تتم إضافة مدربين بعد.</Text> : null}

        <View style={styles.purgeCard}>
          <View style={styles.purgeHeading}>
            <View style={styles.purgeIcon}>
              <MaterialIcons name="delete-sweep" size={21} color={Colors.danger} />
            </View>
            <View style={styles.headingCopy}>
              <Text style={styles.sectionTitle}>التصفير الذكي للبيانات</Text>
              <Text style={styles.sectionHint}>تنظيف محلي دون اتصال مع الاحتفاظ بالإعدادات والمشتركين</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" style={styles.purgeOpenButton} onPress={() => void openPurgeModal()}>
            <MaterialIcons name="security" size={18} color={Colors.white} />
            <Text style={styles.addButtonText}>إعداد التصفير الآمن</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <View style={styles.headingCopy}>
            <Text style={styles.sectionTitle}>الطاولات</Text>
            <Text style={styles.sectionHint}>بلياردو وتنس الطاولة — الاسم والسعر قابلان للتخصيص</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={openNewTable}>
            <MaterialIcons name="add" size={18} color={Colors.white} />
            <Text style={styles.addButtonText}>إضافة</Text>
          </Pressable>
        </View>

        {!configurationLoaded ? <Text style={styles.emptyText}>جارٍ تحميل الإعدادات…</Text> : null}
        {tables.map((table) => {
          const color = table.gameType === 'billiards' ? BILLIARDS_COLOR : TENNIS_COLOR;
          const typeLabel = table.gameType === 'billiards' ? 'بلياردو' : 'تنس الطاولة';
          return (
            <View key={table.id} style={styles.itemCard}>
              <View style={[styles.itemIcon, { backgroundColor: `${color}20` }]}>
                <MaterialIcons name={table.gameType === 'billiards' ? 'sports-esports' : 'sports-tennis'} size={21} color={color} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{table.name}</Text>
                <Text style={styles.itemMeta}>{typeLabel} · {table.hourlyRate.toLocaleString('ar-SA')} ر.ي / ساعة</Text>
              </View>
              {renderActions(() => openEditTable(table), () => confirmDeleteTable(table))}
            </View>
          );
        })}
        {configurationLoaded && tables.length === 0 ? <Text style={styles.emptyText}>لا توجد طاولات مضافة حالياً.</Text> : null}

        <View style={[styles.sectionHeading, styles.gamesHeading]}>
          <View style={styles.headingCopy}>
            <Text style={styles.sectionTitle}>الألعاب القتالية</Text>
            <Text style={styles.sectionHint}>رياضات المشتركين والكباتن</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={() => { setEditingMartialArtsGame(null); setMartialArtsModal(true); }}>
            <MaterialIcons name="add" size={18} color={Colors.white} />
            <Text style={styles.addButtonText}>إضافة لعبة قتالية</Text>
          </Pressable>
        </View>

        {martialArtsGames.map((game) => (
          <View key={game.id} style={styles.itemCard}>
            <View style={[styles.itemIcon, { backgroundColor: `${game.color}20` }]}>
              <MaterialCommunityIcons name={game.icon as never} size={22} color={game.color} />
            </View>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{game.name}</Text>
              <Text style={styles.itemMeta}>لعبة قتالية · إدارة المشتركين</Text>
            </View>
            {renderActions(() => { setEditingMartialArtsGame(game); setMartialArtsModal(true); }, () => confirmDeleteMartialArtsGame(game))}
          </View>
        ))}
        {martialArtsGames.length === 0 ? <Text style={styles.emptyText}>لم تتم إضافة ألعاب قتالية بعد.</Text> : null}

        <View style={[styles.sectionHeading, styles.gamesHeading]}>
          <View style={styles.headingCopy}>
            <Text style={styles.sectionTitle}>ألعاب أخرى</Text>
            <Text style={styles.sectionHint}>ألعاب زمنية / بالساعة مثل بلايستيشن والبلياردو</Text>
          </View>
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={openNewGame}>
            <MaterialIcons name="add" size={18} color={Colors.white} />
            <Text style={styles.addButtonText}>إضافة</Text>
          </Pressable>
        </View>

        {otherGames.map((game) => (
          <View key={game.id} style={styles.itemCard}>
            <View style={[styles.itemIcon, { backgroundColor: Colors.reportsDim }]}>
              <MaterialIcons name="sports-esports" size={21} color={Colors.reports} />
            </View>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{game.name}</Text>
              <Text style={styles.itemMeta}>
                جلسات مؤقتة · {game.defaultRate.toLocaleString('ar-SA')} ر.ي / ساعة
              </Text>
            </View>
            {renderActions(() => openEditGame(game), () => confirmDeleteGame(game))}
          </View>
        ))}
        {otherGames.length === 0 ? <Text style={styles.emptyText}>لم تتم إضافة ألعاب أخرى بعد.</Text> : null}
      </ScrollView>

      <View style={styles.developerFooter}>
        <Text style={styles.developerFooterText}>تطوير المبرمج: أحمد شرف</Text>
      </View>

      <Modal visible={purgeModal} transparent animationType="slide" onRequestClose={() => !purgeBusy && setPurgeModal(false)}>
        <Pressable style={styles.overlay} onPress={() => !purgeBusy && setPurgeModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoidWrap}>
            <Pressable style={styles.form} onPress={() => {}}>
              <View style={[styles.formStrip, { backgroundColor: Colors.danger }]} />
              <View style={styles.formHeader}>
                <View style={styles.headingCopy}>
                  <Text style={styles.formTitle}>التصفير الذكي للبيانات</Text>
                  <Text style={styles.formSubtitle}>اختر فترة التنظيف — جميع العمليات محلية</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="إلغاء والعودة" disabled={purgeBusy}
                  onPress={() => setPurgeModal(false)} style={styles.purgeCloseButton}>
                  <MaterialIcons name="close" size={21} color={Colors.textSecondary} />
                  <Text style={styles.purgeCloseText}>إلغاء / عودة</Text>
                </Pressable>
              </View>
              <ScrollView style={styles.purgeScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>فترة التصفير</Text>
                {([
                  { mode: 'daily', title: 'Daily Reset / تصفير يومي', description: 'ينهي جلسات الطاولات النشطة ويمسح إحصاءات الجلسات المسجلة لليوم، مع الاحتفاظ بالإعدادات والورديات والتحصيلات والديون.' },
                  { mode: 'monthly', title: 'Monthly Reset / تصفير شهري', description: 'يحذف سجلات جلسات الطاولات والألعاب السابقة لهذا الشهر فقط، مع الاحتفاظ بجميع الورديات.' },
                  { mode: 'annual', title: 'Annual Reset / تصفير سنوي', description: 'يحذف السجلات التاريخية السابقة للسنة الحالية.' },
                  { mode: 'full', title: 'Full Wipe / مسح كامل', description: 'يحذف المشتركين والإعدادات والجلسات والورديات من هذا الجهاز.' },
                ] as const).map((option) => {
                  const selected = purgeMode === option.mode;
                  return (
                    <Pressable key={option.mode} accessibilityRole="radio" accessibilityState={{ checked: selected }}
                      onPress={() => setPurgeMode(option.mode)}
                      style={[styles.purgeOption, selected && styles.purgeOptionSelected, option.mode === 'full' && selected && styles.purgeOptionDanger]}>
                      <MaterialIcons name={selected ? 'radio-button-checked' : 'radio-button-unchecked'} size={21}
                        color={selected ? (option.mode === 'full' ? Colors.danger : Colors.reports) : Colors.textMuted} />
                      <View style={styles.purgeOptionCopy}>
                        <Text style={[styles.purgeOptionTitle, option.mode === 'full' && { color: Colors.danger }]}>{option.title}</Text>
                        <Text style={styles.purgeOptionDescription}>{option.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}

                <View style={styles.securityNote}>
                  <MaterialIcons name="lock" size={18} color={Colors.statYellow} />
                  <Text style={styles.securityNoteText}>يلزم إدخال كلمة مرور المسؤول. كلمة المرور محلية ولا تُرسل عبر الإنترنت.</Text>
                </View>
                <Text style={styles.label}>أدخل كلمة مرور المسؤول</Text>
                <TextInput value={purgePassword} onChangeText={setPurgePasswordValue} secureTextEntry
                  autoCapitalize="none" autoCorrect={false} textAlign="right" style={styles.input}
                  placeholder="أدخل كلمة مرور المسؤول" placeholderTextColor={Colors.textMuted} />

                <View style={styles.backupBox}>
                  <View style={styles.backupCopy}>
                    <Text style={styles.backupTitle}>نسخة Excel احتياطية إلزامية</Text>
                    <Text style={styles.purgeOptionDescription}>تتضمن جميع المشتركين والسجلات التاريخية والورديات والجلسات النشطة.</Text>
                  </View>
                  <Pressable accessibilityRole="button" disabled={purgeBusy} onPress={() => void exportPurgeBackup()}
                    style={[styles.backupButton, purgeBusy && styles.disabled]}>
                    <MaterialIcons name="table-view" size={18} color={Colors.white} />
                    <Text style={styles.backupButtonText}>{backupExported ? 'إعادة إنشاء النسخة' : 'إنشاء نسخة Excel'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: backupAcknowledged, disabled: !backupExported }}
                    disabled={!backupExported || purgeBusy} onPress={() => setBackupAcknowledged((checked) => !checked)}
                    style={[styles.backupCheckRow, !backupExported && { opacity: 0.5 }]}>
                    <MaterialIcons name={backupAcknowledged ? 'check-box' : 'check-box-outline-blank'} size={21}
                      color={backupAcknowledged ? Colors.success : Colors.textMuted} />
                    <Text style={styles.backupCheckText}>أؤكد إنشاء نسخة Excel قبل تنفيذ التصفير</Text>
                  </Pressable>
                </View>

                <Pressable accessibilityRole="button"
                  disabled={purgeBusy || !purgeMode || purgePassword !== ADMIN_PURGE_PASSWORD || !backupExported || !backupAcknowledged}
                  onPress={() => void executePurge()}
                  style={[styles.executePurgeButton, purgeMode === 'full' && styles.executePurgeDanger,
                    (purgeBusy || !purgeMode || purgePassword !== ADMIN_PURGE_PASSWORD || !backupExported || !backupAcknowledged) && styles.disabled]}>
                  <MaterialIcons name={purgeBusy ? 'hourglass-top' : 'delete-forever'} size={19} color={Colors.white} />
                  <Text style={styles.executePurgeText}>{purgeBusy ? 'جارٍ تنفيذ العملية…' : 'تأكيد التصفير'}</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal visible={tableModal} transparent animationType="slide" onRequestClose={() => setTableModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setTableModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoidWrap}>
            <Pressable style={styles.form} onPress={() => {}}>
              <View style={[styles.formStrip, { backgroundColor: tableDraft.gameType === 'billiards' ? BILLIARDS_COLOR : TENNIS_COLOR }]} />
              <View style={styles.formHeader}>
                <View>
                  <Text style={styles.formTitle}>{tableDraft.id ? 'تعديل الطاولة' : 'إضافة طاولة'}</Text>
                  <Text style={styles.formSubtitle}>أدخل بيانات الطاولة وسعر الساعة</Text>
                </View>
                <Pressable onPress={() => setTableModal(false)} style={styles.closeButton}>
                  <MaterialIcons name="close" size={21} color={Colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>نوع اللعبة</Text>
                <View style={styles.choiceRow}>
                  {(['billiards', 'tabletennis'] as const).map((type) => {
                    const selected = tableDraft.gameType === type;
                    const color = type === 'billiards' ? BILLIARDS_COLOR : TENNIS_COLOR;
                    return (
                      <Pressable key={type} onPress={() => setTableDraft((draft) => ({ ...draft, gameType: type }))}
                        style={[styles.choice, selected && { borderColor: color, backgroundColor: `${color}18` }]}>
                        <MaterialIcons name={type === 'billiards' ? 'sports-esports' : 'sports-tennis'} size={18} color={selected ? color : Colors.textMuted} />
                        <Text style={[styles.choiceText, selected && { color }]}>{type === 'billiards' ? 'بلياردو' : 'تنس الطاولة'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.label}>اسم الطاولة أو رقمها</Text>
                <TextInput value={tableDraft.name} onChangeText={(name) => setTableDraft((draft) => ({ ...draft, name }))}
                  placeholder="مثال: طاولة 3" placeholderTextColor={Colors.textMuted} style={styles.input} maxLength={50} returnKeyType="next" />
                <Text style={styles.label}>السعر لكل ساعة (ر.ي)</Text>
                <TextInput value={tableDraft.hourlyRate} onChangeText={(hourlyRate) => setTableDraft((draft) => ({ ...draft, hourlyRate: hourlyRate.replace(/[^0-9.]/g, '') }))}
                  placeholder="700" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" style={styles.input} />
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveTable()} style={[styles.saveButton, saving && styles.disabled]}>
                  <Text style={styles.saveButtonText}>{saving ? 'جارٍ الحفظ…' : tableDraft.id ? 'حفظ التعديلات' : 'إضافة الطاولة'}</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal visible={gameModal} transparent animationType="slide" onRequestClose={() => setGameModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setGameModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.avoidWrap}>
            <Pressable style={styles.form} onPress={() => {}}>
              <View style={[styles.formStrip, { backgroundColor: Colors.reports }]} />
              <View style={styles.formHeader}>
                <View>
                  <Text style={styles.formTitle}>{gameDraft.id ? 'تعديل اللعبة' : 'إضافة لعبة أخرى'}</Text>
                  <Text style={styles.formSubtitle}>تدعم اللعبة جلسات مؤقتة ويُحسب سعرها حسب مدة اللعب الفعلية</Text>
                </View>
                <Pressable onPress={() => setGameModal(false)} style={styles.closeButton}>
                  <MaterialIcons name="close" size={21} color={Colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>اسم اللعبة الأخرى</Text>
                <TextInput value={gameDraft.name} onChangeText={(name) => setGameDraft((draft) => ({ ...draft, name }))}
                  placeholder="مثال: بلايستيشن 5" placeholderTextColor={Colors.textMuted} style={styles.input} maxLength={50} returnKeyType="next" />
                <Text style={styles.label}>سعر الساعة للجلسات المؤقتة (ر.ي)</Text>
                <TextInput value={gameDraft.defaultRate} onChangeText={(defaultRate) => setGameDraft((draft) => ({ ...draft, defaultRate: defaultRate.replace(/[^0-9.]/g, '') }))}
                  placeholder="500" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" style={styles.input} />
                <Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveGame()} style={[styles.saveButton, saving && styles.disabled]}>
                  <Text style={styles.saveButtonText}>{saving ? 'جارٍ الحفظ…' : gameDraft.id ? 'حفظ التعديلات' : 'إضافة اللعبة'}</Text>
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <MartialArtsGameModal
        visible={martialArtsModal}
        game={editingMartialArtsGame}
        onClose={() => setMartialArtsModal(false)}
        onSave={saveMartialArtsGame}
      />

      <CoachFormModal
        visible={coachModal}
        coach={editingCoach}
        gameOptions={coachGameOptions}
        onClose={() => setCoachModal(false)}
        onSave={saveCoach}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'flex-end' },
  title: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  content: { padding: Spacing.xl, gap: Spacing.sm },
  developerFooter: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  developerFooterText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' },
  notice: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.success + '12', borderColor: Colors.success + '35', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  noticeText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'right', flex: 1 },
  purgeCard: { backgroundColor: Colors.card, borderColor: Colors.danger + '35', borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.md },
  purgeHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  purgeIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.statRedDim },
  purgeOpenButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 12 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs, marginBottom: Spacing.xs },
  gamesHeading: { marginTop: Spacing.lg },
  headingCopy: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800', textAlign: 'right' },
  sectionHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, textAlign: 'right' },
  addButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: Colors.reports, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  addButtonText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  itemCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.xs },
  itemIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  coachAvatar: { width: '100%', height: '100%' },
  itemCopy: { flex: 1, alignItems: 'flex-end' },
  itemName: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700', textAlign: 'right' },
  itemMeta: { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 4 },
  rowActions: { flexDirection: 'row', gap: 5 },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.statBlueDim, borderRadius: Radius.sm },
  deleteButton: { backgroundColor: Colors.statRedDim },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'flex-end' },
  avoidWrap: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  form: { maxHeight: '90%', flexShrink: 1, backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  formStrip: { height: 4, marginHorizontal: -Spacing.xl },
  formHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.lg },
  formTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'right' },
  formSubtitle: { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right', marginTop: 3 },
  closeButton: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card },
  purgeCloseButton: { minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.card },
  purgeCloseText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700' },
  purgeScroll: { flexShrink: 1 },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', textAlign: 'right', marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { color: Colors.textPrimary, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.md, textAlign: 'right' },
  purgeOption: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  purgeOptionSelected: { borderColor: Colors.reports, backgroundColor: Colors.reportsDim },
  purgeOptionDanger: { borderColor: Colors.danger, backgroundColor: Colors.statRedDim },
  purgeOptionCopy: { flex: 1, alignItems: 'flex-end', gap: 4 },
  purgeOptionTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', textAlign: 'right' },
  purgeOptionDescription: { color: Colors.textSecondary, fontSize: FontSize.xs, lineHeight: 18, textAlign: 'right' },
  securityNote: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.statYellowDim, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  securityNoteText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right', lineHeight: 18 },
  backupBox: { backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.lg, gap: Spacing.sm },
  backupCopy: { alignItems: 'flex-end', gap: 4 },
  backupTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', textAlign: 'right' },
  backupButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.reports, borderRadius: Radius.md, paddingVertical: 11 },
  backupButtonText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '700' },
  backupCheckRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  backupCheckText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right' },
  executePurgeButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 14, marginTop: Spacing.md, marginBottom: Spacing.xl },
  executePurgeDanger: { backgroundColor: '#991B1B' },
  executePurgeText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '800' },
  choiceRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  choice: { flex: 1, minHeight: 46, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.card, paddingHorizontal: Spacing.xs },
  choiceText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center' },
  selectedGameChoice: { borderColor: Colors.reports, backgroundColor: Colors.reportsDim },
  saveButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.reports, borderRadius: Radius.md, paddingVertical: 14, marginTop: Spacing.xl },
  saveButtonText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
