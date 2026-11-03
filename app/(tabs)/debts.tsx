import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTableGames } from '@/hooks/useTableGames';
import { useAlert } from '@/contexts/AlertContext';

function openWhatsAppReminder(name: string, phone: string, source: string, due: number) {
  const number = phone.replace(/[^\d]/g, '');
  const message = `السلام عليكم ${name}، نذكّركم بالمبلغ المتبقي وقدره ${due.toLocaleString('ar-SA')} ر.ي عن ${source}. نرجو التكرم بالسداد، وشكراً لكم.`;
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  void Linking.openURL(url).catch(() => Alert.alert('واتساب غير متاح', 'تعذر فتح واتساب على هذا الجهاز.'));
}

export default function DebtsScreen() {
  const insets = useSafeAreaInsets();
  const { debts, settleDebt } = useTableGames();
  const { showAlert } = useAlert();
  const [settlingDebtIds, setSettlingDebtIds] = useState<Set<string>>(() => new Set());
  const visibleDebts = debts.filter((debt) => !settlingDebtIds.has(debt.id));
  const totalDue = visibleDebts.reduce((sum, debt) => sum + debt.amountDue, 0);

  const settle = async (debtId: string) => {
    setSettlingDebtIds((current) => new Set(current).add(debtId));
    try {
      await settleDebt(debtId);
    } catch (error: unknown) {
      setSettlingDebtIds((current) => {
        const updated = new Set(current);
        updated.delete(debtId);
        return updated;
      });
      showAlert('تعذر تسجيل التحصيل', error instanceof Error ? error.message : 'حدث خطأ أثناء تسوية الدين.');
      return;
    }
    setSettlingDebtIds((current) => {
      const updated = new Set(current);
      updated.delete(debtId);
      return updated;
    });
  };

  const confirmSettlement = (debtId: string, debtorName: string, amount: number) => {
    showAlert('تسوية الدين', `تأكيد استلام ${amount.toLocaleString('ar-SA')} ر.ي نقداً من ${debtorName}؟ سيتم تسجيل المبلغ في الوردية النشطة.`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد التحصيل', onPress: () => { void settle(debtId); } },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.icon}><MaterialIcons name="account-balance-wallet" size={18} color={Colors.warning} /></View>
        <View style={styles.heading}>
          <Text style={styles.title}>ديون الألعاب</Text>
          <Text style={styles.subtitle}>البلياردو، تنس الطاولة، والألعاب الأخرى فقط</Text>
        </View>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>إجمالي المبالغ المتبقية</Text>
        <Text style={styles.totalValue}>{totalDue.toLocaleString('ar-SA')} ر.ي</Text>
        <Text style={styles.totalMeta}>{visibleDebts.length} دين مستحق</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visibleDebts.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="check-circle-outline" size={44} color={Colors.success} />
            <Text style={styles.emptyTitle}>لا توجد ديون ألعاب مستحقة</Text>
            <Text style={styles.emptyText}>تظهر هنا المبالغ المتبقية لجلسات الطاولات والألعاب الأخرى.</Text>
          </View>
        ) : visibleDebts.map((debt) => (
          <View key={debt.id} style={styles.debtCard}>
            <View style={styles.cardTop}>
              <View style={styles.dueBadge}>
                <Text style={styles.dueAmount}>{debt.amountDue.toLocaleString('ar-SA')} ر.ي</Text>
                <Text style={styles.dueLabel}>المتبقي</Text>
              </View>
              <View style={styles.identity}>
                <Text style={styles.name}>{debt.debtorName}</Text>
                <Text style={styles.source}>{debt.sourceLabel}</Text>
              </View>
              <MaterialIcons name={debt.sourceType === 'othergame' ? 'videogame-asset' : 'sports-esports'} size={17} color={Colors.reports} />
            </View>
            <View style={styles.details}>
              <View style={styles.detailRow}><MaterialIcons name="phone" size={11} color={Colors.textMuted} /><Text style={styles.detailText}>{debt.debtorPhone}</Text></View>
              <View style={styles.detailRow}><MaterialIcons name="event" size={11} color={Colors.textMuted} /><Text style={styles.detailText}>{new Date(debt.date).toLocaleString('ar-SA')}</Text></View>
            </View>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyText}>الإجمالي {debt.totalAmount.toLocaleString('ar-SA')}</Text>
              <Text style={styles.moneyText}>المدفوع {debt.amountPaid.toLocaleString('ar-SA')}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" style={({ pressed }) => [styles.whatsappButton, pressed && { opacity: 0.75 }]} onPress={() => openWhatsAppReminder(debt.debtorName, debt.debtorPhone, debt.sourceLabel, debt.amountDue)}>
                <MaterialIcons name="chat" size={14} color={Colors.white} />
                <Text style={styles.actionText}>تذكير واتساب</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={settlingDebtIds.has(debt.id)} style={({ pressed }) => [styles.settleButton, pressed && { opacity: 0.75 }]} onPress={() => confirmSettlement(debt.id, debt.debtorName, debt.amountDue)}>
                <MaterialIcons name="payments" size={14} color={Colors.white} />
                <Text style={styles.actionText}>تحصيل / تسوية</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: Spacing.xl, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon: { width: 30, height: 30, borderRadius: Radius.md, backgroundColor: Colors.warning + '20', alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, alignItems: 'flex-end' },
  title: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2, textAlign: 'right' },
  totalCard: { margin: 15, padding: 12, borderRadius: Radius.lg, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.warning + '50', alignItems: 'flex-end' },
  totalLabel: { color: Colors.textSecondary, fontSize: FontSize.sm },
  totalValue: { color: Colors.warning, fontSize: FontSize.xxl, fontWeight: '900', marginTop: 3 },
  totalMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 30, gap: 9 },
  empty: { alignItems: 'center', padding: 18, gap: 9, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  debtCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, gap: 9 },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  identity: { flex: 1, alignItems: 'flex-end' },
  name: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  source: { color: Colors.reports, fontSize: FontSize.sm, fontWeight: '700', marginTop: 2 },
  dueBadge: { alignItems: 'flex-end' },
  dueAmount: { color: Colors.warning, fontSize: FontSize.md, fontWeight: '900' },
  dueLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  details: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 },
  detailRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  detailText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  moneyRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', borderTopWidth: 1, borderColor: Colors.border, paddingTop: 6 },
  moneyText: { color: Colors.textMuted, fontSize: FontSize.xs },
  actions: { flexDirection: 'row-reverse', gap: 6 },
  whatsappButton: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: '#168A4A', paddingVertical: 9, paddingHorizontal: 6, borderRadius: Radius.md },
  settleButton: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: Colors.reports, paddingVertical: 9, paddingHorizontal: 6, borderRadius: Radius.md },
  actionText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '800' },
});
