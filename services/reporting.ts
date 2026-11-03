import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { Member, SportKey, getMemberStatus } from '@/services/storage';
import { calcCost, calcElapsedSeconds, GameDebt, GameType, OtherGameSaleRecord, SessionRecord, TableSession, modeLabel } from '@/services/tableGames';
import { WorkShift } from '@/contexts/ShiftContext';
import type { Coach } from '@/services/coaches';

export type ReportMembers = Record<SportKey, Member[]>;

/** Coach share is a live percentage of all currently valid subscriptions for that sport. */
export function calculateCoachEarnings(coach: Coach, members: Member[], now = new Date()): number {
  const activeRevenue = members
    .filter((member) => member.sport === coach.gameKey
      && Number.isFinite(new Date(member.startDate).getTime())
      && new Date(member.startDate).getTime() <= now.getTime()
      && Number.isFinite(new Date(member.endDate).getTime())
      && getMemberStatus(member.endDate) !== 'expired')
    .reduce((total, member) => total + (Number.isFinite(member.fee) ? member.fee : 0), 0);
  return Math.round(activeRevenue * coach.profitPercentage / 100);
}

export interface OfflineReportData {
  members: ReportMembers;
  sportLabels?: Record<string, string>;
  records: SessionRecord[];
  shifts?: WorkShift[];
  debts?: GameDebt[];
  otherGameSales?: OtherGameSaleRecord[];
  activeSessions?: TableSession[];
  includeAllHistory?: boolean;
  now?: Date;
}

const SPORT_LABELS: Record<SportKey, string> = {
  boxing: 'ملاكمة',
  kickboxing: 'كيك بوكسينغ',
  karate: 'كاراتيه',
  gymnastics: 'جمباز',
};

const GAME_LABELS = {
  billiards: 'بلياردو',
  tabletennis: 'تنس الطاولة',
} as const;

function gameLabel(gameType: GameType, customName?: string): string {
  if (gameType === 'othergame') return customName || 'ألعاب أخرى';
  return GAME_LABELS[gameType];
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime() };
}

function formatDate(date: string | Date): string {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleString('ar-SA');
}

function formatDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return hours ? `${hours} ساعة و${remainder} دقيقة` : `${remainder} دقيقة`;
}

function roundRial(amount: number): number {
  return Math.round(Number.isFinite(amount) ? amount : 0);
}

function formatWholeRial(amount: number): string {
  return `${roundRial(amount).toLocaleString('ar-SA')} ريال يمني`;
}

function formatClock(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-SA');
}

export function buildGamesArabicReport(records: SessionRecord[], from: Date, to: Date): string {
  const totalProfit = records.reduce((sum, record) => sum + record.finalCost, 0);
  const totalMinutes = records.reduce((sum, record) => sum + record.durationMinutes, 0);
  const groups = new Map<string, SessionRecord[]>();
  records.forEach((record) => {
    const label = gameLabel(record.gameType, record.gameName);
    groups.set(label, [...(groups.get(label) ?? []), record]);
  });
  const lines = [
    '🎮 تقرير الألعاب الأخرى',
    `📅 الفترة: ${from.toLocaleDateString('ar-SA')} — ${to.toLocaleDateString('ar-SA')}`,
    `💰 إجمالي الأرباح: ${formatWholeRial(totalProfit)}`,
    `🧾 عدد الجلسات: ${records.length}`,
    `⏱ إجمالي الوقت: ${formatDuration(totalMinutes)}`,
    '',
    '📊 التفصيل حسب نوع اللعبة:',
    ...[...groups.entries()].map(([label, gameRecords]) => {
      const profit = gameRecords.reduce((sum, record) => sum + record.finalCost, 0);
      return `• ${label}: ${gameRecords.length} جلسة — ${formatWholeRial(profit)}`;
    }),
    '',
    '🗒 سجلات الجلسات:',
    ...(records.length ? records.map((record, index) => [
      `${index + 1}. ${gameLabel(record.gameType, record.gameName)} — ${record.tableName || `طاولة ${record.tableNumber}`} (رقم ${record.tableNumber})`,
      `   البداية: ${formatClock(record.startTime)} | النهاية: ${formatClock(record.endTime)}`,
      `   المدة: ${formatDuration(record.durationMinutes)} | الربح: ${formatWholeRial(record.finalCost)}`,
    ].join('\n')) : ['لا توجد جلسات مسجلة في هذه الفترة.']),
  ];
  return lines.join('\n');
}

