// Powered by OnSpace.AI
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export type CoreGameType = 'billiards' | 'tabletennis';
export type GameType = CoreGameType | 'othergame';
export type SessionMode = '1h' | '2h' | '3h' | 'open' | 'custom';

export interface ManagedTable {
  id: string;
  name: string;
  gameType: CoreGameType;
  hourlyRate: number;
}

export type OtherGamePricingType = 'fixed' | 'open';

export interface OtherGame {
  type: 'other_games';
  id: string;
  name: string;
  pricingType: OtherGamePricingType;
  defaultRate: number;
}

export interface MartialArtsGame {
  type: 'martial_arts';
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface TableSession {
  id: string;
  tableId: string;
  tableNumber: number;
  tableName?: string;
  gameId?: string;
  gameName?: string;
  gameType: GameType;
  mode: SessionMode;
  startTime: string; // ISO
  durationMinutes: number; // 0 for open
  hourlyRate: number;
  endTime?: string; // ISO, set when stopped
  pausedAt?: string; // Temporary checkout freeze; cleared on cancel or stop
  isActive: boolean;
  notifId?: string;
  shiftId?: string;
  employeeName?: string;
}

export interface GameSettings {
  billiards: {
    hourlyRate: number;
    tableCount: number;
    customSoundUri?: string;
  };
  tabletennis: {
    hourlyRate: number;
    tableCount: number;
    customSoundUri?: string;
  };
  otherGames: Record<string, {
    hourlyRate: number;
    customSoundUri?: string;
  }>;
}

// ── Session Record (closed sessions for reports) ─────────────────────────────

export interface SessionRecord {
  id: string;
  tableId: string;
  tableNumber: number;
  tableName?: string;
  gameId?: string;
  gameName?: string;
  gameType: GameType;
  mode: SessionMode;
  startTime: string;  // ISO
  endTime: string;    // ISO
  durationMinutes: number;
  hourlyRate: number;
  finalCost: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  debtorName?: string;
  debtorPhone?: string;
  shiftId?: string;
  employeeName?: string;
}

/** Outstanding game-only balances. Settling removes an entry from this list. */
export interface GameDebt {
  id: string;
  debtorName: string;
  debtorPhone: string;
  sourceType: GameType | 'othergame';
  sourceLabel: string;
  date: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  shiftId?: string;
  employeeName?: string;
}

/** Completed Other Games sales are stored separately from subscriptions and sports. */
export interface OtherGameSaleRecord extends Omit<GameDebt, 'sourceType' | 'amountDue'> {
  sourceType: 'othergame';
  amountDue: number;
}

const KEYS = {
  sessions: 'table_games_sessions_v2',
  settings: 'table_games_settings_v2',
  records: 'table_games_records_v1',
  managedTables: 'table_games_managed_tables_v1',
  otherGames: 'table_games_other_games_v1',
  martialArtsGames: 'gym_martial_arts_games_v1',
  debts: 'table_games_debts_v1',
  otherGameSales: 'table_games_other_sales_v1',
};

const DEFAULT_SETTINGS: GameSettings = {
  billiards: { hourlyRate: 1000, tableCount: 4 },
  tabletennis: { hourlyRate: 500, tableCount: 3 },
  otherGames: {},
};

const ALARM_SOUND_DIRECTORY = 'table-game-alarm-sounds';

/** Copy picker cache/content URIs into app-private storage so they survive restarts. */
export async function persistAlarmSound(uri: string, fileName?: string): Promise<string> {
  const documentDirectory = FileSystem.documentDirectory;
  // Web document-picker URLs are browser-managed and cannot be copied via Expo FileSystem.
  if (!documentDirectory) return uri;

  const directory = `${documentDirectory}${ALARM_SOUND_DIRECTORY}/`;
  const directoryInfo = await FileSystem.getInfoAsync(directory);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
  if (uri.startsWith(directory)) return uri;

  const extensionMatch = (fileName ?? uri).match(/\.([a-zA-Z0-9]{1,8})(?:[?#].*)?$/);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? 'audio';
  const destination = `${directory}alarm-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

/** Remove only a sound file created in this app's private alarm directory. */
export async function removePersistedAlarmSound(uri?: string): Promise<void> {
  const directory = FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${ALARM_SOUND_DIRECTORY}/`
    : undefined;
  if (!uri || !directory || !uri.startsWith(directory)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Cleanup is best-effort; settings remain valid even if deletion is unavailable.
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<GameSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    const source = parsed as Partial<Record<CoreGameType, Partial<GameSettings[CoreGameType]>>> & {
      otherGames?: Record<string, { hourlyRate?: unknown; customSoundUri?: unknown }>;
    };
    const normalize = (type: CoreGameType) => {
      const defaults = DEFAULT_SETTINGS[type];
      const value = source[type];
      const hourlyRate = value?.hourlyRate;
      const tableCount = value?.tableCount;
      return {
        hourlyRate: typeof hourlyRate === 'number' && Number.isFinite(hourlyRate) && hourlyRate > 0
          ? hourlyRate : defaults.hourlyRate,
        tableCount: typeof tableCount === 'number' && Number.isFinite(tableCount)
          ? Math.max(0, Math.min(20, Math.floor(tableCount))) : defaults.tableCount,
        customSoundUri: typeof value?.customSoundUri === 'string' && value.customSoundUri.length > 0
          ? value.customSoundUri : undefined,
      };
    };
    const otherGames = Object.fromEntries(
      Object.entries(source.otherGames ?? {}).flatMap(([gameId, value]) => {
        if (!gameId || !value || typeof value !== 'object') return [];
        const hourlyRate = value.hourlyRate;
        if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate) || hourlyRate <= 0) return [];
        return [[gameId, {
          hourlyRate,
          customSoundUri: typeof value.customSoundUri === 'string' && value.customSoundUri.length > 0
            ? value.customSoundUri : undefined,
        }]];
      })
    );
    return {
      billiards: normalize('billiards'),
      tabletennis: normalize('tabletennis'),
      otherGames,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function validTable(value: unknown): value is ManagedTable {
  if (!value || typeof value !== 'object') return false;
  const table = value as Partial<ManagedTable>;
  return typeof table.id === 'string' && table.id.length > 0
    && typeof table.name === 'string' && table.name.trim().length > 0
    && (table.gameType === 'billiards' || table.gameType === 'tabletennis')
    && typeof table.hourlyRate === 'number' && Number.isFinite(table.hourlyRate) && table.hourlyRate > 0;
}

function validOtherGame(value: unknown): value is OtherGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<OtherGame>;
  return (game.type === undefined || game.type === 'other_games')
    && typeof game.id === 'string' && game.id.length > 0
    && typeof game.name === 'string' && game.name.trim().length > 0
    && (game.pricingType === 'fixed' || game.pricingType === 'open')
    && typeof game.defaultRate === 'number' && Number.isFinite(game.defaultRate) && game.defaultRate > 0;
}

function validMartialArtsGame(value: unknown): value is MartialArtsGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<MartialArtsGame>;
  return game.type === 'martial_arts'
    && typeof game.id === 'string' && game.id.length > 0
    && typeof game.name === 'string' && game.name.trim().length > 0
    && typeof game.color === 'string' && /^#[\da-f]{6}$/i.test(game.color)
    && typeof game.icon === 'string' && game.icon.length > 0;
  }

/**
 * Load configured tables, migrating the previous count-based settings on first run.
 * IDs for migrated tables match the legacy session IDs so existing active sessions
 * remain attached to their original tables.
 */
export async function loadManagedTables(settings: GameSettings): Promise<ManagedTable[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.managedTables);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(validTable);
    }
  } catch {
    // Recover from corrupt configuration by migrating the last known settings.
  }
  const tables: ManagedTable[] = (['billiards', 'tabletennis'] as const).flatMap((gameType) => {
    const game = settings[gameType];
    const count = Math.max(0, Math.min(20, Math.floor(game.tableCount)));
    return Array.from({ length: count }, (_, index) => ({
      id: `${gameType}_${index + 1}`,
      name: `طاولة ${index + 1}`,
      gameType,
      hourlyRate: game.hourlyRate,
    }));
  });
  await persistManagedTables(tables);
  return tables;
}

