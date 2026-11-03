import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import type { SportKey } from '@/services/storage';

export type CoachGameKey = SportKey | 'billiards' | 'tabletennis' | `other:${string}`;

export interface Coach {
  id: string;
  name: string;
  phone: string;
  gameKey: CoachGameKey;
  gameLabel: string;
  photoUri: string | null;
  profitPercentage: number;
  maxFreeMembers: number;
}

export type CoachInput = Omit<Coach, 'id'>;

export const COACHES_STORAGE_KEY = 'gym_coaches_v1';
const COACH_PHOTO_DIRECTORY_NAME = 'coach-profiles';

function isCoach(value: unknown): value is Coach {
  if (!value || typeof value !== 'object') return false;
  const coach = value as Partial<Coach>;
  return typeof coach.id === 'string' && coach.id.length > 0
    && typeof coach.name === 'string' && coach.name.trim().length > 0
    && typeof coach.phone === 'string'
    && typeof coach.gameKey === 'string' && coach.gameKey.length > 0
    && typeof coach.gameLabel === 'string' && coach.gameLabel.trim().length > 0
    && (typeof coach.photoUri === 'string' || coach.photoUri === null)
    && (coach.profitPercentage === undefined || (typeof coach.profitPercentage === 'number' && Number.isFinite(coach.profitPercentage)))
    && (coach.maxFreeMembers === undefined || (typeof coach.maxFreeMembers === 'number' && Number.isFinite(coach.maxFreeMembers)));
}

export async function loadCoaches(): Promise<Coach[]> {
  try {
    const raw = await AsyncStorage.getItem(COACHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCoach).map((coach) => ({
      ...coach,
      profitPercentage: Number.isFinite(coach.profitPercentage) ? Math.min(100, Math.max(0, coach.profitPercentage)) : 0,
      maxFreeMembers: Number.isFinite(coach.maxFreeMembers) ? Math.max(0, Math.floor(coach.maxFreeMembers)) : 0,
    })) : [];
  } catch (error) {
    console.warn('Unable to load local coaches:', error);
    return [];
  }
}

export async function saveCoaches(coaches: Coach[]): Promise<void> {
  await AsyncStorage.setItem(COACHES_STORAGE_KEY, JSON.stringify(coaches));
}

export function createCoachId(): string {
  return `coach_${Crypto.randomUUID()}`;
}

function coachPhotoDirectory(): string | null {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${COACH_PHOTO_DIRECTORY_NAME}/`
    : null;
}

/** Copy the picker cache URI into app-private storage so it remains available offline. */
export async function persistCoachPhoto(uri: string, coachId: string): Promise<string> {
  const directory = coachPhotoDirectory();
  // On web, Expo does not expose a durable document directory; retain the browser-local URI.
  if (!directory || uri.startsWith(directory)) return uri;

  const directoryInfo = await FileSystem.getInfoAsync(directory);
  if (!directoryInfo.exists) await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const extension = uri.match(/\.([a-zA-Z0-9]{1,8})(?:[?#].*)?$/)?.[1]?.toLowerCase() ?? 'jpg';
  const safeId = coachId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const destination = `${directory}${safeId}-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

/** Remove only profile photos owned by this app; gallery originals are never deleted. */
export async function removeCoachPhoto(uri: string | null | undefined): Promise<void> {
  const directory = coachPhotoDirectory();
  if (!uri || !directory || !uri.startsWith(directory)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Photo cleanup is best-effort; coach data remains valid if cleanup is unavailable.
  }
}

/** Remove app-owned coach photos during a full local-data wipe. */
export async function clearCoachPhotos(): Promise<void> {
  const directory = coachPhotoDirectory();
  if (!directory) return;
  try {
    await FileSystem.deleteAsync(directory, { idempotent: true });
  } catch {
    // File cleanup is best-effort; storage keys are still cleared by the caller.
  }
}
