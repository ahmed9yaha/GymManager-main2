// Powered by OnSpace.AI
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { clearCoachPhotos } from '@/services/coaches';

export interface Member {
  id: string;
  name: string;
  fee: number;
  phone?: string;
  photo?: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  sport: string;
  createdAt: string;
  coachId?: string;
  isComplimentary?: boolean;
}

/** Fields users can edit; identity, sport, and registration time stay immutable. */
export type MemberUpdate = Pick<Member, 'name' | 'fee' | 'phone' | 'photo' | 'startDate' | 'endDate'>;

const STORAGE_KEYS = {
  boxing: 'gym_boxing_members',
  kickboxing: 'gym_kickboxing_members',
  karate: 'gym_karate_members',
  gymnastics: 'gym_gymnastics_members',
};
const DYNAMIC_SPORT_STORAGE_PREFIX = 'gym_dynamic_sport_members_v1:';

const PURGE_PASSWORD_HASH_KEY = 'gym_admin_purge_password_hash_v1';
const PURGE_PASSWORD_SALT_KEY = 'gym_admin_purge_password_salt_v1';
const SHIFT_STATE_KEY = 'lounge_shift_state_v1';
const TABLE_GAME_KEYS = [
  'table_games_sessions_v2',
  'table_games_settings_v2',
  'table_games_records_v1',
  'table_games_managed_tables_v1',
  'table_games_other_games_v1',
  'table_games_debts_v1',
  'table_games_other_sales_v1',
  'gym_martial_arts_games_v1',
] as const;

export type PurgeMode = 'daily' | 'monthly' | 'annual' | 'full';

function dayBounds(now: Date): { start: number; end: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

function purgeCutoff(mode: Exclude<PurgeMode, 'full'>, now: Date): number {
  const cutoff = new Date(now);
  if (mode === 'monthly') cutoff.setDate(1);
  else cutoff.setMonth(0, 1);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff.getTime();
}

function isWithinRetention(value: unknown, cutoff: number): boolean {
  if (typeof value !== 'string') return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= cutoff;
}

/** Hash and verify a local administrator password without storing its plaintext. */
export async function setPurgePassword(password: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
  await AsyncStorage.multiSet([[PURGE_PASSWORD_SALT_KEY, salt], [PURGE_PASSWORD_HASH_KEY, hash]]);
}

export async function isPurgePasswordConfigured(): Promise<boolean> {
  const [salt, hash] = await AsyncStorage.multiGet([PURGE_PASSWORD_SALT_KEY, PURGE_PASSWORD_HASH_KEY]);
  return Boolean(salt[1] && hash[1]);
}

export async function verifyPurgePassword(password: string): Promise<boolean> {
  const [saltEntry, hashEntry] = await AsyncStorage.multiGet([PURGE_PASSWORD_SALT_KEY, PURGE_PASSWORD_HASH_KEY]);
  const salt = saltEntry[1];
  const savedHash = hashEntry[1];
  if (!salt || !savedHash) return false;
  const candidate = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
  return candidate === savedHash;
}

/**
 * Purge local history only. Monthly retains this calendar month; annual retains
 * this calendar year. Active sessions/shifts and subscriber files are untouched.
 */
export async function purgeLocalData(mode: PurgeMode, now = new Date()): Promise<void> {
  if (mode === 'full') {
    await clearCoachPhotos();
    const dynamicMemberKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(DYNAMIC_SPORT_STORAGE_PREFIX));
    await AsyncStorage.multiRemove([
      ...Object.values(STORAGE_KEYS),
      ...dynamicMemberKeys,
      'gym_coaches_v1',
      ...TABLE_GAME_KEYS,
      SHIFT_STATE_KEY,
      PURGE_PASSWORD_HASH_KEY,
      PURGE_PASSWORD_SALT_KEY,
    ]);
    return;
  }

  if (mode === 'daily') {
    const { start, end } = dayBounds(now);
    const [rawSessions, rawRecords] = await AsyncStorage.multiGet([TABLE_GAME_KEYS[0], TABLE_GAME_KEYS[2]]);
    const sessions = rawSessions[1]
      ? JSON.parse(rawSessions[1]) as Array<{ isActive?: boolean; endTime?: string; startTime?: string }>
      : [];
    const records = rawRecords[1]
      ? JSON.parse(rawRecords[1]) as Array<{ endTime?: string; startTime?: string }>
      : [];
    const retainedSessions = sessions.filter((session) => {
      if (session.isActive === true) return false;
      const timestamp = new Date(session.endTime ?? session.startTime ?? '').getTime();
      return !Number.isFinite(timestamp) || timestamp < start || timestamp >= end;
    });
    const retainedRecords = records.filter((record) => {
      const timestamp = new Date(record.endTime ?? record.startTime ?? '').getTime();
      return !Number.isFinite(timestamp) || timestamp < start || timestamp >= end;
    });
    await AsyncStorage.multiSet([
      [TABLE_GAME_KEYS[0], JSON.stringify(retainedSessions)],
      [TABLE_GAME_KEYS[2], JSON.stringify(retainedRecords)],
    ]);
    return;
  }

  const cutoff = purgeCutoff(mode, now);
  const [rawRecords, rawSessions, rawShiftState, rawOtherGameSales] = await AsyncStorage.multiGet([
    TABLE_GAME_KEYS[2], TABLE_GAME_KEYS[0], SHIFT_STATE_KEY, TABLE_GAME_KEYS[6],
  ]);

  const records = rawRecords[1] ? JSON.parse(rawRecords[1]) as Array<{ endTime?: string; startTime?: string }> : [];
  const retainedRecords = records.filter((record) => isWithinRetention(record.endTime ?? record.startTime, cutoff));

  const sessions = rawSessions[1] ? JSON.parse(rawSessions[1]) as Array<{ isActive?: boolean; endTime?: string; startTime?: string }> : [];
  const retainedSessions = sessions.filter((session) =>
    session.isActive === true || isWithinRetention(session.endTime ?? session.startTime, cutoff)
  );

  const writes: [string, string][] = [
    [TABLE_GAME_KEYS[2], JSON.stringify(retainedRecords)],
    [TABLE_GAME_KEYS[0], JSON.stringify(retainedSessions)],
  ];
  const otherGameSales = rawOtherGameSales[1]
    ? JSON.parse(rawOtherGameSales[1]) as Array<{ date?: string }>
    : [];
  writes.push([
    TABLE_GAME_KEYS[6],
    JSON.stringify(otherGameSales.filter((sale) => isWithinRetention(sale.date, cutoff))),
  ]);
  if (mode === 'annual') {
    const shiftState = rawShiftState[1]
      ? JSON.parse(rawShiftState[1]) as { activeShift?: unknown; closedShifts?: Array<{ endedAt?: string; startedAt?: string }> }
      : { activeShift: null, closedShifts: [] };
    const closedShifts = Array.isArray(shiftState.closedShifts) ? shiftState.closedShifts : [];
    const retainedShifts = closedShifts.filter((shift) => isWithinRetention(shift.endedAt ?? shift.startedAt, cutoff));
    writes.push([SHIFT_STATE_KEY, JSON.stringify({ ...shiftState, closedShifts: retainedShifts })]);
  }
  await AsyncStorage.multiSet(writes);
}

