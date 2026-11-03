import { useCallback, useState } from 'react';
import { useAlert } from '@/contexts/AlertContext';
import { useGym } from '@/hooks/useGym';
import { Member, MemberUpdate, SportKey } from '@/services/storage';

export function useSportMemberActions(sport: SportKey, onEditPress?: () => void) {
  const { members, removeMember, renewMemberSubscription, updateMemberDetails } = useGym();
  const { showAlert } = useAlert();
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const sportMembers = members[sport] ?? [];

  const handleDelete = useCallback((id: string) => {
    const member = sportMembers.find((item) => item.id === id);
    showAlert('حذف المشترك', `هل تريد حذف "${member?.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => void removeMember(sport, id),
      },
    ]);
  }, [removeMember, showAlert, sport, sportMembers]);

  const handleRenewPress = useCallback((id: string) => {
    setRenewingMember(sportMembers.find((member) => member.id === id) ?? null);
  }, [sportMembers]);

  const handleRenew = useCallback(async (
    id: string,
    dates: { startDate: string; endDate: string },
    amount: number,
  ) => {
    await renewMemberSubscription(sport, id, dates, amount);
  }, [renewMemberSubscription, sport]);

  const handleEditPress = useCallback((id: string) => {
    onEditPress?.();
    setEditingMember(sportMembers.find((member) => member.id === id) ?? null);
  }, [onEditPress, sportMembers]);

  const handleEditSave = useCallback(async (id: string, changes: MemberUpdate) => {
    await updateMemberDetails(sport, id, changes);
  }, [sport, updateMemberDetails]);

  return {
    renewingMember,
    editingMember,
    handleDelete,
    handleRenewPress,
    handleRenew,
    handleEditPress,
    handleEditSave,
    closeRenew: () => setRenewingMember(null),
    closeEdit: () => setEditingMember(null),
  };
}