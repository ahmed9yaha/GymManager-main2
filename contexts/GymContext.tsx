// Powered by OnSpace.AI
import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  Member,
  SportKey,
  getMembers,
  addMember,
  deleteMember,
  renewMember,
  updateMember,
  MemberUpdate,
  getMemberStatus,
  getConfiguredSportKeys,
} from '@/services/storage';
import { reconcileMemberExpiryNotifications, removeMemberExpiryNotification } from '@/services/notifications';
import { useShift } from '@/contexts/ShiftContext';
import { useCoaches } from '@/features/coaches/hooks/useCoaches';

const SPORTS: SportKey[] = ['boxing', 'kickboxing', 'karate', 'gymnastics'];

interface SportStats {
  total: number;
  expiringSoon: number;
  expired: number;
}

interface GymContextType {
  members: Record<SportKey, Member[]>;
  loading: boolean;
  refreshSport: (sport: SportKey) => Promise<void>;
  refreshAll: () => Promise<void>;
  addMemberToSport: (sport: SportKey, data: Omit<Member, 'id' | 'sport' | 'createdAt'>) => Promise<void>;
  removeMember: (sport: SportKey, id: string) => Promise<void>;
  renewMemberSubscription: (sport: SportKey, id: string, dates: { startDate: string; endDate: string }, amount: number) => Promise<void>;
  updateMemberDetails: (sport: SportKey, id: string, changes: MemberUpdate) => Promise<void>;
  getStats: (sport: SportKey) => SportStats;
}

export const GymContext = createContext<GymContextType | undefined>(undefined);

export function GymProvider({ children }: { children: ReactNode }) {
  const { recordRevenue } = useShift();
  const { getCoachForGame } = useCoaches();
  const [members, setMembers] = useState<{ [key in SportKey]: Member[] }>({
    boxing: [],
    kickboxing: [],
    karate: [],
    gymnastics: [],
  });
  const [loading, setLoading] = useState(true);
  const addingMemberRef = useRef(false);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const sportKeys = await getConfiguredSportKeys();
    const entries = await Promise.all(sportKeys.map(async (sport) => [sport, await getMembers(sport)] as const));
    setMembers(Object.fromEntries(entries));
    setLoading(false);
  }, []);

  const refreshSport = useCallback(async (sport: SportKey) => {
    const updated = await getMembers(sport);
    setMembers((prev) => ({ ...prev, [sport]: updated }));
  }, []);

  const refreshExpiryNotifications = useCallback(async () => {
    const sports = new Set([...SPORTS, ...await getConfiguredSportKeys()]);
    const allMembers = await Promise.all([...sports].map(async (sport) => [sport, await getMembers(sport)] as const));
    await reconcileMemberExpiryNotifications(Object.fromEntries(allMembers));
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const addMemberToSport = useCallback(
    async (sport: SportKey, data: Omit<Member, 'id' | 'sport' | 'createdAt'>) => {
      if (addingMemberRef.current) throw new Error('يرجى الانتظار حتى اكتمال عملية التسجيل السابقة.');
      addingMemberRef.current = true;
      try {
        const coach = getCoachForGame(sport);
        if (data.isComplimentary) {
          if (!coach || data.coachId !== coach.id) throw new Error('لا يوجد كابتن معيّن لهذا النشاط.');
          const persistedMembers = await getMembers(sport);
          const complimentaryCount = persistedMembers.filter((member) => member.isComplimentary && member.coachId === coach.id).length;
          if (complimentaryCount >= coach.maxFreeMembers) throw new Error('اكتمل الحد الأقصى للمشتركين مجاناً لهذا الكابتن.');
          data = { ...data, fee: 0, coachId: coach.id };
        } else if (coach && data.coachId !== coach.id) {
          data = { ...data, coachId: coach.id };
        }
        const member = await addMember(sport, data);
        try {
          if (member.fee > 0) {
            await recordRevenue({
              type: 'subscription',
              amount: member.fee,
              description: `اشتراك ${member.name} — ${sport}`,
              referenceId: member.id,
            });
          }
        } finally {
          await refreshSport(sport);
          await refreshExpiryNotifications();
        }
      } finally {
        addingMemberRef.current = false;
      }
    },
    [getCoachForGame, recordRevenue, refreshSport, refreshExpiryNotifications]
  );

  const removeMember = useCallback(
    async (sport: SportKey, id: string) => {
      await deleteMember(sport, id);
      await refreshSport(sport);
      await removeMemberExpiryNotification(sport, id);
    },
    [refreshSport]
  );

  const renewMemberSubscription = useCallback(
    async (sport: SportKey, id: string, dates: { startDate: string; endDate: string }, amount: number) => {
      const member = (members[sport] ?? []).find((item) => item.id === id);
      if (!member) throw new Error('المشترك غير موجود.');
      if (!Number.isFinite(amount) || amount < 0) throw new Error('قيمة التحصيل غير صحيحة.');
      await renewMember(sport, id, dates);
      try {
        await recordRevenue({
          type: 'subscription',
          amount,
          description: `تجديد اشتراك ${member.name} — ${sport}`,
          referenceId: `renewal_${id}_${Date.now()}`,
        });
      } finally {
        await refreshSport(sport);
        await refreshExpiryNotifications();
      }
    },
    [members, recordRevenue, refreshSport, refreshExpiryNotifications]
  );

  const updateMemberDetails = useCallback(
    async (sport: SportKey, id: string, changes: MemberUpdate) => {
      const updatedMember = await updateMember(sport, id, changes);
      // Updating the context immediately refreshes every screen consuming this list.
      setMembers((prev) => ({
        ...prev,
        [sport]: prev[sport].map((member) => member.id === id ? updatedMember : member),
      }));
      await refreshExpiryNotifications();
    },
    [refreshExpiryNotifications]
  );

  const getStats = useCallback(
    (sport: SportKey): SportStats => {
      const list = members[sport] ?? [];
      const total = list.length;
      const expiringSoon = list.filter((m) => getMemberStatus(m.endDate) === 'expiring').length;
      const expired = list.filter((m) => getMemberStatus(m.endDate) === 'expired').length;
      return { total, expiringSoon, expired };
    },
    [members]
  );

  return (
    <GymContext.Provider
      value={{ members, loading, refreshSport, refreshAll, addMemberToSport, removeMember, renewMemberSubscription, updateMemberDetails, getStats }}
    >
      {children}
    </GymContext.Provider>
  );
}
