// Powered by OnSpace.AI
import React, { memo, useState } from 'react';
import { View, StyleSheet, Pressable, Linking, Alert, Platform, LayoutAnimation, UIManager } from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { Member, getMemberStatus, formatDate } from '@/services/storage';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';

const DEFAULT_COUNTRY_CODE = '967';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function normalizeInternationalPhone(phone: string): string | null {
  const arabicDigits = phone.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  const cleaned = arabicDigits.trim().replace(/[\s().-]/g, '');
  if (!cleaned || !/^\+?\d+$/.test(cleaned)) return null;

  let digits = cleaned;
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    // The country code was entered without the leading plus sign.
  } else {
    digits = `${DEFAULT_COUNTRY_CODE}${digits.replace(/^0+/, '')}`;
  }

  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
}

function createSubscriptionMessage(member: Member): string {
  const statusLabels = { active: 'نشط', expiring: 'ينتهي قريباً', expired: 'منتهي' };
  const status = getMemberStatus(member.endDate);

  return [
    `مرحباً كابتن ${member.name}، نود تذكيرك بتفاصيل اشتراكك في النادي:`,
    `حالة الاشتراك: ${statusLabels[status]}`,
    `تاريخ البداية: ${formatDate(member.startDate)}`,
    `تاريخ الانتهاء: ${formatDate(member.endDate)}`,
    `الرسوم: ${member.fee.toLocaleString('ar-SA')} ر.ي`,
    'نتطلع لرؤيتك في التمرين.',
  ].join('\n');
}

async function launchWhatsApp(member: Member): Promise<void> {
  const phone = member.phone ? normalizeInternationalPhone(member.phone) : null;
  if (!phone) {
    Alert.alert('رقم غير صالح', 'يرجى التأكد من رقم الهاتف مع رمز الدولة.');
    return;
  }

  const url = `whatsapp://send?phone=${phone.slice(1)}&text=${encodeURIComponent(createSubscriptionMessage(member))}`;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('Unable to open WhatsApp:', error);
    Alert.alert('تعذر فتح واتساب', 'تأكد من تثبيت واتساب على الجهاز ثم حاول مرة أخرى.');
  }
}

