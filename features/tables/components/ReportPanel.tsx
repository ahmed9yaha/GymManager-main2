import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTableGames } from '@/hooks/useTableGames';
import { SessionRecord } from '@/services/tableGames';

interface ReportPanelProps {
  label: string;
  from: Date;
  to: Date;
  getReport: (from: Date, to: Date) => ReturnType<ReturnType<typeof useTableGames>['getReport']>;
  onShare: (records: SessionRecord[], from: Date, to: Date) => void;
  onExport: () => void;
  exporting: boolean;
}

const BILLIARDS_COLOR = '#F97316';
const BILLIARDS_DIM = '#2D1500';
const TT_COLOR = '#06B6D4';
const TT_DIM = '#001E24';

export function ReportPanel({ label, from, to, getReport, onShare, onExport, exporting }: ReportPanelProps) {
  const data = useMemo(() => getReport(from, to), [getReport, from, to]);
  const totalWholeMinutes = Math.max(0, Math.round(data.totalMinutes));
  const totalHours = totalWholeMinutes >= 60
    ? `${Math.floor(totalWholeMinutes / 60)}س و ${totalWholeMinutes % 60}د`
    : `${totalWholeMinutes}د`;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}><MaterialIcons name="bar-chart" size={16} color={Colors.reports} /><Text style={styles.label}>{label}</Text></View>
      {data.totalSessions === 0 ? (
        <View style={styles.emptyWrap}><MaterialIcons name="inbox" size={32} color={Colors.textMuted} /><Text style={styles.empty}>لا توجد جلسات مسجلة في هذه الفترة</Text></View>
      ) : <>
        <View style={[styles.totalCard, { borderColor: Colors.reports + '40' }]}>
          <View style={styles.totalLeft}><Text style={styles.totalLabel}>إجمالي تكلفة الجلسات</Text><Text style={[styles.totalValue, { color: Colors.reports }]}>{Math.round(data.totalCost).toLocaleString('ar-SA')} ريال يمني</Text></View>
          <View style={[styles.totalIcon, { backgroundColor: Colors.reportsDim }]}><MaterialIcons name="account-balance-wallet" size={26} color={Colors.reports} /></View>
        </View>
        <View style={styles.financeRow}>
          <View style={styles.financeMetric}><Text style={styles.financeLabel}>الكاش المحصل</Text><Text style={[styles.financeValue, { color: Colors.success }]}>{Math.round(data.cashIncome).toLocaleString('ar-SA')} ريال يمني</Text></View>
          <View style={styles.financeMetric}><Text style={styles.financeLabel}>الديون القائمة</Text><Text style={[styles.financeValue, { color: Colors.warning }]}>{Math.round(data.outstandingDebt).toLocaleString('ar-SA')} ريال يمني</Text></View>
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: Colors.statBlueDim, borderColor: Colors.statBlue + '30' }]}><MaterialIcons name="table-restaurant" size={14} color={Colors.statBlue} /><Text style={[styles.metaChipText, { color: Colors.statBlue }]}>{data.totalSessions} جلسة</Text></View>
          <View style={[styles.metaChip, { backgroundColor: Colors.statYellowDim, borderColor: Colors.statYellow + '30' }]}><MaterialIcons name="schedule" size={14} color={Colors.statYellow} /><Text style={[styles.metaChipText, { color: Colors.statYellow }]}>{totalHours}</Text></View>
        </View>
        <View style={styles.breakdown}>
          <View style={[styles.breakCard, { backgroundColor: BILLIARDS_DIM, borderColor: BILLIARDS_COLOR + '30' }]}>
            <MaterialCommunityIcons name="billiards" size={20} color={BILLIARDS_COLOR} /><Text style={[styles.breakName, { color: BILLIARDS_COLOR }]}>بلياردو</Text><Text style={[styles.breakCount, { color: Colors.textSecondary }]}>{data.billiardsCount} جلسة</Text><Text style={[styles.breakCost, { color: BILLIARDS_COLOR }]}>{Math.round(data.billiardsCost).toLocaleString('ar-SA')} ريال يمني</Text>
          </View>
          <View style={[styles.breakCard, { backgroundColor: TT_DIM, borderColor: TT_COLOR + '30' }]}>
            <MaterialIcons name="sports-tennis" size={20} color={TT_COLOR} /><Text style={[styles.breakName, { color: TT_COLOR }]}>تنس الطاولة</Text><Text style={[styles.breakCount, { color: Colors.textSecondary }]}>{data.ttCount} جلسة</Text><Text style={[styles.breakCost, { color: TT_COLOR }]}>{Math.round(data.ttCost).toLocaleString('ar-SA')} ريال يمني</Text>
          </View>
          <View style={[styles.breakCard, { backgroundColor: Colors.reportsDim, borderColor: Colors.reports + '30' }]}>
            <MaterialIcons name="videogame-asset" size={20} color={Colors.reports} /><Text style={[styles.breakName, { color: Colors.reports }]}>ألعاب أخرى</Text><Text style={[styles.breakCount, { color: Colors.textSecondary }]}>{data.otherGameCount} جلسة</Text><Text style={[styles.breakCost, { color: Colors.reports }]}>{Math.round(data.otherGameCost).toLocaleString('ar-SA')} ريال يمني</Text>
          </View>
        </View>
      </>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.actionButton, styles.whatsappAction, pressed && { opacity: 0.75 }]} onPress={() => onShare(data.records, from, to)}><MaterialIcons name="chat" size={17} color={Colors.white} /><Text style={styles.actionText}>مشاركة التقرير عبر واتساب</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={exporting} style={({ pressed }) => [styles.actionButton, styles.excelAction, (pressed || exporting) && { opacity: 0.72 }]} onPress={onExport}><MaterialIcons name={exporting ? 'hourglass-top' : 'table-view'} size={17} color={Colors.white} /><Text style={styles.actionText}>{exporting ? 'جارٍ تجهيز Excel…' : 'تصدير جلسات الألعاب Excel'}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  labelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  empty: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  totalCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.reportsDim, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, gap: Spacing.md },
  totalLeft: { flex: 1, alignItems: 'flex-end' },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  totalValue: { fontSize: FontSize.xxl, fontWeight: '800' },
  financeRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  financeMetric: { flex: 1, alignItems: 'flex-end', gap: 3 },
  financeLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  financeValue: { fontSize: FontSize.sm, fontWeight: '800' },
  totalIcon: { width: 50, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1 },
  metaChipText: { fontSize: FontSize.xs, fontWeight: '700' },
  breakdown: { flexDirection: 'row-reverse', gap: Spacing.sm },
  breakCard: { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-end', gap: 3, borderWidth: 1 },
  breakName: { fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right' },
  breakCount: { fontSize: FontSize.xs, textAlign: 'right' },
  breakCost: { fontSize: FontSize.md, fontWeight: '800', textAlign: 'right', marginTop: 2 },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  actionButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md },
  whatsappAction: { backgroundColor: '#168A4A' },
  excelAction: { backgroundColor: Colors.reports },
  actionText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '800' },
});
