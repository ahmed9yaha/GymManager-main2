// Powered by OnSpace.AI
import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useShift } from '@/contexts/ShiftContext';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import {
  TABLE_TIMER_NOTIFICATION_CHANNEL_ID,
  TABLE_TIMER_NOTIFICATION_SOUND,
  cancelLocalNotification,
  scheduleImmediateLocalNotification,
  scheduleLocalNotification,
} from '@/services/notifications';
import {
  TableSession,
  SessionRecord,
  GameSettings,
  GameType,
  SessionMode,
  ManagedTable,
  OtherGame,
  GameDebt,
  OtherGameSaleRecord,
  MartialArtsGame,
  createManagedTable,
  createOtherGame,
  createMartialArtsGame,
  loadManagedTables,
  persistManagedTables,
  loadOtherGames,
  loadGameDebts,
  persistGameDebts,
  loadOtherGameSales,
  appendOtherGameSale,
  persistOtherGames,
  loadMartialArtsGames,
  persistMartialArtsGames,
  loadSessions,
  persistSessions,
  loadSettings,
  saveSettings,
  loadRecords,
  appendRecord,
  removePersistedAlarmSound,
  modeDuration,
  calcRemainingSeconds,
  calcCost,
  calcElapsedSeconds,
} from '@/services/tableGames';

export interface ReportData {
  totalCost: number;
  cashIncome: number;
  outstandingDebt: number;
  totalSessions: number;
  totalMinutes: number;
  billiardsCost: number;
  billiardsCount: number;
  ttCost: number;
  ttCount: number;
  otherGameCost: number;
  otherGameCount: number;
  records: SessionRecord[];
}

export interface SessionPayment {
  amountPaid: number;
  debtorName?: string;
  debtorPhone?: string;
}

export interface OtherGamePayment {
  game: OtherGame;
  totalAmount: number;
  amountPaid: number;
  debtorName?: string;
  debtorPhone?: string;
}

interface TableGamesContextType {
  sessions: TableSession[];
  records: SessionRecord[];
  debts: GameDebt[];
  otherGameSales: OtherGameSaleRecord[];
  settings: GameSettings;
  tables: ManagedTable[];
  otherGames: OtherGame[];
  martialArtsGames: MartialArtsGame[];
  configurationLoaded: boolean;
  refreshAfterPurge: () => Promise<void>;
  tick: number;
  startSession: (
    tableId: string,
    tableNumber: number,
    gameType: GameType,
    mode: SessionMode,
    customRate?: number,
    defaultRate?: number,
    tableName?: string,
    gameId?: string,
    gameName?: string
  ) => Promise<void>;
  stopSession: (tableId: string, payment: SessionPayment) => Promise<void>;
  freezeSession: (tableId: string) => number | undefined;
  resumeSession: (tableId: string) => Promise<void>;
  addSessionTime: (tableId: string, minutes: number) => Promise<void>;
  recordOtherGameSale: (payment: OtherGamePayment) => Promise<void>;
  settleDebt: (debtId: string) => Promise<void>;
  getActiveSession: (tableId: string) => TableSession | undefined;
  calcFinalCost: (tableId: string) => number;
  getReport: (from: Date, to: Date) => ReportData;
  updateSettings: (settings: GameSettings) => Promise<void>;
  addTable: (input: Omit<ManagedTable, 'id'>) => Promise<void>;
  updateTable: (table: ManagedTable) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  addOtherGame: (input: Omit<OtherGame, 'id' | 'type'>) => Promise<void>;
  updateOtherGame: (game: OtherGame) => Promise<void>;
  deleteOtherGame: (gameId: string) => Promise<void>;
  addMartialArtsGame: (input: Omit<MartialArtsGame, 'id' | 'type'>) => Promise<void>;
  updateMartialArtsGame: (game: MartialArtsGame) => Promise<void>;
  deleteMartialArtsGame: (gameId: string) => Promise<void>;
}

export const TableGamesContext = createContext<TableGamesContextType | undefined>(undefined);

async function scheduleEndNotif(session: TableSession): Promise<string | undefined> {
  if (session.mode === 'open') return undefined;
  const endAt = new Date(new Date(session.startTime).getTime() + session.durationMinutes * 60_000);
  return scheduleLocalNotification({
    title: 'انتهى وقت الطاولة!',
    body: `الطاولة ${session.tableNumber} — انتهت المدة المحددة`,
    date: endAt,
    data: { kind: 'table-session-end', sessionId: session.id, tableNumber: session.tableNumber },
    sound: TABLE_TIMER_NOTIFICATION_SOUND,
    channelId: TABLE_TIMER_NOTIFICATION_CHANNEL_ID,
  });
}