export async function shareGamesArabicReport(records: SessionRecord[], from: Date, to: Date): Promise<void> {
  const message = buildGamesArabicReport(records, from, to);
  const encodedMessage = encodeURIComponent(message);
  const url = Platform.OS === 'web'
    ? `https://wa.me/?text=${encodedMessage}`
    : `whatsapp://send?text=${encodedMessage}`;
  try {
    await Linking.openURL(url);
  } catch {
    if (Platform.OS !== 'web') {
      try {
        await Linking.openURL(`https://wa.me/?text=${encodedMessage}`);
        return;
      } catch {}
    }
    Alert.alert('واتساب غير متاح', 'تعذر فتح واتساب. تأكد من تثبيته ثم حاول مرة أخرى.');
  }
}

export async function exportGamesWorkbook(records: SessionRecord[], activeSessions: TableSession[], now = new Date()): Promise<string> {
  const workbook = XLSX.utils.book_new();
  const completedRows = records.map((record) => ({
    'نوع اللعبة': gameLabel(record.gameType, record.gameName),
    'رقم الطاولة': Math.round(record.tableNumber),
    'اسم الطاولة': record.tableName || `طاولة ${record.tableNumber}`,
    'وقت البداية': formatDate(record.startTime),
    'وقت النهاية': formatDate(record.endTime),
    'المدة بالدقائق': Math.round(record.durationMinutes),
    'المدة': formatDuration(record.durationMinutes),
    'الربح (ريال يمني)': Math.round(record.finalCost),
    'الحالة': 'مكتملة',
  }));
  const activeRows = activeSessions.filter((session) => session.isActive).map((session) => ({
    'نوع اللعبة': gameLabel(session.gameType, session.gameName),
    'رقم الطاولة': Math.round(session.tableNumber),
    'اسم الطاولة': session.tableName || `طاولة ${session.tableNumber}`,
    'وقت البداية': formatDate(session.startTime),
    'وقت النهاية': '',
    'المدة بالدقائق': Math.round(calcElapsedSeconds(session, now.getTime()) / 60),
    'المدة': formatDuration(calcElapsedSeconds(session, now.getTime()) / 60),
    'الربح (ريال يمني)': Math.round(calcCost(session, now.getTime())),
    'الحالة': 'نشطة — الربح تقديري',
  }));
  const rows = [...completedRows, ...activeRows];
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'نوع اللعبة': 'لا توجد جلسات مسجلة' }]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Games & Tables Sessions');

  const filename = `games-sessions-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xlsx`;
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof URL === 'undefined') throw new Error('تنزيل الملفات غير متاح في هذا المتصفح.');
    const workbookData = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([workbookData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    return filename;
  }

  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('مساحة تخزين الملفات غير متاحة على هذا الجهاز.');
  const fileUri = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!await Sharing.isAvailableAsync()) throw new Error('مشاركة الملفات غير متاحة على هذا الجهاز.');
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: 'تصدير جلسات الألعاب والطاولات',
  });
  return fileUri;
}

function getDailyMembers(data: OfflineReportData, now: Date) {
  const { start, end } = dayBounds(now);
  return Object.values(data.members).flat().filter((member) => {
    const createdAt = new Date(member.createdAt).getTime();
    return createdAt >= start && createdAt <= end;
  });
}

function getDailyRecords(data: OfflineReportData, now: Date) {
  const { start, end } = dayBounds(now);
  return data.records.filter((record) => {
    const endedAt = new Date(record.endTime).getTime();
    return endedAt >= start && endedAt <= end;
  });
}

