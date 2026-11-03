import React, { createContext, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Coach,
  CoachInput,
  createCoachId,
  loadCoaches,
  persistCoachPhoto,
  removeCoachPhoto,
  saveCoaches,
} from '@/services/coaches';

interface CoachContextValue {
  coaches: Coach[];
  loaded: boolean;
  refreshCoaches: () => Promise<void>;
  addCoach: (input: CoachInput) => Promise<Coach>;
  updateCoach: (id: string, input: CoachInput) => Promise<void>;
  removeCoach: (id: string) => Promise<void>;
  removeCoachForGame: (gameKey: Coach['gameKey']) => Promise<void>;
  getCoachForGame: (gameKey: Coach['gameKey']) => Coach | undefined;
}

export const CoachContext = createContext<CoachContextValue | undefined>(undefined);

export function CoachProvider({ children }: { children: ReactNode }) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loaded, setLoaded] = useState(false);
  const coachesRef = useRef<Coach[]>([]);
  const busyRef = useRef(false);

  const publish = useCallback((next: Coach[]) => {
    coachesRef.current = next;
    setCoaches(next);
  }, []);

  const refreshCoaches = useCallback(async () => {
    const saved = await loadCoaches();
    publish(saved);
  }, [publish]);

  useEffect(() => {
    let mounted = true;
    void loadCoaches().then((saved) => {
      if (mounted) publish(saved);
    }).finally(() => {
      if (mounted) setLoaded(true);
    });
    return () => { mounted = false; };
  }, [publish]);

  const assertInput = (input: CoachInput, current: Coach[], excludeId?: string) => {
    if (!input.name.trim()) throw new Error('يرجى إدخال اسم الكابتن.');
    if (!input.gameLabel.trim() || !input.gameKey) throw new Error('يرجى اختيار اللعبة أو الرياضة.');
    if (!Number.isFinite(input.profitPercentage) || input.profitPercentage < 0 || input.profitPercentage > 100) {
      throw new Error('نسبة أرباح الكابتن يجب أن تكون بين 0 و100.');
    }
    if (!Number.isInteger(input.maxFreeMembers) || input.maxFreeMembers < 0) {
      throw new Error('الحد الأقصى للمشتركين مجاناً يجب أن يكون عدداً صحيحاً غير سالب.');
    }
    if (current.some((coach) => coach.gameKey === input.gameKey && coach.id !== excludeId)) {
      throw new Error('يوجد كابتن مسجل لهذه اللعبة بالفعل. عدّل بياناته من القائمة.');
    }
  };

  const addCoach = useCallback(async (input: CoachInput) => {
    if (busyRef.current) throw new Error('يرجى الانتظار حتى اكتمال العملية السابقة.');
    busyRef.current = true;
    let persistedPhoto: string | null = null;
    try {
      const current = coachesRef.current;
      assertInput(input, current);
      const id = createCoachId();
      persistedPhoto = input.photoUri ? await persistCoachPhoto(input.photoUri, id) : null;
      const coach: Coach = { ...input, id, name: input.name.trim(), phone: input.phone.trim(), photoUri: persistedPhoto };
      const next = [coach, ...current];
      await saveCoaches(next);
      publish(next);
      return coach;
    } catch (error) {
      if (persistedPhoto) await removeCoachPhoto(persistedPhoto);
      throw error;
    } finally {
      busyRef.current = false;
    }
  }, [publish]);

  const updateCoach = useCallback(async (id: string, input: CoachInput) => {
    if (busyRef.current) throw new Error('يرجى الانتظار حتى اكتمال العملية السابقة.');
    busyRef.current = true;
    let newlyPersistedPhoto: string | null = null;
    try {
      const current = coachesRef.current;
      const existing = current.find((coach) => coach.id === id);
      if (!existing) throw new Error('تعذر العثور على بيانات الكابتن.');
      assertInput(input, current, id);
      let photoUri = input.photoUri;
      if (photoUri && photoUri !== existing.photoUri) {
        newlyPersistedPhoto = await persistCoachPhoto(photoUri, id);
        photoUri = newlyPersistedPhoto;
      }
      const updated: Coach = {
        ...input,
        id: existing.id,
        name: input.name.trim(),
        phone: input.phone.trim(),
        photoUri,
      };
      const next = current.map((coach) => coach.id === id ? updated : coach);
      await saveCoaches(next);
      publish(next);
      if (existing.photoUri && existing.photoUri !== photoUri) await removeCoachPhoto(existing.photoUri);
    } catch (error) {
      if (newlyPersistedPhoto) await removeCoachPhoto(newlyPersistedPhoto);
      throw error;
    } finally {
      busyRef.current = false;
    }
  }, [publish]);

  const removeCoach = useCallback(async (id: string) => {
    if (busyRef.current) throw new Error('يرجى الانتظار حتى اكتمال العملية السابقة.');
    busyRef.current = true;
    try {
      const current = coachesRef.current;
      const removed = current.find((coach) => coach.id === id);
      const next = current.filter((coach) => coach.id !== id);
      await saveCoaches(next);
      publish(next);
      if (removed?.photoUri) await removeCoachPhoto(removed.photoUri);
    } finally {
      busyRef.current = false;
    }
  }, [publish]);

  const removeCoachForGame = useCallback(async (gameKey: Coach['gameKey']) => {
    const coach = coachesRef.current.find((item) => item.gameKey === gameKey);
    if (coach) await removeCoach(coach.id);
  }, [removeCoach]);

  const getCoachForGame = useCallback(
    (gameKey: Coach['gameKey']) => coaches.find((coach) => coach.gameKey === gameKey),
    [coaches]
  );

  return (
    <CoachContext.Provider value={{ coaches, loaded, refreshCoaches, addCoach, updateCoach, removeCoach, removeCoachForGame, getCoachForGame }}>
      {children}
    </CoachContext.Provider>
  );
}