let defaultAlarmSourcePromise: Promise<{ uri: string }> | undefined;

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;
    encoded += alphabet[a >> 2];
    encoded += alphabet[((a & 3) << 4) | (b >> 4)];
    encoded += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : '=';
    encoded += hasC ? alphabet[c & 63] : '=';
  }
  return encoded;
}

function getDefaultAlarmSource(): Promise<{ uri: string }> {
  if (defaultAlarmSourcePromise) return defaultAlarmSourcePromise;

  // Build a short two-beep WAV in memory; no network request is needed on web.
  const sampleRate = 8000;
  const sampleCount = 5200;
  const buffer = new ArrayBuffer(44 + sampleCount);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeText(36, 'data');
  view.setUint32(40, sampleCount, true);

  for (let i = 0; i < sampleCount; i++) {
    const positionInBeep = i % 3000;
    const envelope = positionInBeep < 2000
      ? Math.min(1, positionInBeep / 160, (2000 - positionInBeep) / 200)
      : 0;
    view.setUint8(
      44 + i,
      Math.round(128 + 75 * envelope * Math.sin((2 * Math.PI * 880 * i) / sampleRate))
    );
  }

  const bytes = new Uint8Array(buffer);
  const base64 = encodeBase64(bytes);
  const dataUri = `data:audio/wav;base64,${base64}`;
  defaultAlarmSourcePromise = (async () => {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) return { uri: dataUri };
    const uri = `${FileSystem.documentDirectory}table-game-default-alarm.wav`;
    try {
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri };
    } catch {
      return { uri: dataUri };
    }
  })();
  return defaultAlarmSourcePromise;
}