function getGameCashTransactions(data: OfflineReportData, now: Date) {
  const { start, end } = dayBounds(now);
  return (data.shifts ?? []).flatMap((shift) => shift.transactions)
    .filter((transaction) => transaction.type !== 'subscription')
    .filter((transaction) => {
      const occurredAt = new Date(transaction.occurredAt).getTime();
      return occurredAt >= start && occurredAt <= end;
    });
}

function calculateDailyGameCash(data: OfflineReportData, records: SessionRecord[], now: Date): number {
  if (data.shifts) return getGameCashTransactions(data, now).reduce((sum, transaction) => sum + transaction.amount, 0);
  const { start, end } = dayBounds(now);
  const sales = (data.otherGameSales ?? []).filter((sale) => {
    const at = new Date(sale.date).getTime();
    return at >= start && at <= end;
  });
  return records.reduce((sum, record) => sum + (Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost), 0)
    + sales.reduce((sum, sale) => sum + sale.amountPaid, 0);
}

export function buildDailyArabicReport(data: OfflineReportData): string {
  const now = data.now ?? new Date();
  const dailyRecords = getDailyRecords(data, now);
  const dailyMembers = getDailyMembers(data, now);
  const billiards = dailyRecords.filter((record) => record.gameType === 'billiards');
  const tableTennis = dailyRecords.filter((record) => record.gameType === 'tabletennis');
  const customGameRecords = dailyRecords.filter((record) => record.gameType === 'othergame');
  const customGameGroups = [...new Set(customGameRecords.map((record) => record.gameName || record.tableName || 'ألعاب أخرى'))];
  const subscriptionRevenue = dailyMembers.reduce((sum, member) => sum + member.fee, 0);
  const dailyGameTransactions = getGameCashTransactions(data, now);
  const billiardsRevenue = data.shifts
    ? dailyGameTransactions.filter((transaction) => transaction.type === 'billiards').reduce((sum, transaction) => sum + transaction.amount, 0)
    : billiards.reduce((sum, record) => sum + (Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost), 0);
  const tableTennisRevenue = data.shifts
    ? dailyGameTransactions.filter((transaction) => transaction.type === 'tabletennis').reduce((sum, transaction) => sum + transaction.amount, 0)
    : tableTennis.reduce((sum, record) => sum + (Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost), 0);
  const gameCashIncome = calculateDailyGameCash(data, dailyRecords, now);
  const outstandingGameDebts = (data.debts ?? []).reduce((sum, debt) => sum + debt.amountDue, 0);
  const totalRevenue = subscriptionRevenue + gameCashIncome;
  const totalMinutes = dailyRecords.reduce((sum, record) => sum + record.durationMinutes, 0);

  return [
    '📊 تقرير الأرباح اليومي لصالون الألعاب',
    `📅 التاريخ: ${now.toLocaleDateString('ar-SA')}`,
    '',
    '🎱 الألعاب والطاولات:',
    `• البلياردو: ${billiards.length} جلسة — كاش ${formatWholeRial(billiardsRevenue)}`,
    `• تنس الطاولة: ${tableTennis.length} جلسة — كاش ${formatWholeRial(tableTennisRevenue)}`,
    ...customGameGroups.map((name) => {
      const sessions = customGameRecords.filter((record) => (record.gameName || record.tableName || 'ألعاب أخرى') === name);
      const amount = sessions.reduce((sum, record) => sum + (Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost), 0);
      return `• ${name}: ${sessions.length} جلسة — كاش ${formatWholeRial(amount)}`;
    }),
    `• دخل الألعاب النقدي: ${formatWholeRial(gameCashIncome)}`,
    `• ديون الألعاب القائمة: ${formatWholeRial(outstandingGameDebts)}`,
    '',
    '👥 الاشتراكات:',
    `• اشتراكات جديدة: ${dailyMembers.length} — ${formatWholeRial(subscriptionRevenue)}`,
    '',
    `💰 إجمالي الكاش المحصل اليوم: ${formatWholeRial(totalRevenue)}`,
    `⏱ إجمالي الجلسات: ${dailyRecords.length}`,
    `⌛ مدة اللعب الإجمالية: ${formatDuration(totalMinutes)}`,
  ].join('\n');
}

