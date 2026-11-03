
// Powered by OnSpace.AI
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Pressable,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '@/components/ui/ScaledTextInput';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useGym } from '@/hooks/useGym';
import { StatsCard } from '@/components/feature/StatsCard';
import { MemberCard } from '@/features/sports/components/MemberCard';
import { AddMemberModal } from '@/features/sports/components/AddMemberModal';
import { RenewSubscriptionModal } from '@/features/sports/components/RenewSubscriptionModal';
import { EditMemberModal } from '@/features/sports/components/EditMemberModal';
import { CoachCard } from '@/features/coaches/components/CoachCard';
import { useCoaches } from '@/features/coaches/hooks/useCoaches';
import { SportKey } from '@/services/storage';
import { useAlert } from '@/contexts/AlertContext';
import { useSportMemberActions } from '@/features/sports/hooks/useSportMemberActions';
import { calculateCoachEarnings } from '@/services/reporting';
import { useTableGames } from '@/hooks/useTableGames';
import { TableSession, calcCost, calcElapsedSeconds, calcRemainingSeconds, formatDuration } from '@/services/tableGames';
import { SportOption } from '@/features/sports/sportConfig';

interface SportScreenProps {
  sport: SportKey;
  label: string;
  color: string;
  dimColor: string;
  icon: string;
  iconFamily?: 'material' | 'community';
  sportOptions?: SportOption[];
  onSelectSport?: (sport: SportKey) => void;
}

