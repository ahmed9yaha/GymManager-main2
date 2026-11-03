import React, { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/ScaledText';
import { CoachCard } from '@/features/coaches/components/CoachCard';
import { useCoaches } from '@/features/coaches/hooks/useCoaches';
import { TableCard } from '@/features/tables/components/TableCard';
import { TableSessionModal } from '@/features/tables/components/TableSessionModal';
import { TableSettingsModal } from '@/features/tables/components/TableSettingsModal';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTableGames } from '@/hooks/useTableGames';
import { exportGamesWorkbook, shareGamesArabicReport } from '@/services/reporting';
import { GameType, ManagedTable, OtherGame, SessionMode, SessionRecord } from '@/services/tableGames';
import { CustomReportDateModal } from '@/features/tables/components/CustomReportDateModal';
import { OtherGameSaleModal } from '@/features/tables/components/OtherGameSaleModal';
import { ReportPanel } from '@/features/tables/components/ReportPanel';
import { StopConfirmModal } from '@/features/tables/components/StopConfirmModal';

const BILLIARDS_COLOR = '#F97316';
const BILLIARDS_DIM = '#2D1500';
const TT_COLOR = '#06B6D4';
const TT_DIM = '#001E24';
const PLAYSTATION_COLOR = '#22C55E';
const PLAYSTATION_DIM = '#052E16';

type DashboardGame = {
  id: string;
  tableId: string;
  tableNumber: number;
  name: string;
  hourlyRate: number;
  gameType: GameType;
  category: GameType;
  color: string;
  dimColor: string;
  icon: 'billiards' | 'sports-tennis' | 'controller-classic' | 'videogame-asset';
  iconFamily: 'material' | 'community';
  gameId?: string;
  gameLabel?: string;
  sourceGame?: OtherGame;
};

type ReportTab = 'today' | 'custom';

interface StopTarget {
  tableId: string;
  tableNumber: number;
  tableName: string;
  gameType: GameType;
  gameLabel?: string;
  finalCost: number;
}

function createCoreTableEntry(table: ManagedTable, tableNumber: number): DashboardGame {
  const isBilliards = table.gameType === 'billiards';
  return {
    id: table.id,
    tableId: table.id,
    tableNumber,
    name: table.name,
    hourlyRate: table.hourlyRate,
    gameType: table.gameType,
    category: table.gameType,
    color: isBilliards ? BILLIARDS_COLOR : TT_COLOR,
    dimColor: isBilliards ? BILLIARDS_DIM : TT_DIM,
    icon: isBilliards ? 'billiards' : 'sports-tennis',
    iconFamily: isBilliards ? 'community' : 'material',
  };
}

