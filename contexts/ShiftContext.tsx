import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShiftGateModal } from '@/features/shifts/components/ShiftGateModal';

export type ShiftTransactionType = 'billiards' | 'tabletennis' | 'othergame' | 'subscription';

export interface ShiftTransaction {
  id: string;
  shiftId: string;
  type: ShiftTransactionType;
  amount: number;
  description: string;
  occurredAt: string;
  referenceId?: string;
}

export interface WorkShift {
  id: string;
  employeeName: string;
  startedAt: string;
  endedAt?: string;
  transactions: ShiftTransaction[];
}

interface PersistedShiftState {
  activeShift: WorkShift | null;
  closedShifts: WorkShift[];
}

interface ShiftContextValue extends PersistedShiftState {
  loaded: boolean;
  refreshAfterPurge: () => Promise<void>;
  startShift: (employeeName: string) => Promise<void>;
  recordRevenue: (input: Omit<ShiftTransaction, 'id' | 'shiftId' | 'occurredAt'> & { occurredAt?: string; shiftId?: string }) => Promise<ShiftTransaction>;
  endShift: () => Promise<WorkShift>;
}

const STORAGE_KEY = 'lounge_shift_state_v1';
const ShiftContext = createContext<ShiftContextValue | undefined>(undefined);

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [activeShift, setActiveShift] = useState<WorkShift | null>(null);
  const [closedShifts, setClosedShifts] = useState<WorkShift[]>([]);
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef<PersistedShiftState>({ activeShift: null, closedShifts: [] });
  const busyRef = useRef(false);

  const commit = useCallback(async (next: PersistedShiftState) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    stateRef.current = next;
    setActiveShift(next.activeShift);
    setClosedShifts(next.closedShifts);
  }, []);

  const refreshAfterPurge = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<PersistedShiftState> : {};
    const refreshed: PersistedShiftState = {
      activeShift: parsed.activeShift && typeof parsed.activeShift.id === 'string'
        ? { ...parsed.activeShift, transactions: Array.isArray(parsed.activeShift.transactions) ? parsed.activeShift.transactions : [] }
        : null,
      closedShifts: Array.isArray(parsed.closedShifts) ? parsed.closedShifts : [],
    };
    stateRef.current = refreshed;
    setActiveShift(refreshed.activeShift);
    setClosedShifts(refreshed.closedShifts);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw) as Partial<PersistedShiftState>;
        const restored: PersistedShiftState = {
          activeShift: parsed.activeShift && typeof parsed.activeShift.id === 'string'
            ? { ...parsed.activeShift, transactions: Array.isArray(parsed.activeShift.transactions) ? parsed.activeShift.transactions : [] }
            : null,
          closedShifts: Array.isArray(parsed.closedShifts) ? parsed.closedShifts : [],
        };
        stateRef.current = restored;
        setActiveShift(restored.activeShift);
        setClosedShifts(restored.closedShifts);
      } catch (error) {
        console.error('Unable to load local shift data:', error);
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const startShift = useCallback(async (employeeName: string) => {
    const name = employeeName.trim();
    if (!name) throw new Error('أدخل اسم الموظف لبدء الوردية.');
    if (stateRef.current.activeShift) throw new Error('توجد وردية نشطة بالفعل.');
    if (busyRef.current) throw new Error('يرجى الانتظار حتى اكتمال العملية السابقة.');
    busyRef.current = true;
    try {
      await commit({
        ...stateRef.current,
        activeShift: { id: makeId('shift'), employeeName: name, startedAt: new Date().toISOString(), transactions: [] },
      });
    } finally {
      busyRef.current = false;
    }
  }, [commit]);

  const recordRevenue = useCallback(async (input: Omit<ShiftTransaction, 'id' | 'shiftId' | 'occurredAt'> & { occurredAt?: string; shiftId?: string }) => {
    const state = stateRef.current;
    const shift = state.activeShift;
    if (!shift) throw new Error('لا توجد وردية نشطة. ابدأ وردية قبل تسجيل التحصيل.');
    if (input.shiftId && input.shiftId !== shift.id) throw new Error('الوردية تغيّرت؛ لا يمكن إسناد العملية إلى وردية مختلفة.');
    if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error('قيمة التحصيل غير صحيحة.');
    if (busyRef.current) throw new Error('يرجى الانتظار حتى اكتمال العملية السابقة.');
    const previousTransaction = input.referenceId
      ? shift.transactions.find((item) => item.referenceId === input.referenceId && item.type === input.type)
      : undefined;
    if (previousTransaction) return previousTransaction;
    busyRef.current = true;
    const transaction: ShiftTransaction = {
      id: makeId('txn'),
      shiftId: shift.id,
      type: input.type,
      amount: input.amount,
      description: input.description,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      referenceId: input.referenceId,
    };
    try {
      await commit({
        ...state,
        activeShift: { ...shift, transactions: [transaction, ...shift.transactions] },
      });
      return transaction;
    } finally {
      busyRef.current = false;
    }
  }, [commit]);

  const endShift = useCallback(async () => {
    const state = stateRef.current;
    if (!state.activeShift) throw new Error('لا توجد وردية نشطة لإغلاقها.');
    if (busyRef.current) throw new Error('يرجى الانتظار حتى اكتمال العملية السابقة.');
    busyRef.current = true;
    const closed: WorkShift = { ...state.activeShift, endedAt: new Date().toISOString() };
    try {
      await commit({ activeShift: null, closedShifts: [closed, ...state.closedShifts].slice(0, 500) });
      return closed;
    } finally {
      busyRef.current = false;
    }
  }, [commit]);

  const value = useMemo(() => ({ activeShift, closedShifts, loaded, startShift, recordRevenue, endShift, refreshAfterPurge }), [
    activeShift, closedShifts, loaded, startShift, recordRevenue, endShift, refreshAfterPurge,
  ]);

  return (
    <ShiftContext.Provider value={value}>
      {children}
      <ShiftGateModal loaded={loaded} activeShift={activeShift} closedShifts={closedShifts} startShift={startShift} />
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const context = React.useContext(ShiftContext);
  if (!context) throw new Error('useShift must be used within ShiftProvider');
  return context;
}