export function SportScreen({ sport, label, color, dimColor, icon, iconFamily = 'material', sportOptions = [], onSelectSport }: SportScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { members, addMemberToSport, getStats, refreshSport } = useGym();
  const { getCoachForGame } = useCoaches();
  const { showAlert } = useAlert();
  const { sessions, tables, tick, stopSession, freezeSession, resumeSession, addSessionTime } = useTableGames();
  const [search, setSearch] = useState('');
  const [subscribersVisible, setSubscribersVisible] = useState(false);
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [stopTarget, setStopTarget] = useState<TableSession | null>(null);
  const [stopCost, setStopCost] = useState(0);
  const [stopAmountPaid, setStopAmountPaid] = useState('');
  const [stopDebtorName, setStopDebtorName] = useState('');
  const [stopDebtorPhone, setStopDebtorPhone] = useState('');
  const [stopError, setStopError] = useState('');
  const [savingStop, setSavingStop] = useState(false);
  const [addTimeTarget, setAddTimeTarget] = useState<TableSession | null>(null);
  const [addingTime, setAddingTime] = useState(false);
  const {
    renewingMember,
    editingMember,
    handleDelete,
    handleRenewPress,
    handleRenew,
    handleEditPress,
    handleEditSave,
    closeRenew,
    closeEdit,
  } = useSportMemberActions(sport, () => setSubscribersVisible(false));

  useEffect(() => {
    void refreshSport(sport);
  }, [refreshSport, sport]);

  const navigateToFiltered = useCallback(
    (filter: 'all' | 'expiring' | 'expired') => {
      router.push({ pathname: '/filtered-members', params: { sport, filter } });
    },
    [router, sport]
  );

  const sportMembers = members[sport] ?? [];
  const SportIcon = iconFamily === 'community' ? MaterialCommunityIcons : MaterialIcons;
  const coach = getCoachForGame(sport);
  const freeMembers = coach ? sportMembers.filter((member) => member.isComplimentary && member.coachId === coach.id) : [];
  const coachProfit = coach ? calculateCoachEarnings(coach, sportMembers) : 0;
  const stats = getStats(sport);

  const filtered = useMemo(() => {
    if (!search.trim()) return sportMembers;
    return sportMembers.filter((m) => m.name.includes(search.trim()));
  }, [sportMembers, search]);

  const runningTableSessions = useMemo(
    () => sessions.filter((session) =>
      session.isActive
    ),
    [sessions, tick]
  );

  const openSessionCheckout = useCallback((session: TableSession) => {
    const frozenCost = freezeSession(session.tableId);
    if (frozenCost === undefined) return;
    setStopTarget(session);
    setStopCost(frozenCost);
    setStopAmountPaid(String(frozenCost));
    setStopDebtorName('');
    setStopDebtorPhone('');
    setStopError('');
  }, [freezeSession]);

  const cancelSessionCheckout = useCallback(() => {
    if (stopTarget) void resumeSession(stopTarget.tableId);
    setStopTarget(null);
  }, [resumeSession, stopTarget]);

  const confirmSessionStop = useCallback(async () => {
    if (!stopTarget) return;
    setSavingStop(true);
    setStopError('');
    try {
      await stopSession(stopTarget.tableId, {
        amountPaid: Number(stopAmountPaid),
        debtorName: stopDebtorName,
        debtorPhone: stopDebtorPhone,
      });
      setStopTarget(null);
    } catch (error) {
      setStopError(error instanceof Error ? error.message : 'تعذر إيقاف الجلسة.');
    } finally {
      setSavingStop(false);
    }
  }, [stopTarget, stopSession, stopAmountPaid, stopDebtorName, stopDebtorPhone]);

  const confirmAddTime = useCallback(async (minutes: number) => {
    if (!addTimeTarget) return;
    setAddingTime(true);
    try {
      await addSessionTime(addTimeTarget.tableId, minutes);
      setAddTimeTarget(null);
    } catch (error) {
      setAddTimeTarget(null);
      showAlert('تعذر إضافة الوقت', error instanceof Error ? error.message : 'حاول مرة أخرى.');
    } finally {
      setAddingTime(false);
    }
  }, [addTimeTarget, addSessionTime, showAlert]);

  const handleAdd = useCallback(
    async (data: { name: string; fee: number; phone?: string; photo?: string; startDate: string; endDate: string; coachId?: string; isComplimentary?: boolean }) => {
      await addMemberToSport(sport, data);
      setModalVisible(false);
    },
    [sport, addMemberToSport]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.screenScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenContent}
      >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: color + '30' }]}>
        <View style={[styles.headerIcon, { backgroundColor: dimColor }]}>
          <SportIcon name={icon as never} size={24} color={color} />
        </View>
        <Text style={styles.headerTitle}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`إدارة المشتركين، النشاط الحالي ${label}. تغيير النشاط`}
          accessibilityState={{ expanded: sportPickerVisible }}
          onPress={() => setSportPickerVisible(true)}
          style={({ pressed }) => [styles.sportPickerTrigger, pressed && styles.pressed]}
        >
          <Text style={styles.headerSub}>إدارة المشتركين</Text>
          <SportIcon name={icon as never} size={18} color={color} />
          <MaterialIcons name="arrow-drop-down" size={21} color={color} />
        </Pressable>
      </View>

      <Modal visible={sportPickerVisible} transparent animationType="fade" onRequestClose={() => setSportPickerVisible(false)}>
        <Pressable style={styles.sportPickerOverlay} onPress={() => setSportPickerVisible(false)}>
          <View style={styles.sportPickerMenu}>
            <Text style={styles.sportPickerTitle}>اختر النشاط</Text>
            {sportOptions.map((option) => {
              const selected = option.sport === sport;
              return (
                <Pressable
                  key={option.sport}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSportPickerVisible(false);
                    onSelectSport?.(option.sport);
                  }}
                  style={({ pressed }) => [styles.sportPickerOption, selected && { backgroundColor: option.dimColor }, pressed && styles.pressed]}
                >
                  {option.iconFamily === 'community'
                    ? <MaterialCommunityIcons name={option.icon as never} size={20} color={option.color} />
                    : <MaterialIcons name={option.icon as never} size={20} color={option.color} />}
                  <Text style={[styles.sportPickerOptionText, selected && { color: option.color }]}>{option.label}</Text>
                  {selected ? <MaterialIcons name="check" size={18} color={option.color} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {coach ? <CoachCard coach={coach} color={color} profit={coachProfit} freeMemberNames={freeMembers.map((member) => member.name)} /> : null}

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatsCard
          label="إجمالي المشتركين"
          value={stats.total}
          color={Colors.statBlue}
          dimColor={Colors.statBlueDim}
          iconName="people"
          onPress={() => navigateToFiltered('all')}
        />
        <StatsCard
          label="ينتهي قريباً"
          value={stats.expiringSoon}
          color={Colors.statYellow}
          dimColor={Colors.statYellowDim}
          iconName="schedule"
          onPress={() => navigateToFiltered('expiring')}
        />
        <StatsCard
          label="منتهي الاشتراك"
          value={stats.expired}
          color={Colors.statRed}
          dimColor={Colors.statRedDim}
          iconName="event-busy"
          onPress={() => navigateToFiltered('expired')}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`عرض قائمة المشتركين، ${sportMembers.length} مشترك`}
        onPress={() => setSubscribersVisible(true)}
        style={({ pressed }) => [styles.openListButton, { borderColor: `${color}65` }, pressed && styles.pressed]}
      >
        <MaterialIcons name="groups" size={20} color={color} />
        <Text style={[styles.openListText, { color }]}>عرض قائمة المشتركين</Text>
        <View style={[styles.memberCount, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.memberCountText, { color }]}>{sportMembers.length}</Text>
        </View>
      </Pressable>

      {/* Active table sessions mini dashboard */}
      <View style={styles.liveGamesSection}>
        <View style={styles.liveGamesHeader}>
          <View style={styles.liveGamesTitleGroup}>
            <View style={styles.liveGamesPulse} />
            <Text style={styles.liveGamesTitle}>طاولات الألعاب النشطة</Text>
          </View>
          <Text style={styles.liveGamesCount}>{runningTableSessions.length}</Text>
        </View>

        {runningTableSessions.length > 0 ? runningTableSessions.map((session) => {
          const table = tables.find((item) => item.id === session.tableId);
          const accent = session.gameType === 'billiards' ? '#F97316' : '#06B6D4';
          const isOpenTime = session.mode === 'open';
          const now = Date.now();
          const timer = isOpenTime
            ? calcElapsedSeconds(session, now)
            : calcRemainingSeconds(session, now);
          const isExpired = !isOpenTime && timer === 0;
          const cost = calcCost(session, Date.now());
          return (
            <View key={session.id} style={[styles.liveGameCard, { borderColor: `${accent}45` }]}>
              <View style={[styles.liveGameStripe, { backgroundColor: accent }]} />
              <View style={styles.liveGameInfo}>
                <Text style={styles.liveGameName} numberOfLines={1}>
                  {session.tableName || table?.name || `طاولة ${session.tableNumber}`}
                </Text>
                <Text style={[styles.liveGameTimer, { color: isExpired ? Colors.danger : accent }]}>
                  {isOpenTime ? `وقت مفتوح · ${formatDuration(timer)}` : formatDuration(timer)}
                </Text>
                <Text style={styles.liveGameCost}>{cost.toLocaleString('ar-SA')} ر.ي</Text>
              </View>
              <View style={styles.liveGameActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${isExpired ? 'إنهاء' : 'إيقاف'} جلسة ${session.tableName || `طاولة ${session.tableNumber}`}`}
                  style={({ pressed }) => [styles.liveActionButton, styles.liveStopButton, pressed && styles.pressed, savingStop && styles.disabledAction]}
                  onPress={() => openSessionCheckout(session)}
                  disabled={savingStop}
                >
                  <MaterialIcons name={isExpired ? 'close' : 'stop'} size={18} color={Colors.danger} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`إضافة وقت إلى ${session.tableName || `طاولة ${session.tableNumber}`}`}
                  style={({ pressed }) => [styles.liveActionButton, styles.liveAddButton, pressed && styles.pressed, addingTime && styles.disabledAction]}
                  onPress={() => setAddTimeTarget(session)}
                  disabled={addingTime}
                >
                  <MaterialIcons name="add-alarm" size={18} color={Colors.statBlue} />
                </Pressable>
              </View>
            </View>
          );
        }) : (
          <View style={styles.liveGamesEmpty}>
            <MaterialIcons name="sports-esports" size={22} color={Colors.textMuted} />
            <Text style={styles.liveGamesEmptyText}>لا توجد طاولات ألعاب نشطة حالياً</Text>
          </View>
        )}
      </View>
      </ScrollView>

      <Modal visible={!!stopTarget} transparent animationType="fade" onRequestClose={cancelSessionCheckout}>
        <View style={styles.gameModalOverlay}>
          <View style={styles.gameModalCard}>
            <View style={[styles.gameModalIcon, { backgroundColor: `${Colors.danger}20` }]}>
              <MaterialIcons name="stop-circle" size={30} color={Colors.danger} />
            </View>
            <Text style={styles.gameModalTitle}>إيقاف الجلسة وتسجيل التحصيل</Text>
            <Text style={styles.gameModalSubtitle}>
              {stopTarget?.tableName || `طاولة ${stopTarget?.tableNumber}`} — {stopTarget?.gameType === 'billiards' ? 'بلياردو' : 'تنس طاولة'}
            </Text>
            <Text style={styles.gameModalCost}>المبلغ المستحق: {stopCost.toLocaleString('ar-SA')} ر.ي</Text>
            <TextInput
              style={styles.gameModalInput}
              value={stopAmountPaid}
              onChangeText={(value) => setStopAmountPaid(value.replace(/[^0-9]/g, ''))}
              placeholder="المبلغ المدفوع كاش"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
            {Math.max(0, stopCost - (Number(stopAmountPaid) || 0)) > 0 ? <>
              <Text style={styles.gameModalDue}>المتبقي (يمكن تسجيله كدين أو تسويته كخصم)</Text>
              <TextInput style={styles.gameModalInput} value={stopDebtorName} onChangeText={setStopDebtorName} placeholder="اسم المدين (اختياري)" placeholderTextColor={Colors.textMuted} textAlign="right" />
              <TextInput style={styles.gameModalInput} value={stopDebtorPhone} onChangeText={setStopDebtorPhone} placeholder="رقم الهاتف (اختياري)" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" textAlign="right" />
            </> : null}
            {stopError ? <Text style={styles.gameModalError}>{stopError}</Text> : null}
            <View style={styles.gameModalActions}>
              <Pressable style={styles.gameCancelButton} onPress={cancelSessionCheckout} disabled={savingStop}>
                <Text style={styles.gameActionText}>إلغاء</Text>
              </Pressable>
              <Pressable style={[styles.gameConfirmButton, savingStop && styles.disabledAction]} onPress={() => void confirmSessionStop()} disabled={savingStop}>
                <Text style={styles.gameActionText}>{savingStop ? 'جارٍ الحفظ…' : 'تأكيد الإيقاف'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!addTimeTarget} transparent animationType="fade" onRequestClose={() => setAddTimeTarget(null)}>
        <View style={styles.gameModalOverlay}>
          <View style={styles.gameModalCard}>
            <View style={[styles.gameModalIcon, { backgroundColor: `${Colors.statBlue}20` }]}>
              <MaterialIcons name="add-alarm" size={30} color={Colors.statBlue} />
            </View>
            <Text style={styles.gameModalTitle}>إضافة وقت للجلسة</Text>
            <Text style={styles.gameModalSubtitle}>{addTimeTarget?.tableName || `طاولة ${addTimeTarget?.tableNumber}`}</Text>
            <Text style={styles.addTimePrompt}>اختر المدة الإضافية</Text>
            <View style={styles.addTimeOptions}>
              {[30, 60, 90].map((minutes) => (
                <Pressable
                  key={minutes}
                  style={({ pressed }) => [styles.addTimeOption, pressed && styles.pressed, addingTime && styles.disabledAction]}
                  onPress={() => void confirmAddTime(minutes)}
                  disabled={addingTime}
                >
                  <Text style={styles.addTimeOptionText}>{minutes} دقيقة</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.gameCancelButton} onPress={() => setAddTimeTarget(null)} disabled={addingTime}>
              <Text style={styles.gameActionText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={subscribersVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSubscribersVisible(false)}
      >
        <Pressable style={styles.listModalOverlay} onPress={() => setSubscribersVisible(false)}>
          <Pressable style={styles.listModal} onPress={() => {}}>
            <View style={[styles.listModalHeader, { borderBottomColor: `${color}40` }]}>
              <View style={[styles.listModalIcon, { backgroundColor: dimColor }]}>
                <SportIcon name={icon as never} size={20} color={color} />
              </View>
              <View style={styles.listModalTitleGroup}>
                <Text style={styles.listModalTitle}>قائمة المشتركين</Text>
                <Text style={[styles.listModalSubtitle, { color }]}>{label} · {sportMembers.length} مشترك</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق قائمة المشتركين"
                onPress={() => setSubscribersVisible(false)}
                style={styles.closeListButton}
              >
                <MaterialIcons name="close" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="بحث باسم المشترك..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
                textAlign="right"
              />
              {search.length > 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => setSearch('')}>
                  <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              style={styles.memberList}
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <MemberCard member={item} sportColor={color} onDelete={handleDelete} onRenew={handleRenewPress} onEdit={handleEditPress} />
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIcon, { backgroundColor: dimColor }]}>
                    <SportIcon name={icon as never} size={40} color={color + '80'} />
                  </View>
                  <Text style={styles.emptyTitle}>{search ? 'لا نتائج مطابقة' : 'لا يوجد مشتركون بعد'}</Text>
                  <Text style={styles.emptyDesc}>{search ? 'جرب اسماً مختلفاً' : 'اضغط + لإضافة مشترك جديد'}</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: color, bottom: insets.bottom + 80 },
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <MaterialIcons name="add" size={28} color={Colors.white} />
      </Pressable>

      <AddMemberModal
        visible={modalVisible}
        sportLabel={label}
        sportColor={color}
        coach={coach}
        currentFreeMemberCount={freeMembers.length}
        onClose={() => setModalVisible(false)}
        onAdd={handleAdd}
      />

      <RenewSubscriptionModal
        visible={renewingMember !== null}
        member={renewingMember}
        sportColor={color}
        onClose={closeRenew}
        onRenew={handleRenew}
      />

      <EditMemberModal
        visible={editingMember !== null}
        member={editingMember}
        sportLabel={label}
        sportColor={color}
        onClose={closeEdit}
        onSave={handleEditSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenScroll: {
    flex: 1,
  },
  screenContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  sportPickerTrigger: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
  },
  sportPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 110,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sportPickerMenu: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sportPickerTitle: {
    color: Colors.textSecondary,
    textAlign: 'right',
    fontSize: FontSize.sm,
    fontWeight: '700',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sportPickerOption: {
    minHeight: 46,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  sportPickerOptionText: {
    flex: 1,
    color: Colors.textPrimary,
    textAlign: 'right',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 3,
    gap: Spacing.xs,
  },
  openListButton: {
    minHeight: 48,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  openListText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  memberCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCountText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  liveGamesSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  liveGamesHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  liveGamesTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveGamesPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveGamesTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'right',
  },
  liveGamesCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  liveGameCard: {
    minHeight: 66,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  liveGameStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  liveGameInfo: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  liveGameName: {
    maxWidth: '100%',
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'right',
  },
  liveGameTimer: {
    fontSize: FontSize.md,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  liveGameCost: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  liveGameActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  liveActionButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  liveStopButton: {
    backgroundColor: Colors.statRedDim,
    borderColor: `${Colors.danger}45`,
  },
  liveAddButton: {
    backgroundColor: Colors.statBlueDim,
    borderColor: `${Colors.statBlue}45`,
  },
  liveGamesEmpty: {
    minHeight: 58,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  liveGamesEmptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  gameModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.76)',
  },
  gameModalCard: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  gameModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameModalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  gameModalSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  gameModalCost: {
    width: '100%',
    color: Colors.reports,
    backgroundColor: Colors.reportsDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  gameModalInput: {
    width: '100%',
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  gameModalDue: {
    width: '100%',
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'right',
  },
  gameModalError: {
    width: '100%',
    color: Colors.danger,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  gameModalActions: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  gameCancelButton: {
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  gameConfirmButton: {
    minHeight: 42,
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  gameActionText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  addTimePrompt: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  addTimeOptions: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  addTimeOption: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.statBlueDim,
    borderWidth: 1,
    borderColor: `${Colors.statBlue}50`,
    borderRadius: Radius.md,
    paddingHorizontal: 3,
  },
  addTimeOptionText: {
    color: Colors.statBlue,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  disabledAction: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  listModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  listModal: {
    width: '100%',
    maxWidth: 960,
    height: '88%',
    maxHeight: 900,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  listModalHeader: {
    minHeight: 58,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    backgroundColor: Colors.surface,
  },
  listModalIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listModalTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  listModalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  listModalSubtitle: {
    fontSize: FontSize.xs,
    marginTop: 2,
    textAlign: 'right',
  },
  closeListButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchIcon: {
    marginRight: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    textAlignVertical: 'center',
    paddingVertical: 8,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  memberList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