async function launchSms(member: Member): Promise<void> {
  const phone = member.phone ? normalizeInternationalPhone(member.phone) : null;
  if (!phone) {
    Alert.alert('رقم غير صالح', 'يرجى التأكد من رقم الهاتف مع رمز الدولة.');
    return;
  }

  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phone}${separator}body=${encodeURIComponent(createSubscriptionMessage(member))}`;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('Unable to open the SMS app:', error);
    Alert.alert('تعذر فتح الرسائل', 'لا يمكن فتح تطبيق الرسائل على هذا الجهاز.');
  }
}

interface MemberCardProps {
  member: Member;
  sportColor: string;
  onDelete: (id: string) => void;
  onRenew: (id: string) => void;
  onEdit: (id: string) => void;
}

export const MemberCard = memo(({ member, sportColor, onDelete, onRenew, onEdit }: MemberCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getMemberStatus(member.endDate);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((expanded) => !expanded);
  };

  const handlePhonePress = async () => {
    const phoneNumber = member.phone?.trim();
    if (!phoneNumber) return;

    try {
      const telUrl = `tel:${phoneNumber}`;
      if (await Linking.canOpenURL(telUrl)) {
        await Linking.openURL(telUrl);
        return;
      }
    } catch (error) {
      console.warn('Unable to start a phone call:', error);
    }

    try {
      await Clipboard.setStringAsync(phoneNumber);
      Alert.alert('', 'هذا الجهاز لا يدعم الاتصال الخلوي، تم نسخ الرقم تلقائياً!');
    } catch (error) {
      console.warn('Unable to copy the phone number:', error);
      Alert.alert('', 'تعذر نسخ الرقم، يرجى المحاولة يدوياً.');
    }
  };

  const statusConfig = {
    active: { label: 'نشط', icon: 'check-circle' as const },
    expiring: { label: 'ينتهي قريباً', icon: 'warning' as const },
    expired: { label: 'منتهي', icon: 'cancel' as const },
  };

  const { label: statusLabel, icon: statusIcon } = statusConfig[status];
  const statusColor = status === 'active'
    ? Colors.success
    : status === 'expiring'
      ? Colors.warning
      : Colors.danger;

  return (
    <View style={styles.card}>
      <View style={[styles.accentBar, { backgroundColor: sportColor }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Pressable
            style={styles.nameToggle}
            onPress={toggleExpanded}
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={`${member.name}، ${statusLabel}. ${isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}`}
          >
            <Text style={styles.name} numberOfLines={1}>{member.name}</Text>
          </Pressable>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <MaterialIcons name={statusIcon} size={11} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {isExpanded ? (
          <View style={styles.details}>
            <View style={styles.detailsRow}>
              <View style={styles.detailContent}>
                <View style={styles.memberActions}>
                  <Pressable
                    style={({ pressed }) => [styles.memberAction, styles.editAction, pressed && { opacity: 0.65 }]}
                    onPress={() => onEdit(member.id)}
                    accessibilityRole="button"
                    accessibilityLabel="تعديل بيانات المشترك"
                  >
                    <MaterialIcons name="edit" size={13} color={sportColor} />
                    <Text style={[styles.memberActionText, { color: sportColor }]}>تعديل</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.memberAction, styles.deleteAction, pressed && { opacity: 0.65 }]}
                    onPress={() => onDelete(member.id)}
                    accessibilityRole="button"
                    accessibilityLabel="حذف المشترك"
                  >
                    <MaterialIcons name="delete-outline" size={14} color={Colors.danger} />
                    <Text style={[styles.memberActionText, { color: Colors.danger }]}>حذف</Text>
                  </Pressable>
                </View>
                {member.photo ? (
                  <View style={styles.detailsAvatar}>
                    <Image source={{ uri: member.photo }} style={styles.detailsAvatarImage} contentFit="cover" transition={200} />
                  </View>
                ) : null}
                {member.phone ? (
                  <View style={styles.phoneRow}>
                    <Pressable
                      style={({ pressed }) => [styles.phoneCallBtn, pressed && { opacity: 0.6 }]}
                      onPress={handlePhonePress}
                      accessibilityRole="button"
                      accessibilityLabel={`الاتصال بالرقم ${member.phone}`}
                    >
                      <MaterialIcons name="phone" size={9} color={Colors.textMuted} />
                    </Pressable>
                    <Text style={styles.phoneText}>{member.phone}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.contactBtn, styles.whatsAppBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => launchWhatsApp(member)}
                      accessibilityRole="button"
                      accessibilityLabel={`إرسال تفاصيل الاشتراك إلى ${member.name} عبر واتساب`}
                    >
                      <MaterialIcons name="chat" size={10} color="#25D366" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.contactBtn, styles.smsBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => launchSms(member)}
                      accessibilityRole="button"
                      accessibilityLabel={`إرسال تفاصيل الاشتراك إلى ${member.name} عبر الرسائل النصية`}
                    >
                      <MaterialIcons name="sms" size={10} color="#3478F6" />
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="attach-money" size={10} color={Colors.textMuted} />
                    <Text style={styles.infoText}>{member.fee.toLocaleString('ar-SA')} ر.ي</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="calendar-today" size={10} color={Colors.textMuted} />
                    <Text style={styles.infoText}>{formatDate(member.startDate)}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="event" size={10} color={statusColor} />
                    <Text style={[styles.infoText, { color: statusColor }]}>{formatDate(member.endDate)}</Text>
                  </View>
                </View>
                {status === 'expired' ? (
                  <Pressable
                    style={({ pressed }) => [styles.renewBtn, pressed && { opacity: 0.6 }]}
                    onPress={() => onRenew(member.id)}
                    accessibilityRole="button"
                    accessibilityLabel="تجديد الاشتراك"
                  >
                    <MaterialIcons name="autorenew" size={11} color={Colors.success} />
                    <Text style={styles.renewText}>تجديد الاشتراك</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  nameToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 2,
  },
  name: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: Radius.full,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '500',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 17,
  },
  phoneCallBtn: {
    padding: 3,
  },
  contactBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  whatsAppBtn: {
    backgroundColor: '#25D36618',
  },
  smsBtn: {
    backgroundColor: '#3478F618',
  },
  phoneText: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginTop: 4,
    paddingTop: 5,
    gap: 4,
  },
  detailsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  detailsAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  detailsAvatarImage: {
    width: '100%',
    height: '100%',
  },
  detailContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  memberActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: 1,
  },
  memberAction: {
    minHeight: 25,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  editAction: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  deleteAction: {
    backgroundColor: Colors.danger + '10',
    borderColor: Colors.danger + '35',
  },
  memberActionText: {
    fontSize: 9,
    fontWeight: '700',
  },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.success + '18',
    borderWidth: 1,
    borderColor: Colors.success + '55',
  },
  renewText: {
    color: Colors.success,
    fontSize: 9,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  infoText: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
});
