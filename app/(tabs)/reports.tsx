// Powered by OnSpace.AI
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useGym } from '@/hooks/useGym';
import { getMemberStatus } from '@/services/storage';
import { useTableGames } from '@/hooks/useTableGames';
import { exportComprehensiveWorkbook, shareDailyReport, shareShiftReport } from '@/services/reporting';
import { useShift } from '@/contexts/ShiftContext';
import { useAlert } from '@/contexts/AlertContext';
import { getSportOptions } from '@/features/sports/sportConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { members } = useGym();
  const { records, sessions, debts, otherGameSales, martialArtsGames, configurationLoaded } = useTableGames();
  const sports = useMemo(() => getSportOptions(martialArtsGames), [martialArtsGames]);
  const { activeShift, closedShifts, endShift } = useShift();
  const { showAlert } = useAlert();
  const [exporting, setExporting] = useState(false);
  const [closingShift, setClosingShift] = useState(false);

  const closeCurrentShift = () => {
    if (!configurationLoaded) {
      showAlert('يرجى الانتظار', 'جارٍ تحميل جلسات الألعاب. حاول إغلاق الوردية بعد اكتمال التحميل.');
      return;
    }

    const activeSessions = sessions.filter((session) => session.isActive);
    if (activeSessions.length > 0) {
      showAlert(
        'تنبيه',
        '⚠️ عذراً، لا يمكن إغلاق الوردية الحالية لوجود طاولات ألعاب نشطة! يرجى إنهاء أو تجميد كافة الجلسات أولاً ثم المحاولة مجدداً.'
      );
      return;
    }
    showAlert(
      'إغلاق الوردية',
      `هل تريد إغلاق وردية ${activeShift?.employeeName ?? ''} وإرسال ملخصها عبر واتساب؟ سيتم حفظ سجل الوردية وإعادة شاشة بدء الوردية.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'إغلاق وإرسال', style: 'destructive', onPress: () => {
          if (closingShift) return;
          setClosingShift(true);
          void (async () => {
            try {
              const closedShift = await endShift();
              await shareShiftReport(closedShift);
              showAlert('تم إغلاق الوردية', `تم حفظ وردية ${closedShift.employeeName} في السجل وإعادة ضبط الوردية النشطة.`, [
                { text: 'حسناً' },
              ]);
            } catch (error) {
              showAlert('تعذر إغلاق الوردية', error instanceof Error ? error.message : 'حدث خطأ أثناء إغلاق الوردية.');
            } finally {
              setClosingShift(false);
            }
          })();
        } },
      ]
    );
  };

  const handleExcelExport = async () => {
    setExporting(true);
    try {
      await exportComprehensiveWorkbook({
        members,
        sportLabels: Object.fromEntries(getSportOptions(martialArtsGames).map((option) => [option.sport, option.label])),
        records,
        debts,
        otherGameSales,
        activeSessions: sessions,
        shifts: [...closedShifts, ...(activeShift ? [activeShift] : [])],
        includeAllHistory: true,
      });
      showAlert('اكتمل تصدير Excel', 'تم إنشاء التقرير الشامل وتنزيله أو فتح خيارات مشاركته.');
    } catch (error) {
      showAlert('تعذر تصدير التقرير', error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء ملف Excel.');
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalActive = 0;
    let totalExpired = 0;
    let totalExpiring = 0;
    const sportCounts: { [key: string]: number } = {};
    const sportRevenue: { [key: string]: number } = {};

    sports.forEach(({ sport }) => {
      const list = members[sport] ?? [];
      const count = list.length;
      const revenue = list.reduce((sum, m) => sum + m.fee, 0);
      sportCounts[sport] = count;
      sportRevenue[sport] = revenue;
      totalRevenue += revenue;

      list.forEach((m) => {
        const status = getMemberStatus(m.endDate);
        if (status === 'active') totalActive++;
        else if (status === 'expired') totalExpired++;
        else if (status === 'expiring') totalExpiring++;
      });
    });

    const totalMembers = Object.values(sportCounts).reduce((a, b) => a + b, 0);

    return {
      totalRevenue,
      totalMembers,
      totalActive,
      totalExpired,
      totalExpiring,
      sportCounts,
      sportRevenue,
    };
  }, [members, sports]);

  const maxCount = Math.max(...Object.values(stats.sportCounts), 1);
  const maxRevenue = Math.max(...Object.values(stats.sportRevenue), 1);
  const gameCashToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return [...closedShifts, ...(activeShift ? [activeShift] : [])]
      .flatMap((shift) => shift.transactions)
      .filter((transaction) => transaction.type !== 'subscription')
      .filter((transaction) => {
        const time = new Date(transaction.occurredAt).getTime();
        return time >= start.getTime() && time <= end.getTime();
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }, [activeShift, closedShifts]);
  const currentGameDebt = debts.reduce((sum, debt) => sum + debt.amountDue, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: Colors.reportsDim }]}>
          <MaterialIcons name="bar-chart" size={24} color={Colors.reports} />
        </View>
        <Text style={styles.headerTitle}>التقارير والإحصائيات</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <View style={styles.shiftCard}>
          <View style={styles.shiftHeading}>
            <MaterialIcons name="badge" size={22} color={Colors.reports} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shiftTitle}>الوردية النشطة</Text>
              <Text style={styles.shiftSubtitle}>
                {activeShift ? `${activeShift.employeeName} · ${new Date(activeShift.startedAt).toLocaleTimeString('ar-SA')}` : 'لا توجد وردية نشطة'}
              </Text>
              {activeShift ? <Text style={styles.shiftSubtitle}>العمليات المسجلة: {activeShift.transactions.length}</Text> : null}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!activeShift || !configurationLoaded || closingShift}
            style={({ pressed }) => [styles.endShiftButton, (!activeShift || !configurationLoaded || closingShift || pressed) && { opacity: 0.65 }]}
            onPress={closeCurrentShift}
          >
            <MaterialIcons name="logout" size={19} color={Colors.white} />
            <Text style={styles.endShiftText}>{closingShift ? 'جارٍ إغلاق الوردية…' : 'End Shift / إغلاق الوردية'}</Text>
          </Pressable>
        </View>

        <View style={styles.exportCard}>
          <View style={styles.exportHeader}>
            <View style={[styles.exportIcon, { backgroundColor: Colors.reportsDim }]}>
              <MaterialIcons name="cloud-download" size={23} color={Colors.reports} />
            </View>
            <View style={styles.exportHeading}>
              <Text style={styles.exportTitle}>النسخ الاحتياطي والتصدير</Text>
              <Text style={styles.exportDescription}>تقاريرك محفوظة محلياً ويمكن مشاركتها دون اتصال بالإنترنت</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={exporting}
            style={({ pressed }) => [styles.excelButton, (pressed || exporting) && { opacity: 0.72 }]}
            onPress={handleExcelExport}
          >
            <MaterialIcons name={exporting ? 'hourglass-top' : 'table-view'} size={19} color={Colors.white} />
            <Text style={styles.excelButtonText}>{exporting ? 'جارٍ تجهيز الملف...' : 'تصدير Excel شامل'}</Text>
          </Pressable>

          <Text style={styles.shareLabel}>مشاركة ملخص إغلاق اليوم</Text>
          <View style={styles.shareButtons}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.shareButton, styles.whatsappButton, pressed && { opacity: 0.75 }]}
              onPress={() => void shareDailyReport({ members, records, debts, otherGameSales, shifts: [...closedShifts, ...(activeShift ? [activeShift] : [])] }, 'whatsapp')}
            >
              <MaterialIcons name="chat" size={18} color={Colors.white} />
              <Text style={styles.shareButtonText}>واتساب</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.shareButton, styles.smsButton, pressed && { opacity: 0.75 }]}
              onPress={() => void shareDailyReport({ members, records, debts, otherGameSales, shifts: [...closedShifts, ...(activeShift ? [activeShift] : [])] }, 'sms')}
            >
              <MaterialIcons name="sms" size={18} color={Colors.white} />
              <Text style={styles.shareButtonText}>رسالة SMS</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.gameFinanceCard}>
          <Text style={styles.gameFinanceTitle}>إيرادات الألعاب والديون — اليوم</Text>
          <View style={styles.gameFinanceRow}>
            <View style={styles.gameFinanceMetric}>
              <Text style={styles.gameFinanceLabel}>دخل الألعاب النقدي</Text>
              <Text style={[styles.gameFinanceValue, { color: Colors.success }]}>{gameCashToday.toLocaleString('ar-SA')} ر.ي</Text>
            </View>
            <View style={styles.gameFinanceDivider} />
            <View style={styles.gameFinanceMetric}>
              <Text style={styles.gameFinanceLabel}>ديون الألعاب القائمة</Text>
              <Text style={[styles.gameFinanceValue, { color: Colors.warning }]}>{currentGameDebt.toLocaleString('ar-SA')} ر.ي</Text>
            </View>
          </View>
          <Text style={styles.gameFinanceNote}>يشمل البلياردو وتنس الطاولة والألعاب الأخرى، ولا يشمل الاشتراكات الرياضية.</Text>
        </View>

        {/* Total Revenue Card */}
        <View style={[styles.revenueCard, { borderColor: Colors.reports + '40' }]}>
          <View style={styles.revenueTop}>
            <View style={[styles.revIcon, { backgroundColor: Colors.reportsDim }]}>
              <MaterialIcons name="account-balance-wallet" size={28} color={Colors.reports} />
            </View>
            <View style={styles.revenueInfo}>
              <Text style={styles.revenueLabel}>إجمالي أرباح النادي</Text>
              <Text style={[styles.revenueValue, { color: Colors.reports }]}>
                {stats.totalRevenue.toLocaleString('ar-SA')} ر.ي
              </Text>
            </View>
          </View>
          <View style={styles.revenueMeta}>
            <View style={styles.revenueMetaItem}>
              <Text style={styles.revenueMetaValue}>{stats.totalMembers}</Text>
              <Text style={styles.revenueMetaLabel}>إجمالي المشتركين</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueMetaItem}>
              <Text style={[styles.revenueMetaValue, { color: Colors.success }]}>{stats.totalActive}</Text>
              <Text style={styles.revenueMetaLabel}>اشتراك نشط</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueMetaItem}>
              <Text style={[styles.revenueMetaValue, { color: Colors.danger }]}>{stats.totalExpired}</Text>
              <Text style={styles.revenueMetaLabel}>اشتراك منتهي</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueMetaItem}>
              <Text style={[styles.revenueMetaValue, { color: Colors.warning }]}>{stats.totalExpiring}</Text>
              <Text style={styles.revenueMetaLabel}>ينتهي قريباً</Text>
            </View>
          </View>
        </View>

        {/* Members by Sport — Bar Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>عدد المشتركين لكل رياضة</Text>
          <View style={styles.chartCard}>
            {sports.map(({ sport, label, color }) => {
              const count = stats.sportCounts[sport] ?? 0;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <View key={sport} style={styles.barRow}>
                  <Text style={styles.barLabel}>{label}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(pct, 2)}%` as any, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barValue, { color }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Revenue by Sport — Bar Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأرباح لكل رياضة (ر.ي)</Text>
          <View style={styles.chartCard}>
            {sports.map(({ sport, label, color }) => {
              const rev = stats.sportRevenue[sport] ?? 0;
              const pct = maxRevenue > 0 ? (rev / maxRevenue) * 100 : 0;
              return (
                <View key={sport} style={styles.barRow}>
                  <Text style={styles.barLabel}>{label}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.max(pct, 2)}%` as any, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barValue, { color }]}>
                    {rev >= 1000 ? `${(rev / 1000).toFixed(1)}k` : rev}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Pie-style Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>توزيع الاشتراكات حسب الرياضة</Text>
          <View style={styles.chartCard}>
            {stats.totalMembers === 0 ? (
              <Text style={styles.noDataText}>لا توجد بيانات بعد</Text>
            ) : (
              <>
                {/* Visual Pie Bar */}
                <View style={styles.pieBar}>
                  {sports.map(({ sport, color }) => {
                    const count = stats.sportCounts[sport] ?? 0;
                    if (count === 0) return null;
                    const pct = stats.totalMembers > 0 ? (count / stats.totalMembers) * 100 : 0;
                    return (
                      <View
                        key={sport}
                        style={[
                          styles.pieSegment,
                          { flex: count, backgroundColor: color },
                        ]}
                      />
                    );
                  })}
                </View>

                {/* Legend */}
                <View style={styles.legend}>
                  {sports.map(({ sport, label, color }) => {
                    const count = stats.sportCounts[sport] ?? 0;
                    const pct =
                      stats.totalMembers > 0
                        ? ((count / stats.totalMembers) * 100).toFixed(1)
                        : '0';
                    return (
                      <View key={sport} style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendDot,
                            { backgroundColor: color },
                          ]}
                        />
                        <Text style={styles.legendLabel}>{label}</Text>
                        <Text style={[styles.legendPct, { color }]}>
                          {pct}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Active vs Expired */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الاشتراكات النشطة مقابل المنتهية</Text>
          <View style={styles.chartCard}>
            {stats.totalMembers === 0 ? (
              <Text style={styles.noDataText}>لا توجد بيانات بعد</Text>
            ) : (
              <>
                <View style={styles.statusPieBar}>
                  {stats.totalActive > 0 ? (
                    <View
                      style={[
                        styles.statusSegment,
                        { flex: stats.totalActive, backgroundColor: Colors.success },
                      ]}
                    />
                  ) : null}
                  {stats.totalExpiring > 0 ? (
                    <View
                      style={[
                        styles.statusSegment,
                        { flex: stats.totalExpiring, backgroundColor: Colors.warning },
                      ]}
                    />
                  ) : null}
                  {stats.totalExpired > 0 ? (
                    <View
                      style={[
                        styles.statusSegment,
                        { flex: stats.totalExpired, backgroundColor: Colors.danger },
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.statusCards}>
                  <View style={[styles.statusCard, { borderColor: Colors.success + '40' }]}>
                    <Text style={[styles.statusCardValue, { color: Colors.success }]}>
                      {stats.totalActive}
                    </Text>
                    <Text style={styles.statusCardLabel}>نشط</Text>
                    <Text style={[styles.statusCardPct, { color: Colors.success }]}>
                      {stats.totalMembers > 0
                        ? ((stats.totalActive / stats.totalMembers) * 100).toFixed(0)
                        : 0}
                      %
                    </Text>
                  </View>
                  <View style={[styles.statusCard, { borderColor: Colors.warning + '40' }]}>
                    <Text style={[styles.statusCardValue, { color: Colors.warning }]}>
                      {stats.totalExpiring}
                    </Text>
                    <Text style={styles.statusCardLabel}>ينتهي قريباً</Text>
                    <Text style={[styles.statusCardPct, { color: Colors.warning }]}>
                      {stats.totalMembers > 0
                        ? ((stats.totalExpiring / stats.totalMembers) * 100).toFixed(0)
                        : 0}
                      %
                    </Text>
                  </View>
                  <View style={[styles.statusCard, { borderColor: Colors.danger + '40' }]}>
                    <Text style={[styles.statusCardValue, { color: Colors.danger }]}>
                      {stats.totalExpired}
                    </Text>
                    <Text style={styles.statusCardLabel}>منتهي</Text>
                    <Text style={[styles.statusCardPct, { color: Colors.danger }]}>
                      {stats.totalMembers > 0
                        ? ((stats.totalExpired / stats.totalMembers) * 100).toFixed(0)
                        : 0}
                      %
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.reports + '30',
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
  content: {
    padding: Spacing.xl,
  },
  shiftCard: {
    backgroundColor: Colors.reportsDim,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.reports + '45',
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  shiftHeading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.md,
  },
  shiftTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
    textAlign: 'right',
  },
  shiftSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: 3,
  },
  endShiftButton: {
    backgroundColor: Colors.danger,
    minHeight: 48,
    borderRadius: Radius.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  endShiftText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  exportCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  exportHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.md,
  },
  exportIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportHeading: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  exportTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'right',
  },
  exportDescription: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  excelButton: {
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.reports,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  excelButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  shareLabel: {
    color: Colors.textSecondary,
    textAlign: 'right',
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  shareButtons: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  shareButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  whatsappButton: {
    backgroundColor: '#168C52',
  },
  smsButton: {
    backgroundColor: '#3567B7',
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  gameFinanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  gameFinanceTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800', textAlign: 'right' },
  gameFinanceRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  gameFinanceMetric: { flex: 1, alignItems: 'flex-end', gap: 4 },
  gameFinanceLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'right' },
  gameFinanceValue: { fontSize: FontSize.md, fontWeight: '900', textAlign: 'right' },
  gameFinanceDivider: { width: 1, height: 36, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  gameFinanceNote: { color: Colors.textMuted, fontSize: 10, textAlign: 'right' },
  revenueCard: {
    backgroundColor: Colors.reportsDim,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  revenueTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  revIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  revenueLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
  },
  revenueMeta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  revenueMetaItem: {
    alignItems: 'center',
    flex: 1,
  },
  revenueMetaValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  revenueMetaLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  revenueDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  barRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  barLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: 72,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    width: 36,
    textAlign: 'left',
  },
  noDataText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  pieBar: {
    flexDirection: 'row-reverse',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  pieSegment: {
    height: '100%',
  },
  legend: {
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  legendPct: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statusPieBar: {
    flexDirection: 'row-reverse',
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  statusSegment: {
    height: '100%',
  },
  statusCards: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  statusCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusCardValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  statusCardLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginVertical: 2,
    textAlign: 'center',
  },
  statusCardPct: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