export async function persistManagedTables(tables: ManagedTable[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.managedTables, JSON.stringify(tables));
}

export async function loadOtherGames(): Promise<OtherGame[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.otherGames);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(validOtherGame).map((game) => ({ ...game, type: 'other_games' as const })) : [];
  } catch {
    return [];
  }
}

export async function persistOtherGames(games: OtherGame[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.otherGames, JSON.stringify(games));
}

export async function loadMartialArtsGames(): Promise<MartialArtsGame[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.martialArtsGames);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(validMartialArtsGame) : [];
  } catch {
    return [];
  }
}

export async function persistMartialArtsGames(games: MartialArtsGame[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.martialArtsGames, JSON.stringify(games));
}

export function createManagedTable(input: Omit<ManagedTable, 'id'>): ManagedTable {
  return { ...input, id: makeId(input.gameType) };
}

export function createOtherGame(input: Omit<OtherGame, 'id' | 'type'>): OtherGame {
  return { ...input, type: 'other_games', id: makeId('game') };
}

export function createMartialArtsGame(input: Omit<MartialArtsGame, 'id' | 'type'>): MartialArtsGame {
  return { ...input, type: 'martial_arts', id: makeId('martial') };
}

// ── Sessions ──────────────────────────────────────────────────────────────────

// ── Records ──────────────────────────────────────────────────────────────────

