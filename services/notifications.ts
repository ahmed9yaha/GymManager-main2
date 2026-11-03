import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Member, SportKey } from '@/services/storage';

export const ANDROID_NOTIFICATION_CHANNEL_ID = 'gym-alerts';
export const TABLE_TIMER_NOTIFICATION_CHANNEL_ID = 'table-timer-alerts-v2';
export const TABLE_TIMER_NOTIFICATION_SOUND = 'table_alarm.wav';
const MEMBER_NOTIFICATION_INDEX_KEY = 'local_member_expiry_notification_ids_v1';
const MEMBER_REMINDER_HOUR = 9;
// iOS allows at most 64 pending local notifications per app. Keep a margin for table timers.
const MAX_MEMBER_EXPIRY_NOTIFICATIONS = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface LocalNotificationInput {
  title: string;
  body: string;
  date: Date;
  data?: Record<string, string | number | boolean>;
  sound?: boolean | string;
  channelId?: string;
}

type MemberNotificationRecord = {
  notificationId: string;
  signature: string;
};
type MemberNotificationIndex = Record<string, MemberNotificationRecord>;

function memberNotificationKey(member: Pick<Member, 'sport' | 'id'>): string {
  return `${member.sport}:${member.id}`;
}

/**
 * Prepare Android channels and ask once the operating system says asking is appropriate.
 * For a custom Android sound, bundle a .wav via the expo-notifications plugin's `sounds`
 * option in app.json and pass its raw resource name here. Android freezes a channel's sound
 * after its first creation, so the table timer uses a versioned dedicated channel ID.
 */
export async function initializeLocalNotifications(androidSound = 'default'): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, {
        name: 'Gym reminders and table timers',
        description: 'Subscription expiry reminders and table session alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#F97316',
        sound: androidSound,
        bypassDnd: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(TABLE_TIMER_NOTIFICATION_CHANNEL_ID, {
        name: 'Table timer alarms',
        description: 'Full-length table session expiry alarm',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#F97316',
        sound: TABLE_TIMER_NOTIFICATION_SOUND,
        bypassDnd: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    let permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted' && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    return permissions.granted;
  } catch (error) {
    console.warn('Local notification setup failed:', error);
    return false;
  }
}

async function notificationsAllowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return permissions.granted;
  } catch {
    return false;
  }
}

/** Schedule an offline OS notification at a specific local date/time. */
export async function scheduleLocalNotification(
  input: LocalNotificationInput
): Promise<string | undefined> {
  if (!(input.date instanceof Date) || !Number.isFinite(input.date.getTime()) || input.date.getTime() <= Date.now()) {
    return undefined;
  }
  if (!(await notificationsAllowed())) return undefined;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data,
        sound: input.sound ?? true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.date,
        channelId: input.channelId ?? ANDROID_NOTIFICATION_CHANNEL_ID,
      },
    });
  } catch (error) {
    console.warn('Unable to schedule local notification:', error);
    return undefined;
  }
}

/** Post immediately through the OS (useful as a fallback when an app-side alarm fails). */
export async function scheduleImmediateLocalNotification(
  title: string,
  body: string,
  data?: LocalNotificationInput['data'],
  sound: LocalNotificationInput['sound'] = true,
  channelId = ANDROID_NOTIFICATION_CHANNEL_ID
): Promise<string | undefined> {
  if (!(await notificationsAllowed())) return undefined;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound,
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('Unable to post local notification:', error);
    return undefined;
  }
}

export async function cancelLocalNotification(notificationId?: string): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Cancellation is best-effort; the scheduled alert may already have fired.
  }
}

function expiryNotificationDate(endDate: string): Date | undefined {
  const parsed = new Date(endDate);
  if (!Number.isFinite(parsed.getTime())) return undefined;

  const reminder = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    MEMBER_REMINDER_HOUR,
    0,
    0,
    0
  );
  const now = new Date();
  const isToday = reminder.getFullYear() === now.getFullYear()
    && reminder.getMonth() === now.getMonth()
    && reminder.getDate() === now.getDate();
  if (reminder.getTime() <= now.getTime() && isToday) {
    reminder.setTime(now.getTime() + 5_000);
  }
  return reminder.getTime() > now.getTime() ? reminder : undefined;
}

async function readMemberIndex(): Promise<MemberNotificationIndex> {
  try {
    const raw = await AsyncStorage.getItem(MEMBER_NOTIFICATION_INDEX_KEY);
    return raw ? JSON.parse(raw) as MemberNotificationIndex : {};
  } catch {
    return {};
  }
}

async function writeMemberIndex(index: MemberNotificationIndex): Promise<void> {
  try {
    await AsyncStorage.setItem(MEMBER_NOTIFICATION_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.warn('Unable to persist member notification index:', error);
  }
}

/** Keep local expiry alerts aligned with saved members; safe to call on startup and after CRUD. */
export async function reconcileMemberExpiryNotifications(
  membersBySport: Record<SportKey, Member[]>
): Promise<void> {
  if (!(await notificationsAllowed())) return;

  const members = Object.values(membersBySport).flat();
  const eligible = members
    .map((member) => ({
      member,
      date: expiryNotificationDate(member.endDate),
      signature: `${member.endDate}|${member.name}`,
    }))
    .filter((entry): entry is { member: Member; date: Date; signature: string } => Boolean(entry.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_MEMBER_EXPIRY_NOTIFICATIONS);
  const eligibleById = new Map(eligible.map((entry) => [memberNotificationKey(entry.member), entry]));
  const index = await readMemberIndex();

  for (const [memberId, previous] of Object.entries(index)) {
    const current = eligibleById.get(memberId);
    if (!current || current.signature !== previous.signature) {
      await cancelLocalNotification(previous.notificationId);
      delete index[memberId];
    }
  }

  for (const { member, date, signature } of eligible) {
    const key = memberNotificationKey(member);
    if (index[key]?.signature === signature) continue;
    const notificationId = await scheduleLocalNotification({
      title: 'انتهاء الاشتراك اليوم',
      body: `ينتهي اشتراك ${member.name} اليوم.`,
      date,
      data: { kind: 'member-expiry', memberId: member.id, sport: member.sport },
    });
    if (notificationId) index[key] = { notificationId, signature };
  }

  await writeMemberIndex(index);
}

export async function removeMemberExpiryNotification(sport: SportKey, memberId: string): Promise<void> {
  const index = await readMemberIndex();
  const key = `${sport}:${memberId}`;
  await cancelLocalNotification(index[key]?.notificationId);
  if (index[key]) {
    delete index[key];
    await writeMemberIndex(index);
  }
}