export function TableGamesProvider({ children }: { children: ReactNode }) {
  const { activeShift, recordRevenue } = useShift();
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [debts, setDebts] = useState<GameDebt[]>([]);
  const [otherGameSales, setOtherGameSales] = useState<OtherGameSaleRecord[]>([]);
  const [tables, setTables] = useState<ManagedTable[]>([]);
  const [otherGames, setOtherGames] = useState<OtherGame[]>([]);
  const [martialArtsGames, setMartialArtsGames] = useState<MartialArtsGame[]>([]);
  const [configurationLoaded, setConfigurationLoaded] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    billiards: { hourlyRate: 1000, tableCount: 4 },
    tabletennis: { hourlyRate: 500, tableCount: 3 },
    otherGames: {},
  });
  const [tick, setTick] = useState(0);
  const alarmSoundsRef = useRef<Map<string, Audio.Sound>>(new Map());
  const alarmSoundSourcesRef = useRef<Map<string, string>>(new Map());
  const alreadyAlerter = useRef<Set<string>>(new Set());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tablesRef = useRef(tables);
  const otherGamesRef = useRef(otherGames);
  const debtsRef = useRef(debts);
  debtsRef.current = debts;

  // Load initial data
  useEffect(() => {
    (async () => {
      const [s, g, r, savedOtherGames, savedMartialArtsGames, savedDebts, savedOtherSales] = await Promise.all([
        loadSessions(), loadSettings(), loadRecords(), loadOtherGames(), loadMartialArtsGames(), loadGameDebts(), loadOtherGameSales(),
      ]);
      const savedTables = await loadManagedTables(g);
      setSessions(s);
      // Recover missing native alarms for active finite sessions after an app upgrade/restart.
      const restored = await Promise.all(s.map(async (session) => {
        if (!session.isActive || session.mode === 'open' || session.notifId) return session;
        const notifId = await scheduleEndNotif(session);
        return notifId ? { ...session, notifId } : session;
      }));
      if (restored.some((session, index) => session.notifId !== s[index]?.notifId)) {
        setSessions(restored);
        await persistSessions(restored);
      }
      setSettings(g);
      setRecords(r);
      setDebts(savedDebts);
      debtsRef.current = savedDebts;
      setOtherGameSales(savedOtherSales);
      tablesRef.current = savedTables;
      otherGamesRef.current = savedOtherGames;
      setTables(savedTables);
      setOtherGames(savedOtherGames);
      setMartialArtsGames(savedMartialArtsGames);
      setConfigurationLoaded(true);
    })();
  }, []);

    const refreshAfterPurge = useCallback(async () => {
      const [savedSessions, savedRecords, savedSettings, savedOtherGames, savedMartialArtsGames, savedDebts, savedOtherSales] = await Promise.all([
        loadSessions(), loadRecords(), loadSettings(), loadOtherGames(), loadMartialArtsGames(), loadGameDebts(), loadOtherGameSales(),
      ]);
      const retainedSessionIds = new Set(savedSessions.map((session) => session.id));
      sessions.forEach((session) => {
        if (!session.isActive || retainedSessionIds.has(session.id)) return;
        if (session.notifId) void cancelLocalNotification(session.notifId);
        const sound = alarmSoundsRef.current.get(session.id);
        if (sound) {
          alarmSoundsRef.current.delete(session.id);
          alarmSoundSourcesRef.current.delete(session.id);
          void sound.stopAsync().catch(() => {}).finally(() => sound.unloadAsync().catch(() => {}));
        }
        alreadyAlerter.current.delete(session.id);
      });
      const savedTables = await loadManagedTables(savedSettings);
      setSessions(savedSessions);
      setRecords(savedRecords);
      setDebts(savedDebts);
      debtsRef.current = savedDebts;
      setOtherGameSales(savedOtherSales);
      setSettings(savedSettings);
      setTables(savedTables);
      setOtherGames(savedOtherGames);
      setMartialArtsGames(savedMartialArtsGames);
      settingsRef.current = savedSettings;
      tablesRef.current = savedTables;
      otherGamesRef.current = savedOtherGames;
      setConfigurationLoaded(true);
    }, [sessions]);

  // Tick every second to update timers in UI
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Intervals may be suspended while the device sleeps. Date-based session helpers
  // remain authoritative; force a render/check as soon as the app becomes active.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  const getSessionCustomSound = useCallback((session: TableSession) => {
    const currentSettings = settingsRef.current;
    if (session.gameType === 'billiards') return currentSettings.billiards.customSoundUri;
    if (session.gameType === 'tabletennis') return currentSettings.tabletennis.customSoundUri;
    return session.gameId ? currentSettings.otherGames[session.gameId]?.customSoundUri : undefined;
  }, []);

  const getAlarmSourceForSession = useCallback(async (session: TableSession) => {
    const customUri = getSessionCustomSound(session);
    if (customUri) return { uri: customUri };
    return getDefaultAlarmSource();
  }, [getSessionCustomSound]);

  const primeAlarmSound = useCallback(async (session: TableSession) => {
    if (Platform.OS !== 'web') return;
    const source = await getAlarmSourceForSession(session);
    if (!source) return;

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        isMuted: true,
        volume: 0,
      });
      await sound.pauseAsync();
      await sound.setPositionAsync(0);
      alarmSoundsRef.current.set(session.id, sound);
      alarmSoundSourcesRef.current.set(session.id, source.uri);
    } catch {
      // Playback is attempted again at expiry if priming is unavailable.
    }
  }, [getAlarmSourceForSession]);

  const playAlarm = useCallback(async (session: TableSession) => {
    const customUri = getSessionCustomSound(session);
    const defaultSource = await getDefaultAlarmSource();
    const sources = [
      ...(customUri ? [{ uri: customUri }] : []),
      defaultSource,
    ];

    for (const source of sources) {
      let sound = alarmSoundsRef.current.get(session.id);
      const cachedSource = alarmSoundSourcesRef.current.get(session.id);
      if (sound && cachedSource !== source.uri) {
        alarmSoundsRef.current.delete(session.id);
        alarmSoundSourcesRef.current.delete(session.id);
        try { await sound.unloadAsync(); } catch {}
        sound = undefined;
      }
      try {
        if (!sound) {
          const created = await Audio.Sound.createAsync(source, { shouldPlay: false });
          sound = created.sound;
          alarmSoundsRef.current.set(session.id, sound);
          alarmSoundSourcesRef.current.set(session.id, source.uri);
        }

        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            alarmSoundsRef.current.delete(session.id);
            alarmSoundSourcesRef.current.delete(session.id);
            sound?.unloadAsync().catch(() => {});
          }
        });
        await sound.setIsMutedAsync(false);
        await sound.setVolumeAsync(1);
        await sound.setPositionAsync(0);
        await sound.playAsync();
        return;
      } catch {
        const failedSound = alarmSoundsRef.current.get(session.id);
        if (failedSound) {
          alarmSoundsRef.current.delete(session.id);
          alarmSoundSourcesRef.current.delete(session.id);
          try { await failedSound.unloadAsync(); } catch {}
        }
      }
    }

    // Keep a native notification fallback if audio cannot be loaded.
    try {
      await scheduleImmediateLocalNotification(
        'انتهى وقت الطاولة!',
        `الطاولة ${session.tableNumber} — انتهت المدة المحددة`,
        { kind: 'table-session-end', sessionId: session.id, tableNumber: session.tableNumber },
        TABLE_TIMER_NOTIFICATION_SOUND,
        TABLE_TIMER_NOTIFICATION_CHANNEL_ID
      );
    } catch {}
  }, [getSessionCustomSound]);

  // Check for sessions that just ended → play the alarm only once per session.
  useEffect(() => {
    const now = Date.now();
    sessions.forEach((session) => {
      if (!session.isActive || session.pausedAt || session.mode === 'open') return;
      const remaining = calcRemainingSeconds(session, now);
      if (remaining === 0 && !alreadyAlerter.current.has(session.id)) {
        alreadyAlerter.current.add(session.id);
        if (AppState.currentState === 'active') {
          if (session.notifId) void cancelLocalNotification(session.notifId);
          void playAlarm(session);
        }
      }
    });
  }, [tick, sessions, playAlarm]);

  useEffect(() => () => {
    alarmSoundsRef.current.forEach((sound) => {
      sound.unloadAsync().catch(() => {});
    });
    alarmSoundsRef.current.clear();
    alarmSoundSourcesRef.current.clear();
  }, []);

  const startSession = useCallback(
    async (
      tableId: string,
      tableNumber: number,
      gameType: GameType,
      mode: SessionMode,
      customRate?: number,
      defaultRate?: number,
      tableName?: string,
      gameId?: string,
      gameName?: string
    ) => {
      if (!activeShift) throw new Error('ابدأ وردية قبل بدء الجلسة.');
      if (gameType === 'othergame' && (!gameId || !gameName)) {
        throw new Error('بيانات اللعبة المخصصة غير مكتملة.');
      }

      const configuredDefaultRate = gameType === 'billiards'
        ? settingsRef.current.billiards.hourlyRate
        : gameType === 'tabletennis'
          ? settingsRef.current.tabletennis.hourlyRate
          : (gameId ? settingsRef.current.otherGames[gameId]?.hourlyRate : undefined)
            ?? otherGamesRef.current.find((game) => game.id === gameId)?.defaultRate
            ?? defaultRate
            ?? 0;
      const hourlyRate = Number.isFinite(customRate) && customRate !== undefined && customRate > 0
        ? customRate
        : configuredDefaultRate;
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        throw new Error('لم يتم إعداد سعر افتراضي صالح لهذه اللعبة.');
      }

      const session: TableSession = {
        id: `${tableId}_${Date.now()}`,
        tableId,
        tableNumber,
        tableName,
        gameId,
        gameName,
        gameType,
        mode,
        startTime: new Date().toISOString(),
        durationMinutes: modeDuration(mode),
        hourlyRate,
        isActive: true,
        shiftId: activeShift?.id,
        employeeName: activeShift?.employeeName,
      };

      // Prime audio during the user's click so browser autoplay policies permit
      // the alarm to play later when this session reaches zero.
      void primeAlarmSound(session);

      const notifId = await scheduleEndNotif(session);
      if (notifId) session.notifId = notifId;

      setSessions((prev) => {
        // Cancel notif for any existing active session on this table
        const existingActive = prev.find((s) => s.tableId === tableId && s.isActive);
        if (existingActive?.notifId) void cancelLocalNotification(existingActive.notifId);

        const filtered = prev.filter((s) => s.tableId !== tableId || !s.isActive);
        const updated = [session, ...filtered];
        persistSessions(updated);
        return updated;
      });

      // Remove from already-alerted set so a new session can trigger again
      alreadyAlerter.current.delete(session.id);
    },
    [activeShift, primeAlarmSound]
  );

  const calcFinalCost = useCallback((tableId: string): number => {
    const session = sessions.find((s) => s.tableId === tableId && s.isActive);
    if (!session) return 0;
    return calcCost(session, Date.now());
  }, [sessions]);

  const freezeSession = useCallback((tableId: string): number | undefined => {
    const session = sessions.find((item) => item.tableId === tableId && item.isActive);
    if (!session) return undefined;
    if (session.pausedAt) return calcCost(session, Date.now());

    const pausedAt = new Date().toISOString();
    const frozenSession = { ...session, pausedAt, notifId: undefined };
    if (session.notifId) void cancelLocalNotification(session.notifId);
    setSessions((current) => {
      const updated = current.map((item) => item.id === session.id ? frozenSession : item);
      void persistSessions(updated);
      return updated;
    });
    return calcCost(frozenSession, new Date(pausedAt).getTime());
  }, [sessions]);

  const resumeSession = useCallback(async (tableId: string) => {
    const session = sessions.find((item) => item.tableId === tableId && item.isActive && item.pausedAt);
    if (!session?.pausedAt) return;

    const pausedMs = new Date(session.pausedAt).getTime();
    const resumedAt = Date.now();
    const pausedDuration = Math.max(0, resumedAt - pausedMs);
    const resumedSession: TableSession = {
      ...session,
      startTime: new Date(new Date(session.startTime).getTime() + pausedDuration).toISOString(),
      pausedAt: undefined,
      notifId: undefined,
    };
    const notifId = await scheduleEndNotif(resumedSession);
    if (notifId) resumedSession.notifId = notifId;
    const updated = sessions.map((item) => item.id === session.id ? resumedSession : item);
    setSessions(updated);
    await persistSessions(updated);
  }, [sessions]);

  const stopSession = useCallback(async (tableId: string, payment: SessionPayment) => {
    const sessionToStop = sessions.find((s) => s.tableId === tableId && s.isActive);
    if (!sessionToStop) return;
    if (!activeShift) throw new Error('ابدأ وردية قبل إيقاف الجلسة وتسجيل التحصيل.');
    if (sessionToStop.shiftId && sessionToStop.shiftId !== activeShift.id) {
      throw new Error('هذه الجلسة بدأت في وردية سابقة. يجب إيقافها قبل إغلاق تلك الوردية.');
    }
    const alarmSound = sessionToStop
      ? alarmSoundsRef.current.get(sessionToStop.id)
      : undefined;
    if (sessionToStop && alarmSound) {
      alarmSoundsRef.current.delete(sessionToStop.id);
      alarmSoundSourcesRef.current.delete(sessionToStop.id);
      try { await alarmSound.stopAsync(); } catch {}
      try { await alarmSound.unloadAsync(); } catch {}
    }

    const requestedEndTime = sessionToStop.pausedAt ?? new Date().toISOString();
    const requestedEndMs = new Date(requestedEndTime).getTime();
    const requestedCost = calcCost(sessionToStop, requestedEndMs);
    const amountPaid = payment.amountPaid;
    const remainingAmount = requestedCost - amountPaid;
    if (!Number.isInteger(amountPaid) || amountPaid < 0 || amountPaid > requestedCost) {
      throw new Error('أدخل مبلغاً مدفوعاً بين صفر وإجمالي المبلغ.');
    }
    const debtorName = payment.debtorName?.trim() || undefined;
    const debtorPhone = payment.debtorPhone?.trim() || undefined;
    // Any unpaid balance without an explicitly named debtor is treated as a manual adjustment.
    const amountDue = debtorName ? remainingAmount : 0;
    const transaction = await recordRevenue({
      type: sessionToStop.gameType,
      amount: amountPaid,
      description: `${sessionToStop.gameType === 'billiards' ? 'بلياردو' : sessionToStop.gameType === 'tabletennis' ? 'تنس الطاولة' : sessionToStop.gameName ?? 'ألعاب أخرى'} — ${sessionToStop.tableName || `طاولة ${sessionToStop.tableNumber}`}`,
      referenceId: sessionToStop.id,
      shiftId: activeShift.id,
      occurredAt: requestedEndTime,
    });
    const endTime = transaction.occurredAt;
    const capturedEndMs = new Date(endTime).getTime();
    const record: SessionRecord = {
      id: sessionToStop.id,
      tableId: sessionToStop.tableId,
      tableNumber: sessionToStop.tableNumber,
      tableName: sessionToStop.tableName,
      gameId: sessionToStop.gameId,
      gameName: sessionToStop.gameName,
      gameType: sessionToStop.gameType,
      mode: sessionToStop.mode,
      startTime: sessionToStop.startTime,
      endTime,
      durationMinutes: Math.max(0, calcElapsedSeconds(sessionToStop, capturedEndMs) / 60),
      hourlyRate: sessionToStop.hourlyRate,
      finalCost: requestedCost,
      totalAmount: requestedCost,
      amountPaid,
      amountDue,
      debtorName,
      debtorPhone,
      shiftId: activeShift.id,
      employeeName: activeShift.employeeName,
    };
    await appendRecord(record);
    setRecords((current) => [record, ...current].slice(0, 500));
    if (amountDue > 0 && debtorName) {
      const debt: GameDebt = {
        id: sessionToStop.id,
        debtorName,
        debtorPhone: debtorPhone ?? '',
        sourceType: sessionToStop.gameType,
        sourceLabel: `${sessionToStop.gameType === 'billiards' ? 'بلياردو' : sessionToStop.gameType === 'tabletennis' ? 'تنس الطاولة' : sessionToStop.gameName ?? 'ألعاب أخرى'} ${sessionToStop.tableName || `طاولة ${sessionToStop.tableNumber}`}`,
        date: transaction.occurredAt,
        totalAmount: requestedCost,
        amountPaid,
        amountDue,
        shiftId: activeShift.id,
        employeeName: activeShift.employeeName,
      };
      const updatedDebts = [debt, ...debtsRef.current.filter((item) => item.id !== debt.id)];
      await persistGameDebts(updatedDebts);
      debtsRef.current = updatedDebts;
      setDebts(updatedDebts);
    }
    setSessions((prev) => {
      const updated = prev.map((session) => {
        if (session.id !== sessionToStop.id || !session.isActive) return session;
        void cancelLocalNotification(session.notifId);
        alreadyAlerter.current.delete(session.id);
        return { ...session, isActive: false, endTime, pausedAt: undefined };
      });
      void persistSessions(updated);
      return updated;
    });
  }, [activeShift, recordRevenue, sessions]);

  const addSessionTime = useCallback(async (tableId: string, minutes: number) => {
    const session = sessions.find((item) => item.tableId === tableId && item.isActive);
    if (!session) throw new Error('لا توجد جلسة نشطة لهذه الطاولة.');
    if (!Number.isInteger(minutes) || minutes <= 0) throw new Error('أدخل مدة إضافية صحيحة.');

    if (session.notifId) await cancelLocalNotification(session.notifId);
    const now = Date.now();
    const isExpired = session.mode !== 'open' && calcRemainingSeconds(session, now) <= 0;
    const addedDuration = session.mode === 'open' || isExpired
      ? Math.max(0, (now - new Date(session.startTime).getTime()) / 60_000) + minutes
      : session.durationMinutes + minutes;
    const extendedSession: TableSession = {
      ...session,
      mode: session.mode === 'open' ? 'custom' : session.mode,
      durationMinutes: addedDuration,
      notifId: undefined,
    };
    alreadyAlerter.current.delete(session.id);
    const activeAlarm = alarmSoundsRef.current.get(session.id);
    if (activeAlarm) {
      alarmSoundsRef.current.delete(session.id);
      alarmSoundSourcesRef.current.delete(session.id);
      try {
        await activeAlarm.stopAsync();
        await activeAlarm.unloadAsync();
      } catch {
        // The alarm may already have completed or been unloaded.
      }
    }
    const notifId = await scheduleEndNotif(extendedSession);
    if (notifId) extendedSession.notifId = notifId;

    setSessions((current) => {
      const updated = current.map((item) =>
        item.id === session.id && item.isActive ? extendedSession : item
      );
      void persistSessions(updated);
      return updated;
    });
  }, [sessions]);

  const recordOtherGameSale = useCallback(async (payment: OtherGamePayment) => {
    if (!activeShift) throw new Error('ابدأ وردية قبل تسجيل تحصيل اللعبة.');
    const { game, totalAmount, amountPaid } = payment;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !Number.isFinite(amountPaid)
      || amountPaid < 0 || amountPaid > totalAmount) {
      throw new Error('تحقق من إجمالي المبلغ والمبلغ المدفوع.');
    }
    const amountDue = totalAmount - amountPaid;
    if (amountDue > 0 && (!payment.debtorName?.trim() || !payment.debtorPhone?.trim())) {
      throw new Error('أدخل اسم المدين ورقم هاتفه عند وجود مبلغ متبقٍ.');
    }
    const date = new Date().toISOString();
    const id = `other_${game.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    await recordRevenue({
      type: 'othergame', amount: amountPaid, description: game.name,
      referenceId: id, shiftId: activeShift.id, occurredAt: date,
    });
    const sale: OtherGameSaleRecord = {
      id,
      debtorName: payment.debtorName?.trim() || '',
      debtorPhone: payment.debtorPhone?.trim() || '',
      sourceType: 'othergame',
      sourceLabel: game.name,
      date,
      totalAmount,
      amountPaid,
      amountDue,
      shiftId: activeShift.id,
      employeeName: activeShift.employeeName,
    };
    await appendOtherGameSale(sale);
    setOtherGameSales((current) => [sale, ...current].slice(0, 500));
    if (amountDue > 0) {
      const debt: GameDebt = { ...sale };
      const updatedDebts = [debt, ...debtsRef.current];
      await persistGameDebts(updatedDebts);
      debtsRef.current = updatedDebts;
      setDebts(updatedDebts);
    }
  }, [activeShift, recordRevenue]);

  const settleDebt = useCallback(async (debtId: string) => {
    const debt = debtsRef.current.find((item) => item.id === debtId);
    if (!debt) return;
    if (!activeShift) throw new Error('لا توجد وردية نشطة لتحصيل الدين.');
    await recordRevenue({
      type: debt.sourceType,
      amount: debt.amountDue,
      description: `تسوية دين — ${debt.sourceLabel} — ${debt.debtorName}`,
      referenceId: `debt-settlement-${debt.id}`,
      shiftId: activeShift.id,
      occurredAt: new Date().toISOString(),
    });
    const updatedDebts = debtsRef.current.filter((item) => item.id !== debtId);
    await persistGameDebts(updatedDebts);
    debtsRef.current = updatedDebts;
    setDebts(updatedDebts);
  }, [activeShift, recordRevenue]);

  const getActiveSession = useCallback(
    (tableId: string) => sessions.find((s) => s.tableId === tableId && s.isActive),
    [sessions]
  );

  const getReport = useCallback(
    (from: Date, to: Date): ReportData => {
      const fromMs = from.getTime();
      const toMs = to.getTime();
      const filtered = records.filter((r) => {
        const t = new Date(r.endTime).getTime();
        return t >= fromMs && t <= toMs;
      });
      let totalCost = 0, totalMinutes = 0;
      let cashIncome = 0;
      let billiardsCost = 0, billiardsCount = 0;
      let ttCost = 0, ttCount = 0;
      let otherGameCost = 0, otherGameCount = 0;
      filtered.forEach((r) => {
        totalCost += r.finalCost;
        cashIncome += Number.isFinite(r.amountPaid) ? r.amountPaid : r.finalCost;
        totalMinutes += r.durationMinutes;
        if (r.gameType === 'billiards') {
          billiardsCost += Number.isFinite(r.amountPaid) ? r.amountPaid : r.finalCost;
          billiardsCount++;
        } else if (r.gameType === 'tabletennis') {
          ttCost += Number.isFinite(r.amountPaid) ? r.amountPaid : r.finalCost;
          ttCount++;
        } else {
          otherGameCost += Number.isFinite(r.amountPaid) ? r.amountPaid : r.finalCost;
          otherGameCount++;
        }
      });
      return {
        totalCost,
        cashIncome,
        outstandingDebt: debtsRef.current
          .filter((debt) => {
            const time = new Date(debt.date).getTime();
            return time >= fromMs && time <= toMs;
          })
          .reduce((sum, debt) => sum + debt.amountDue, 0),
        totalSessions: filtered.length,
        totalMinutes,
        billiardsCost,
        billiardsCount,
        ttCost,
        ttCount,
        otherGameCost,
        otherGameCount,
        records: filtered,
      };
    },
    [records, debts]
  );

  const updateSettings = useCallback(async (newSettings: GameSettings) => {
    await saveSettings(newSettings);
    settingsRef.current = newSettings;
    setSettings(newSettings);
    const oldUris = [
      settingsRef.current.billiards.customSoundUri,
      settingsRef.current.tabletennis.customSoundUri,
      ...Object.values(settingsRef.current.otherGames).map((game) => game.customSoundUri),
    ];
    const newUris = [
      newSettings.billiards.customSoundUri,
      newSettings.tabletennis.customSoundUri,
      ...Object.values(newSettings.otherGames).map((game) => game.customSoundUri),
    ];
    oldUris.forEach((uri) => {
      if (uri && !newUris.includes(uri)) void removePersistedAlarmSound(uri);
    });
  }, []);

  const addTable = useCallback(async (input: Omit<ManagedTable, 'id'>) => {
    const name = input.name.trim();
    if (!name || !Number.isFinite(input.hourlyRate) || input.hourlyRate <= 0) {
      throw new Error('أدخل اسم الطاولة وسعراً أكبر من صفر.');
    }
    if (tablesRef.current.some((table) => table.gameType === input.gameType
      && table.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('يوجد جدول بهذا الاسم ضمن نوع اللعبة نفسه.');
    }
    if (tablesRef.current.length >= 100) throw new Error('وصلت إلى الحد الأقصى وهو 100 طاولة.');
    const updated = [...tablesRef.current, createManagedTable({ ...input, name })];
    await persistManagedTables(updated);
    tablesRef.current = updated;
    setTables(updated);
  }, []);

  const updateTable = useCallback(async (table: ManagedTable) => {
    const name = table.name.trim();
    if (!name || !Number.isFinite(table.hourlyRate) || table.hourlyRate <= 0) {
      throw new Error('أدخل اسم الطاولة وسعراً أكبر من صفر.');
    }
    if (tablesRef.current.some((item) => item.id !== table.id && item.gameType === table.gameType
      && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('يوجد جدول بهذا الاسم ضمن نوع اللعبة نفسه.');
    }
    const activeSession = sessions.find((session) => session.tableId === table.id && session.isActive);
    const original = tablesRef.current.find((item) => item.id === table.id);
    if (activeSession && original && original.gameType !== table.gameType) {
      throw new Error('لا يمكن تغيير نوع اللعبة أثناء وجود جلسة نشطة على الطاولة.');
    }
    const updated = tablesRef.current.map((item) => item.id === table.id ? { ...table, name } : item);
    if (!updated.some((item) => item.id === table.id)) throw new Error('الطاولة غير موجودة.');
    await persistManagedTables(updated);
    tablesRef.current = updated;
    setTables(updated);
  }, [sessions]);

  const deleteTable = useCallback(async (tableId: string) => {
    if (sessions.some((session) => session.tableId === tableId && session.isActive)) {
      throw new Error('لا يمكن حذف طاولة لديها جلسة نشطة. أوقف الجلسة أولاً.');
    }
    const updated = tablesRef.current.filter((table) => table.id !== tableId);
    await persistManagedTables(updated);
    tablesRef.current = updated;
    setTables(updated);
  }, [sessions]);

  const addOtherGame = useCallback(async (input: Omit<OtherGame, 'id' | 'type'>) => {
    const name = input.name.trim();
    if (!name || !Number.isFinite(input.defaultRate) || input.defaultRate <= 0) {
      throw new Error('أدخل اسم اللعبة وسعراً أكبر من صفر.');
    }
    if (otherGamesRef.current.some((game) => game.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('توجد لعبة أخرى بهذا الاسم بالفعل.');
    }
    if (otherGamesRef.current.length >= 100) throw new Error('وصلت إلى الحد الأقصى وهو 100 لعبة أخرى.');
    const updated = [...otherGamesRef.current, createOtherGame({ ...input, name })];
    await persistOtherGames(updated);
    otherGamesRef.current = updated;
    setOtherGames(updated);
  }, []);

  const updateOtherGame = useCallback(async (game: OtherGame) => {
    const name = game.name.trim();
    if (!name || !Number.isFinite(game.defaultRate) || game.defaultRate <= 0) {
      throw new Error('أدخل اسم اللعبة وسعراً أكبر من صفر.');
    }
    if (otherGamesRef.current.some((item) => item.id !== game.id
      && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('توجد لعبة أخرى بهذا الاسم بالفعل.');
    }
    const updated = otherGamesRef.current.map((item) => item.id === game.id ? { ...game, name } : item);
    if (!updated.some((item) => item.id === game.id)) throw new Error('اللعبة غير موجودة.');
    await persistOtherGames(updated);
    otherGamesRef.current = updated;
    setOtherGames(updated);
  }, []);

  const deleteOtherGame = useCallback(async (gameId: string) => {
    if (sessions.some((session) => session.isActive && session.gameId === gameId)) {
      throw new Error('لا يمكن حذف لعبة لديها جلسة نشطة. أوقف الجلسة أولاً.');
    }
    const updated = otherGamesRef.current.filter((game) => game.id !== gameId);
    await persistOtherGames(updated);
    otherGamesRef.current = updated;
    setOtherGames(updated);
  }, [sessions]);

  const addMartialArtsGame = useCallback(async (input: Omit<MartialArtsGame, 'id' | 'type'>) => {
    const name = input.name.trim();
    if (!name || !/^#[\da-f]{6}$/i.test(input.color) || !input.icon) {
      throw new Error('أدخل اسم اللعبة واختر لوناً وأيقونة صحيحة.');
    }
    if (martialArtsGames.some((game) => game.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('توجد لعبة قتالية بهذا الاسم بالفعل.');
    }
    const updated = [...martialArtsGames, createMartialArtsGame({ ...input, name })];
    await persistMartialArtsGames(updated);
    setMartialArtsGames(updated);
  }, [martialArtsGames]);

  const updateMartialArtsGame = useCallback(async (game: MartialArtsGame) => {
    const name = game.name.trim();
    if (!name || !/^#[\da-f]{6}$/i.test(game.color) || !game.icon) {
      throw new Error('أدخل اسم اللعبة واختر لوناً وأيقونة صحيحة.');
    }
    if (martialArtsGames.some((item) => item.id !== game.id
      && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('توجد لعبة قتالية بهذا الاسم بالفعل.');
    }
    const updated = martialArtsGames.map((item) => item.id === game.id ? { ...game, name } : item);
    if (!updated.some((item) => item.id === game.id)) throw new Error('اللعبة القتالية غير موجودة.');
    await persistMartialArtsGames(updated);
    setMartialArtsGames(updated);
  }, [martialArtsGames]);

  const deleteMartialArtsGame = useCallback(async (gameId: string) => {
    const updated = martialArtsGames.filter((game) => game.id !== gameId);
    await persistMartialArtsGames(updated);
    setMartialArtsGames(updated);
  }, [martialArtsGames]);

  return (
    <TableGamesContext.Provider
      value={{ sessions, records, debts, otherGameSales, settings, tables, otherGames, martialArtsGames, configurationLoaded, refreshAfterPurge, tick, startSession, stopSession, freezeSession, resumeSession, addSessionTime, recordOtherGameSale, settleDebt, getActiveSession, calcFinalCost, getReport, updateSettings, addTable, updateTable, deleteTable, addOtherGame, updateOtherGame, deleteOtherGame, addMartialArtsGame, updateMartialArtsGame, deleteMartialArtsGame }}
    >
      {children}
    </TableGamesContext.Provider>
  );
}