export async function exportComprehensiveWorkbook(data: OfflineReportData): Promise<string> {
  const now = data.now ?? new Date();
  const workbook = XLSX.utils.book_new();
  const members = Object.entries(data.members).flatMap(([sport, sportMembers]) =>
    sportMembers.map((member) => ({
      'الاسم': member.name,
      'النشاط': SPORT_LABELS[sport as SportKey] ?? data.sportLabels?.[sport] ?? sport,
      'الحالة': ({ active: 'نشط', expiring: 'ينتهي قريباً', expired: 'منتهي' } as const)[getMemberStatus(member.endDate)],
      'الرسوم (ر.ي)': roundRial(member.fee),
      'رقم الهاتف': member.phone ?? '',
      'تاريخ بداية الاشتراك': formatDate(member.startDate),
      'تاريخ نهاية الاشتراك': formatDate(member.endDate),
      'تاريخ التسجيل': formatDate(member.createdAt),
    }))
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(members.length ? members : [{ 'الاسم': 'لا توجد بيانات' }]),
    'Subscribers'
  );

  const records = (data.includeAllHistory ? data.records : getDailyRecords(data, now)).map((record) => ({
    'اللعبة': gameLabel(record.gameType, record.gameName),
    'رقم الطاولة': record.tableNumber,
    'اسم الطاولة': record.tableName || `طاولة ${record.tableNumber}`,
    'نوع الوقت': record.mode === 'open' ? 'وقت مفتوح' : `وقت ثابت (${modeLabel(record.mode)})`,
    'وقت البداية': formatDate(record.startTime),
    'وقت النهاية': formatDate(record.endTime),
    'المدة': formatDuration(record.durationMinutes),
    'المدة بالدقائق': Math.round(record.durationMinutes),
    'السعر بالساعة (ر.ي)': roundRial(record.hourlyRate),
    'التكلفة (ر.ي)': roundRial(record.finalCost),
    'المبلغ الإجمالي (ر.ي)': roundRial(Number.isFinite(record.totalAmount) ? record.totalAmount : record.finalCost),
    'المبلغ المدفوع كاش (ر.ي)': roundRial(Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost),
    'المبلغ المتبقي / دين (ر.ي)': roundRial(Number.isFinite(record.amountDue) ? record.amountDue : 0),
    'اسم المدين': record.debtorName ?? '',
    'هاتف المدين': record.debtorPhone ?? '',
    'معرف الوردية': record.shiftId ?? '',
    'الموظف': record.employeeName ?? '',
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(records.length ? records : [{ 'اللعبة': 'لا توجد جلسات مسجلة' }]),
    'Billiards & Tennis Reports'
  );

  if (data.includeAllHistory) {
    const activeSessions = (data.activeSessions ?? []).filter((session) => session.isActive).map((session) => ({
      'اللعبة': gameLabel(session.gameType, session.gameName),
      'رقم الطاولة': session.tableNumber,
      'اسم الطاولة': session.tableName || `طاولة ${session.tableNumber}`,
      'وقت البداية': formatDate(session.startTime),
      'نوع الوقت': session.mode === 'open' ? 'وقت مفتوح' : `وقت ثابت (${modeLabel(session.mode)})`,
      'السعر بالساعة (ر.ي)': roundRial(session.hourlyRate),
      'معرف الوردية': session.shiftId ?? '',
      'الموظف': session.employeeName ?? '',
    }));
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(activeSessions.length ? activeSessions : [{ 'اللعبة': 'لا توجد جلسات نشطة' }]),
      'Active Sessions'
    );
  }

  const shiftTransactions = (data.shifts ?? []).flatMap((shift) => shift.transactions.map((transaction) => ({
    'معرف الوردية': shift.id,
    'الموظف': shift.employeeName,
    'نوع التحصيل': transaction.type === 'billiards' ? 'بلياردو'
      : transaction.type === 'tabletennis' ? 'تنس الطاولة'
        : transaction.type === 'othergame' ? 'ألعاب أخرى' : 'اشتراك',
    'التفاصيل': transaction.description,
    'المبلغ المحصل (ر.ي)': roundRial(transaction.amount),
    'وقت التحصيل': formatDate(transaction.occurredAt),
    'معرف العملية': transaction.id,
    'معرف المرجع': transaction.referenceId ?? '',
  })));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(shiftTransactions.length ? shiftTransactions : [{ 'نوع التحصيل': 'لا توجد عمليات ورديات مسجلة' }]),
    'Shift Transactions'
  );

  const shiftHistory = (data.shifts ?? []).map((shift) => {
    const totals = shift.transactions.reduce((sum, transaction) => {
      sum[transaction.type] += transaction.amount;
      return sum;
    }, { billiards: 0, tabletennis: 0, othergame: 0, subscription: 0 });
    return {
      'معرف الوردية': shift.id,
      'الموظف': shift.employeeName,
      'بداية الوردية': formatDate(shift.startedAt),
      'نهاية الوردية': formatDate(shift.endedAt ?? ''),
      'الحالة': shift.endedAt ? 'مغلقة' : 'نشطة',
      'عمليات البلياردو': roundRial(totals.billiards),
      'عمليات تنس الطاولة': roundRial(totals.tabletennis),
      'عمليات الألعاب الأخرى': roundRial(totals.othergame),
      'عمليات الاشتراكات': roundRial(totals.subscription),
      'إجمالي التحصيل (ر.ي)': roundRial(Object.values(totals).reduce((sum, amount) => sum + amount, 0)),
      'عدد العمليات': shift.transactions.length,
    };
  });
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(shiftHistory.length ? shiftHistory : [{ 'معرف الوردية': 'لا توجد ورديات مسجلة' }]),
    'Shift History'
  );

  const { start: dayStart, end: dayEnd } = dayBounds(now);
  const gameCashTransactions = (data.shifts ?? []).flatMap((shift) => shift.transactions
    .filter((transaction) => transaction.type !== 'subscription')
    .filter((transaction) => data.includeAllHistory || (() => {
      const time = new Date(transaction.occurredAt).getTime();
      return time >= dayStart && time <= dayEnd;
    })())
    .map((transaction) => ({
      'الوردية': shift.id,
      'الموظف': shift.employeeName,
      'مصدر اللعبة': transaction.type === 'billiards' ? 'بلياردو'
        : transaction.type === 'tabletennis' ? 'تنس الطاولة' : 'ألعاب أخرى',
      'التفاصيل': transaction.description,
      'دخل الألعاب النقدي (ر.ي)': roundRial(transaction.amount),
      'وقت التحصيل': formatDate(transaction.occurredAt),
      'معرف المرجع': transaction.referenceId ?? '',
    })));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(gameCashTransactions.length ? gameCashTransactions : [{ 'مصدر اللعبة': 'لا توجد إيرادات ألعاب نقدية' }]),
    'Games Cash Income'
  );

  const outstandingDebts = (data.debts ?? []).map((debt) => ({
    'اسم المدين': debt.debtorName,
    'رقم الهاتف': debt.debtorPhone,
    'مصدر اللعبة': debt.sourceLabel,
    'التاريخ': formatDate(debt.date),
    'المبلغ الإجمالي (ر.ي)': roundRial(debt.totalAmount),
    'المبلغ المدفوع (ر.ي)': roundRial(debt.amountPaid),
    'المبلغ المستحق (ر.ي)': roundRial(debt.amountDue),
    'الوردية': debt.shiftId ?? '',
    'الموظف': debt.employeeName ?? '',
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(outstandingDebts.length ? outstandingDebts : [{ 'اسم المدين': 'لا توجد ديون ألعاب مستحقة' }]),
    'Games Outstanding Debts'
  );

  const otherGameSales = (data.includeAllHistory ? (data.otherGameSales ?? []) : (data.otherGameSales ?? []).filter((sale) => {
    const time = new Date(sale.date).getTime();
    return time >= dayStart && time <= dayEnd;
  })).map((sale) => ({
    'اللعبة': sale.sourceLabel,
    'التاريخ': formatDate(sale.date),
    'الإجمالي (ر.ي)': roundRial(sale.totalAmount),
    'المدفوع كاش (ر.ي)': roundRial(sale.amountPaid),
    'المتبقي (ر.ي)': roundRial(sale.amountDue),
    'اسم المدين': sale.debtorName,
    'هاتف المدين': sale.debtorPhone,
    'الوردية': sale.shiftId ?? '',
    'الموظف': sale.employeeName ?? '',
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(otherGameSales.length ? otherGameSales : [{ 'اللعبة': 'لا توجد مبيعات ألعاب أخرى مسجلة' }]),
    'Other Games Sales'
  );

  const dailyRecords = getDailyRecords(data, now);
  const dailyMembers = getDailyMembers(data, now);
  const summaryRows = [
    ...(['billiards', 'tabletennis'] as const).map((gameType) => {
      const gameRecords = dailyRecords.filter((record) => record.gameType === gameType);
      return {
        'البند': GAME_LABELS[gameType],
        'عدد الجلسات': gameRecords.length,
        'دخل الكاش (ر.ي)': roundRial(gameRecords.reduce((sum, record) => sum + (Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost), 0)),
        'الدين الناتج (ر.ي)': roundRial(gameRecords.reduce((sum, record) => sum + (Number.isFinite(record.amountDue) ? record.amountDue : 0), 0)),
      };
    }),
    ...[...new Set(dailyRecords.filter((record) => record.gameType === 'othergame')
      .map((record) => record.gameName || record.tableName || 'ألعاب أخرى'))].map((gameName) => {
      const gameRecords = dailyRecords.filter((record) => record.gameType === 'othergame'
        && (record.gameName || record.tableName || 'ألعاب أخرى') === gameName);
      return {
        'البند': gameName,
        'عدد الجلسات': gameRecords.length,
        'دخل الكاش (ر.ي)': roundRial(gameRecords.reduce((sum, record) => sum + (Number.isFinite(record.amountPaid) ? record.amountPaid : record.finalCost), 0)),
        'الدين الناتج (ر.ي)': roundRial(gameRecords.reduce((sum, record) => sum + (Number.isFinite(record.amountDue) ? record.amountDue : 0), 0)),
      };
    }),
    ...(['boxing', 'kickboxing', 'karate', 'gymnastics'] as const).map((sport) => {
      const sportMembers = dailyMembers.filter((member) => member.sport === sport);
      return {
        'البند': `اشتراكات ${SPORT_LABELS[sport]}`,
        'عدد الجلسات': sportMembers.length,
        'إجمالي الإيراد اليومي (ر.ي)': roundRial(sportMembers.reduce((sum, member) => sum + member.fee, 0)),
      };
    }),
    {
      'البند': 'إجمالي الاشتراكات الجديدة',
      'عدد الجلسات': dailyMembers.length,
      'إجمالي الإيراد اليومي (ر.ي)': roundRial(dailyMembers.reduce((sum, member) => sum + member.fee, 0)),
    },
    {
      'البند': 'دخل الألعاب النقدي',
      'عدد الجلسات': '',
      'إجمالي الإيراد اليومي (ر.ي)': roundRial(calculateDailyGameCash(data, dailyRecords, now)),
    },
    {
      'البند': 'ديون الألعاب المستحقة حالياً',
      'عدد الجلسات': (data.debts ?? []).length,
      'إجمالي الدين (ر.ي)': roundRial((data.debts ?? []).reduce((sum, debt) => sum + debt.amountDue, 0)),
    },
    {
      'البند': 'الإجمالي اليومي للنقد المحصل',
      'عدد الجلسات': dailyRecords.length + dailyMembers.length,
      'إجمالي الإيراد اليومي (ر.ي)': roundRial(calculateDailyGameCash(data, dailyRecords, now)
        + dailyMembers.reduce((sum, member) => sum + member.fee, 0)),
    },
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summaryRows),
    'Other Games & Stats'
  );

  const filename = `gym-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xlsx`;
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      throw new Error('تنزيل الملفات غير متاح في هذا المتصفح.');
    }
    const workbookData = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([workbookData], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    return filename;
  }

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('مساحة تخزين الملفات غير متاحة على هذا الجهاز.');
  const fileUri = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('مشاركة الملفات غير متاحة على هذا الجهاز.');
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: 'تصدير تقارير صالون الألعاب',
  });
  return fileUri;
}