export async function loadRecords(): Promise<SessionRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.records);
    if (!raw) return [];
    return JSON.parse(raw) as SessionRecord[];
  } catch {
    return [];
  }
}

export async function persistRecords(records: SessionRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.records, JSON.stringify(records));
}

export async function appendRecord(record: SessionRecord): Promise<void> {
  const existing = await loadRecords();
  // Replace by session ID on retry; retain the most recent 500 records.
  const updated = [record, ...existing.filter((item) => item.id !== record.id)].slice(0, 500);
  await persistRecords(updated);
}

export async function loadGameDebts(): Promise<GameDebt[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.debts);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is GameDebt =>
      !!item && typeof item === 'object'
      && typeof (item as GameDebt).id === 'string'
      && typeof (item as GameDebt).debtorName === 'string'
      && typeof (item as GameDebt).debtorPhone === 'string'
      && ['billiards', 'tabletennis', 'othergame'].includes((item as GameDebt).sourceType)
      && typeof (item as GameDebt).sourceLabel === 'string'
      && typeof (item as GameDebt).date === 'string'
      && Number.isFinite((item as GameDebt).totalAmount)
      && Number.isFinite((item as GameDebt).amountPaid)
      && Number.isFinite((item as GameDebt).amountDue)
      && (item as GameDebt).amountDue > 0
    ) : [];
  } catch {
    return [];
  }
}

export async function persistGameDebts(debts: GameDebt[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.debts, JSON.stringify(debts));
}

export async function loadOtherGameSales(): Promise<OtherGameSaleRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.otherGameSales);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as OtherGameSaleRecord[] : [];
  } catch {
    return [];
  }
}

export async function appendOtherGameSale(record: OtherGameSaleRecord): Promise<void> {
  const existing = await loadOtherGameSales();
  const updated = [record, ...existing.filter((item) => item.id !== record.id)].slice(0, 500);
  await AsyncStorage.setItem(KEYS.otherGameSales, JSON.stringify(updated));
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function loadSessions(): Promise<TableSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.sessions);
    if (!raw) return [];
    return JSON.parse(raw) as TableSession[];
  } catch {
    return [];
  }
}

export async function persistSessions(sessions: TableSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function modeDuration(mode: SessionMode): number {
  if (mode === '1h') return 60;
  if (mode === '2h') return 120;
  if (mode === '3h') return 180;
  if (mode === 'custom') return 0;
  return 0; // open
}

export function modeLabel(mode: SessionMode): string {
  if (mode === '1h') return 'ساعة';
  if (mode === '2h') return 'ساعتان';
  if (mode === '3h') return '٣ ساعات';
  if (mode === 'custom') return 'وقت إضافي مخصص';
  return 'وقت مفتوح';
}

export function calcCost(session: TableSession, nowMs: number): number {
  const startMs = new Date(session.startTime).getTime();
  const pausedMs = session.pausedAt ? new Date(session.pausedAt).getTime() : Number.POSITIVE_INFINITY;
  const effectiveNowMs = Number.isFinite(pausedMs) ? Math.min(nowMs, pausedMs) : nowMs;
  const elapsedMinutes = Math.max(0, (effectiveNowMs - startMs) / 60000);
  const billableMinutes = session.mode === 'open'
    ? elapsedMinutes
    : Math.min(elapsedMinutes, Math.max(0, session.durationMinutes));
  return Math.round((billableMinutes / 60) * session.hourlyRate);
}

export function calcRemainingSeconds(session: TableSession, nowMs: number): number {
  if (session.mode === 'open') return -1;
  const startMs = new Date(session.startTime).getTime();
  const endMs = startMs + session.durationMinutes * 60 * 1000;
  const pausedMs = session.pausedAt ? new Date(session.pausedAt).getTime() : Number.POSITIVE_INFINITY;
  const effectiveNowMs = Number.isFinite(pausedMs) ? Math.min(nowMs, pausedMs) : nowMs;
  return Math.max(0, Math.ceil((endMs - effectiveNowMs) / 1000));
}

export function calcElapsedSeconds(session: TableSession, nowMs: number): number {
  const startMs = new Date(session.startTime).getTime();
  const pausedMs = session.pausedAt ? new Date(session.pausedAt).getTime() : Number.POSITIVE_INFINITY;
  const effectiveNowMs = Number.isFinite(pausedMs) ? Math.min(nowMs, pausedMs) : nowMs;
  return Math.floor((effectiveNowMs - startMs) / 1000);
}

export function formatDuration(totalSeconds: number): string {
  const absSeconds = Math.abs(totalSeconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = absSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