/** Stable string key; custom subscriber games use their configured game ID. */
export type SportKey = string;

export async function getConfiguredSportKeys(): Promise<SportKey[]> {
  const keys = await AsyncStorage.getAllKeys();
  return [
    ...Object.keys(STORAGE_KEYS),
    ...keys.filter((key) => key.startsWith(DYNAMIC_SPORT_STORAGE_PREFIX))
      .map((key) => decodeURIComponent(key.slice(DYNAMIC_SPORT_STORAGE_PREFIX.length))),
  ];
}

function memberStorageKey(sport: SportKey): string {
  if (Object.prototype.hasOwnProperty.call(STORAGE_KEYS, sport)) {
    return STORAGE_KEYS[sport as keyof typeof STORAGE_KEYS];
  }
  return `${DYNAMIC_SPORT_STORAGE_PREFIX}${encodeURIComponent(sport)}`;
}

export async function getMembers(sport: SportKey): Promise<Member[]> {
  try {
    const data = await AsyncStorage.getItem(memberStorageKey(sport));
    if (!data) return [];
    return JSON.parse(data) as Member[];
  } catch {
    return [];
  }
}

export async function saveMembers(sport: SportKey, members: Member[]): Promise<void> {
  await AsyncStorage.setItem(memberStorageKey(sport), JSON.stringify(members));
}

export async function addMember(sport: SportKey, member: Omit<Member, 'id' | 'sport' | 'createdAt'>): Promise<Member> {
  const members = await getMembers(sport);
  const newMember: Member = {
    ...member,
    id: Date.now().toString(),
    sport,
    createdAt: new Date().toISOString(),
  };
  members.unshift(newMember);
  await saveMembers(sport, members);
  return newMember;
}

export async function deleteMember(sport: SportKey, id: string): Promise<void> {
  const members = await getMembers(sport);
  const updated = members.filter((m) => m.id !== id);
  await saveMembers(sport, updated);
}

/** Update a saved member and persist the complete sport list on this device. */
export async function updateMember(sport: SportKey, id: string, changes: MemberUpdate): Promise<Member> {
  const members = await getMembers(sport);
  const existing = members.find((member) => member.id === id);
  if (!existing) {
    throw new Error(`Member ${id} was not found in ${sport}`);
  }

  const updatedMember: Member = {
    ...existing,
    ...changes,
    id: existing.id,
    sport: existing.sport,
    createdAt: existing.createdAt,
  };
  const updatedMembers = members.map((member) => member.id === id ? updatedMember : member);

  // Do not swallow storage errors here: the UI must not report a successful edit
  // unless AsyncStorage has accepted the updated data.
  await AsyncStorage.setItem(memberStorageKey(sport), JSON.stringify(updatedMembers));
  return updatedMember;
}

export async function renewMember(
  sport: SportKey,
  id: string,
  dates: { startDate: string; endDate: string }
): Promise<void> {
  const members = await getMembers(sport);
  if (!members.some((member) => member.id === id)) {
    throw new Error(`Member ${id} was not found in ${sport}`);
  }
  const updated = members.map((member) =>
    member.id === id
      ? { ...member, startDate: dates.startDate, endDate: dates.endDate }
      : member
  );
  await AsyncStorage.setItem(memberStorageKey(sport), JSON.stringify(updated));
}

export async function getAllMembers(): Promise<Record<SportKey, Member[]>> {
  const sports = await getConfiguredSportKeys();
  const entries = await Promise.all(sports.map(async (sport) => [sport, await getMembers(sport)] as const));
  return Object.fromEntries(entries);
}

export function getMemberStatus(endDate: string): 'active' | 'expiring' | 'expired' {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'expiring';
  return 'active';
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