function createCustomGameEntry(game: OtherGame): DashboardGame {
  const isPlayStationGame = /playstation|بلايستيشن|ps\s*5/i.test(game.name);
  return {
    id: `other:${game.id}`,
    tableId: `othergame_${game.id}`,
    tableNumber: 1,
    name: game.name,
    hourlyRate: game.defaultRate,
    gameType: 'othergame',
    category: 'othergame',
    color: isPlayStationGame ? PLAYSTATION_COLOR : Colors.reports,
    dimColor: isPlayStationGame ? PLAYSTATION_DIM : Colors.reportsDim,
    icon: isPlayStationGame ? 'controller-classic' : 'videogame-asset',
    iconFamily: isPlayStationGame ? 'community' : 'material',
    gameId: game.id,
    gameLabel: game.name,
    sourceGame: game,
  };
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

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TablesDashboardContainer() {
  const insets = useSafeAreaInsets();
  const { getCoachForGame } = useCoaches();
  const {
    sessions,
    records,
    settings,
    tables,
    otherGames,
    tick,
    startSession,
    stopSession,
    freezeSession,
    resumeSession,
    recordOtherGameSale,
    getActiveSession,
    getReport,
    updateSettings,
  } = useTableGames();
  const [exportingGames, setExportingGames] = useState(false);
  const [sessionModal, setSessionModal] = useState<{
    visible: boolean;
    tableId: string;
    tableNumber: number;
    gameType: GameType;
    tableName: string;
    hourlyRate: number;
    gameId?: string;
    gameLabel?: string;
  } | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [stopTarget, setStopTarget] = useState<StopTarget | null>(null);
  const [stopAmountPaid, setStopAmountPaid] = useState('');
  const [stopDebtorName, setStopDebtorName] = useState('');
  const [stopDebtorPhone, setStopDebtorPhone] = useState('');
  const [reportTab, setReportTab] = useState<ReportTab>('today');
  const [customReportVisible, setCustomReportVisible] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);
  const [saleGame, setSaleGame] = useState<OtherGame | null>(null);

  const billiardsTables = useMemo(() => tables.filter((table) => table.gameType === 'billiards'), [tables]);
  const ttTables = useMemo(() => tables.filter((table) => table.gameType === 'tabletennis'), [tables]);
  const gameRegistry = useMemo(() => [
    ...billiardsTables.map((table, index) => ({
      ...createCoreTableEntry(table, index + 1), hourlyRate: settings.billiards.hourlyRate,
    })),
    ...ttTables.map((table, index) => ({
      ...createCoreTableEntry(table, index + 1), hourlyRate: settings.tabletennis.hourlyRate,
    })),
    ...otherGames.map((game) => ({
      ...createCustomGameEntry(game),
      hourlyRate: settings.otherGames[game.id]?.hourlyRate ?? game.defaultRate,
    })),
  ], [billiardsTables, ttTables, otherGames, settings.billiards.hourlyRate, settings.tabletennis.hourlyRate, settings.otherGames]);

  const summaryPills = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      label: string;
      color: string;
      dimColor: string;
      icon: DashboardGame['icon'];
      iconFamily: DashboardGame['iconFamily'];
      total: number;
      active: number;
    }>();
    for (const entry of gameRegistry) {
      const key = entry.category === 'othergame' ? entry.id : entry.category;
      const group = groups.get(key) ?? {
        key,
        label: entry.category === 'billiards' ? 'بلياردو' : entry.category === 'tabletennis' ? 'تنس الطاولة' : entry.name,
        color: entry.color,
        dimColor: entry.dimColor,
        icon: entry.icon,
        iconFamily: entry.iconFamily,
        total: 0,
        active: 0,
      };
      group.total += 1;
      if (getActiveSession(entry.tableId)) group.active += 1;
      groups.set(key, group);
    }
    if (!groups.has('billiards')) groups.set('billiards', {
      key: 'billiards', label: 'بلياردو', color: BILLIARDS_COLOR, dimColor: BILLIARDS_DIM,
      icon: 'billiards', iconFamily: 'community', total: 0, active: 0,
    });
    if (!groups.has('tabletennis')) groups.set('tabletennis', {
      key: 'tabletennis', label: 'تنس الطاولة', color: TT_COLOR, dimColor: TT_DIM,
      icon: 'sports-tennis', iconFamily: 'material', total: 0, active: 0,
    });
    return [...groups.values()];
  }, [gameRegistry, getActiveSession, sessions, tick]);

  const openSessionModal = useCallback((tableId: string, tableNumber: number, gameType: GameType, tableName: string, hourlyRate: number, gameId?: string, gameLabel?: string) => {
    setSessionModal({ visible: true, tableId, tableNumber, gameType, tableName, hourlyRate, gameId, gameLabel });
  }, []);

  const handleStartSession = useCallback(async (mode: SessionMode, customRate?: number) => {
    if (!sessionModal) return;
    await startSession(
      sessionModal.tableId,
      sessionModal.tableNumber,
      sessionModal.gameType,
      mode,
      customRate,
      sessionModal.hourlyRate,
      sessionModal.tableName,
      sessionModal.gameId,
      sessionModal.gameLabel
    );
    setSessionModal(null);
  }, [sessionModal, startSession]);

  const handleStopPress = useCallback((tableId: string, tableNumber: number, gameType: GameType, tableName: string, gameLabel?: string) => {
    const finalCost = freezeSession(tableId);
    if (finalCost === undefined) return;
    setStopTarget({ tableId, tableNumber, gameType, tableName, gameLabel, finalCost });
    setStopAmountPaid(String(finalCost));
    setStopDebtorName('');
    setStopDebtorPhone('');
  }, [freezeSession]);

  const cancelSessionStop = useCallback(() => {
    if (stopTarget) void resumeSession(stopTarget.tableId);
    setStopTarget(null);
  }, [resumeSession, stopTarget]);

  const handleConfirmStop = useCallback(async () => {
    if (!stopTarget) return;
    try {
      await stopSession(stopTarget.tableId, {
        amountPaid: Number(stopAmountPaid),
        debtorName: stopDebtorName,
        debtorPhone: stopDebtorPhone,
      });
      setStopTarget(null);
    } catch (error) {
      Alert.alert('تعذر حفظ تحصيل الجلسة', error instanceof Error ? error.message : 'تحقق من التخزين المحلي ثم أعد المحاولة.');
    }
  }, [stopTarget, stopSession, stopAmountPaid, stopDebtorName, stopDebtorPhone]);

  const todayFrom = useMemo(() => startOfDay(new Date()), [tick]);
  const todayTo = useMemo(() => endOfDay(new Date()), [tick]);
  const handleCustomRangeApply = useCallback((from: Date, to: Date) => {
    setCustomRange({ from, to });
    setReportTab('custom');
  }, []);
  const handleShareGamesReport = useCallback((reportRecords: SessionRecord[], from: Date, to: Date) => {
    void shareGamesArabicReport(reportRecords, from, to);
  }, []);
  const handleGamesExcelExport = useCallback(async () => {
    if (exportingGames) return;
    setExportingGames(true);
    try {
      await exportGamesWorkbook(records, sessions);
      Alert.alert('اكتمل التصدير', 'تم إنشاء ملف Excel لجميع جلسات الألعاب والطاولات.');
    } catch (error) {
      Alert.alert('تعذر تصدير الجلسات', error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء ملف Excel.');
    } finally {
      setExportingGames(false);
    }
  }, [exportingGames, records, sessions]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.7 }]} onPress={() => router.push('/(tabs)/management')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="tune" size={21} color={Colors.reports} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.7 }]} onPress={() => setSettingsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="settings" size={22} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}><Text style={styles.headerTitle}>الألعاب الأخرى</Text><Text style={styles.headerSub}>إدارة الطاولات والجلسات</Text></View>
        <View style={[styles.headerIcon, { backgroundColor: BILLIARDS_DIM }]}><MaterialIcons name="sports-esports" size={24} color={BILLIARDS_COLOR} /></View>
      </View>

      <View style={styles.statsStrip}>
        {summaryPills.map((pill) => <View key={pill.key} style={[styles.statChip, { backgroundColor: pill.dimColor, borderColor: `${pill.color}40` }]}>
          {pill.iconFamily === 'community'
            ? <MaterialCommunityIcons name={pill.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={14} color={pill.color} />
            : <MaterialIcons name={pill.icon as keyof typeof MaterialIcons.glyphMap} size={14} color={pill.color} />}
          <Text style={[styles.statChipText, { color: pill.color }]}>{pill.active}/{pill.total}</Text>
        </View>)}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: BILLIARDS_DIM }]}><MaterialCommunityIcons name="billiards" size={18} color={BILLIARDS_COLOR} /></View>
            <Text style={[styles.sectionTitle, { color: BILLIARDS_COLOR }]}>البلياردو</Text>
            <View style={[styles.rateTag, { backgroundColor: BILLIARDS_DIM, borderColor: BILLIARDS_COLOR + '30' }]}><MaterialIcons name="payments" size={12} color={BILLIARDS_COLOR} /><Text style={[styles.rateTagText, { color: BILLIARDS_COLOR }]}>{settings.billiards.hourlyRate.toLocaleString('ar-SA')} ر.ي/س</Text></View>
          </View>
          {getCoachForGame('billiards') ? <CoachCard coach={getCoachForGame('billiards')!} color={BILLIARDS_COLOR} compact /> : null}
          {gameRegistry.filter((entry) => entry.category === 'billiards').map((entry) => <TableCard
            key={entry.id} tableId={entry.tableId} tableNumber={entry.tableNumber} tableName={entry.name} hourlyRate={entry.hourlyRate} gameType={entry.gameType} compact color={entry.color} dimColor={entry.dimColor} icon={entry.icon} iconFamily={entry.iconFamily}
            activeSession={getActiveSession(entry.tableId)} tick={tick}
            onPress={() => openSessionModal(entry.tableId, entry.tableNumber, entry.gameType, entry.name, entry.hourlyRate)}
            onStop={() => handleStopPress(entry.tableId, entry.tableNumber, entry.gameType, entry.name)}
          />)}
          {billiardsTables.length === 0 ? <Text style={styles.emptyTables}>لا توجد طاولات. أضف طاولة من الإدارة.</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: TT_DIM }]}><MaterialIcons name="sports-tennis" size={18} color={TT_COLOR} /></View>
            <Text style={[styles.sectionTitle, { color: TT_COLOR }]}>تنس الطاولة</Text>
            <View style={[styles.rateTag, { backgroundColor: TT_DIM, borderColor: TT_COLOR + '30' }]}><MaterialIcons name="payments" size={12} color={TT_COLOR} /><Text style={[styles.rateTagText, { color: TT_COLOR }]}>{settings.tabletennis.hourlyRate.toLocaleString('ar-SA')} ر.ي/س</Text></View>
          </View>
          {getCoachForGame('tabletennis') ? <CoachCard coach={getCoachForGame('tabletennis')!} color={TT_COLOR} compact /> : null}
          {gameRegistry.filter((entry) => entry.category === 'tabletennis').map((entry) => <TableCard
            key={entry.id} tableId={entry.tableId} tableNumber={entry.tableNumber} tableName={entry.name} hourlyRate={entry.hourlyRate} gameType={entry.gameType} compact color={entry.color} dimColor={entry.dimColor} icon={entry.icon} iconFamily={entry.iconFamily}
            activeSession={getActiveSession(entry.tableId)} tick={tick}
            onPress={() => openSessionModal(entry.tableId, entry.tableNumber, entry.gameType, entry.name, entry.hourlyRate)}
            onStop={() => handleStopPress(entry.tableId, entry.tableNumber, entry.gameType, entry.name)}
          />)}
          {ttTables.length === 0 ? <Text style={styles.emptyTables}>لا توجد طاولات. أضف طاولة من الإدارة.</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.reportsDim }]}><MaterialIcons name="videogame-asset" size={18} color={Colors.reports} /></View>
            <Text style={[styles.sectionTitle, { color: Colors.reports }]}>ألعاب أخرى مخصصة</Text>
            <Pressable style={styles.manageGamesButton} onPress={() => router.push('/(tabs)/management')}><MaterialIcons name="add" size={17} color={Colors.white} /><Text style={styles.manageGamesButtonText}>إدارة</Text></Pressable>
          </View>
          {gameRegistry.filter((entry) => entry.category === 'othergame').length ? gameRegistry.filter((entry) => entry.category === 'othergame').map((entry) => {
            const game = entry.sourceGame;
            if (!game) return null;
            const coach = getCoachForGame(`other:${game.id}`);
            return <View key={game.id}>
              {coach ? <CoachCard coach={coach} color={entry.color} compact gameLabel={game.name} /> : null}
              <TableCard
                tableId={entry.tableId} tableNumber={entry.tableNumber} tableName={entry.name} hourlyRate={entry.hourlyRate} gameType={entry.gameType} compact color={entry.color} dimColor={entry.dimColor} icon={entry.icon} iconFamily={entry.iconFamily}
                activeSession={getActiveSession(entry.tableId)} tick={tick} hasCompletedSession={records.some((record) => record.tableId === entry.tableId)}
                onPress={() => openSessionModal(entry.tableId, entry.tableNumber, entry.gameType, entry.name, entry.hourlyRate, entry.gameId, entry.gameLabel)}
                onStop={() => handleStopPress(entry.tableId, entry.tableNumber, entry.gameType, entry.name, entry.gameLabel)}
                onCollect={() => setSaleGame(game)}
              />
            </View>;
          }) : <Text style={styles.emptyTables}>لا توجد ألعاب مخصصة بعد. استخدم زر الإدارة لإضافتها.</Text>}
        </View>

        <View style={styles.reportsSection}>
          <View style={styles.reportsSectionHeader}><View style={[styles.sectionIcon, { backgroundColor: Colors.reportsDim }]}><MaterialIcons name="bar-chart" size={18} color={Colors.reports} /></View><Text style={[styles.sectionTitle, { color: Colors.reports }]}>التقارير</Text></View>
          <View style={styles.tabRow}>
            <Pressable style={({ pressed }) => [styles.tabBtn, reportTab === 'today' ? { backgroundColor: Colors.reports, borderColor: Colors.reports } : { backgroundColor: Colors.card, borderColor: Colors.border }, pressed && { opacity: 0.85 }]} onPress={() => setReportTab('today')}>
              <MaterialIcons name="today" size={15} color={reportTab === 'today' ? Colors.white : Colors.textSecondary} /><Text style={[styles.tabBtnText, { color: reportTab === 'today' ? Colors.white : Colors.textSecondary }]}>تقرير اليوم</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.tabBtn, reportTab === 'custom' ? { backgroundColor: Colors.reports, borderColor: Colors.reports } : { backgroundColor: Colors.card, borderColor: Colors.border }, pressed && { opacity: 0.85 }]} onPress={() => setCustomReportVisible(true)}>
              <MaterialIcons name="date-range" size={15} color={reportTab === 'custom' ? Colors.white : Colors.textSecondary} /><Text style={[styles.tabBtnText, { color: reportTab === 'custom' ? Colors.white : Colors.textSecondary }]}>تقرير مخصص</Text>
            </Pressable>
          </View>
          {reportTab === 'custom' && customRange ? <View style={styles.rangeChip}>
            <MaterialIcons name="date-range" size={13} color={Colors.reports} /><Text style={styles.rangeChipText}>{formatDateISO(customRange.from)} ← {formatDateISO(customRange.to)}</Text><Pressable onPress={() => setCustomReportVisible(true)}><MaterialIcons name="edit" size={14} color={Colors.textMuted} /></Pressable>
          </View> : null}
          {reportTab === 'today' ? <ReportPanel label="أرباح اليوم" from={todayFrom} to={todayTo} getReport={getReport} onShare={handleShareGamesReport} onExport={handleGamesExcelExport} exporting={exportingGames} />
            : customRange ? <ReportPanel label={`${formatDateISO(customRange.from)} → ${formatDateISO(customRange.to)}`} from={customRange.from} to={customRange.to} getReport={getReport} onShare={handleShareGamesReport} onExport={handleGamesExcelExport} exporting={exportingGames} />
              : <View style={styles.noCustomWrap}><MaterialIcons name="date-range" size={32} color={Colors.textMuted} /><Text style={styles.noCustomText}>اضغط "تقرير مخصص" لاختيار الفترة الزمنية</Text></View>}
        </View>
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      <OtherGameSaleModal game={saleGame} onClose={() => setSaleGame(null)} onSave={(values) => saleGame ? recordOtherGameSale({ game: saleGame, ...values }) : Promise.resolve()} />
      {sessionModal ? <TableSessionModal
        visible={sessionModal.visible} tableNumber={sessionModal.tableNumber} tableName={sessionModal.tableName} gameType={sessionModal.gameType} gameLabel={sessionModal.gameLabel}
        color={sessionModal.gameType === 'billiards' ? BILLIARDS_COLOR : sessionModal.gameType === 'tabletennis' ? TT_COLOR : Colors.reports}
        hourlyRate={sessionModal.hourlyRate} onClose={() => setSessionModal(null)} onStart={handleStartSession}
      /> : null}
      <TableSettingsModal visible={settingsVisible} settings={settings} otherGames={otherGames} onClose={() => setSettingsVisible(false)} onSave={updateSettings} />
      {stopTarget ? <StopConfirmModal
        visible tableNumber={stopTarget.tableNumber} tableName={stopTarget.tableName} gameType={stopTarget.gameType} gameLabel={stopTarget.gameLabel}
        color={stopTarget.gameType === 'billiards' ? BILLIARDS_COLOR : stopTarget.gameType === 'tabletennis' ? TT_COLOR : Colors.reports}
        finalCost={stopTarget.finalCost} amountPaid={stopAmountPaid} debtorName={stopDebtorName} debtorPhone={stopDebtorPhone}
        onAmountPaidChange={setStopAmountPaid} onDebtorNameChange={setStopDebtorName} onDebtorPhoneChange={setStopDebtorPhone}
        onCancel={cancelSessionStop} onConfirm={handleConfirmStop}
      /> : null}
      <CustomReportDateModal visible={customReportVisible} onClose={() => setCustomReportVisible(false)} onApply={handleCustomRangeApply} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: BILLIARDS_COLOR + '20', gap: Spacing.md },
  headerIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  settingsBtn: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  statsStrip: { flexDirection: 'row-reverse', flexWrap: 'wrap', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1 },
  statChipText: { fontSize: FontSize.xs, fontWeight: '700' },
  content: { padding: Spacing.xl },
  emptyTables: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  manageGamesButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: Colors.reports, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  manageGamesButtonText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionIcon: { width: 32, height: 32, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', flex: 1, textAlign: 'right' },
  rateTag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4, borderWidth: 1 },
  rateTagText: { fontSize: FontSize.xs, fontWeight: '700' },
  reportsSection: { marginBottom: Spacing.xl, gap: Spacing.md },
  reportsSectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  tabRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1 },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  rangeChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.reportsDim, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: Colors.reports + '30', alignSelf: 'flex-end' },
  rangeChipText: { fontSize: FontSize.xs, color: Colors.reports, fontWeight: '600', flex: 1, textAlign: 'right' },
  noCustomWrap: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  noCustomText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