export async function shareDailyReport(data: OfflineReportData, channel: 'whatsapp' | 'sms'): Promise<void> {
  const message = buildDailyArabicReport(data);
  const encodedMessage = encodeURIComponent(message);
  const url = channel === 'whatsapp'
    ? `whatsapp://send?text=${encodedMessage}`
    : Platform.OS === 'ios'
      ? `sms:&body=${encodedMessage}`
      : `sms:?body=${encodedMessage}`;

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      channel === 'whatsapp' ? 'واتساب غير متاح' : 'الرسائل غير متاحة',
      channel === 'whatsapp'
        ? 'تعذر فتح واتساب. تأكد من تثبيت التطبيق ثم حاول مرة أخرى.'
        : 'تعذر فتح تطبيق الرسائل على هذا الجهاز.'
    );
  }
}

export function buildShiftArabicReport(shift: WorkShift): string {
  const transactions = shift.transactions;
  const sum = (type: 'billiards' | 'tabletennis' | 'othergame' | 'subscription') =>
    transactions.filter((transaction) => transaction.type === type)
      .reduce((total, transaction) => total + transaction.amount, 0);
  const count = (type: 'billiards' | 'tabletennis' | 'othergame' | 'subscription') =>
    transactions.filter((transaction) => transaction.type === type).length;
  const billiards = sum('billiards');
  const tableTennis = sum('tabletennis');
  const otherGames = sum('othergame');
  const subscriptions = sum('subscription');
  const total = billiards + tableTennis + otherGames + subscriptions;
  const formatTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-SA');
  };

  return [
    '📋 تقرير إغلاق الوردية',
    `👤 الموظف: ${shift.employeeName}`,
    `🕒 بداية الوردية: ${formatTime(shift.startedAt)}`,
    `🕒 نهاية الوردية: ${formatTime(shift.endedAt ?? new Date().toISOString())}`,
    '',
    `🎱 البلياردو: ${count('billiards')} جلسة — ${formatWholeRial(billiards)}`,
    `🏓 تنس الطاولة: ${count('tabletennis')} جلسة — ${formatWholeRial(tableTennis)}`,
    `🎮 ألعاب أخرى: ${count('othergame')} عملية — ${formatWholeRial(otherGames)}`,
    `👥 الاشتراكات المحصلة: ${count('subscription')} — ${formatWholeRial(subscriptions)}`,
    `💰 إجمالي الكاش المحصل: ${formatWholeRial(total)}`,
    `🧾 عدد العمليات: ${transactions.length}`,
    `🔖 رقم الوردية: ${shift.id}`,
  ].join('\n');
}

export async function shareShiftReport(shift: WorkShift): Promise<void> {
  const message = buildShiftArabicReport(shift);
  try {
    const whatsappUrl = Platform.OS === 'web'
      ? `https://wa.me/?text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`;
    await Linking.openURL(whatsappUrl);
  } catch {
    Alert.alert('تم إغلاق الوردية', `${message}\n\nتعذر فتح واتساب. تم حفظ التقرير محلياً؛ يمكنك إعادة المحاولة من سجل الوردية أو نسخ النص يدوياً.`);
  }
}
