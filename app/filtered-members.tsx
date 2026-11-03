// Powered by OnSpace.AI
import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { Text } from '@/components/ui/ScaledText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useGym } from '@/hooks/useGym';
import { MemberCard } from '@/features/sports/components/MemberCard';
import { RenewSubscriptionModal } from '@/features/sports/components/RenewSubscriptionModal';
import { EditMemberModal } from '@/features/sports/components/EditMemberModal';
import { getMemberStatus, SportKey } from '@/services/storage';
import { useSportMemberActions } from '@/features/sports/hooks/useSportMemberActions';
import { getSportOptions } from '@/features/sports/sportConfig';
import { useTableGames } from '@/hooks/useTableGames';

const SPORT_LABELS: Record<string, string> = {
  boxing: 'ملاكمة',
  kickboxing: 'كيك بوكسينغ',
  karate: 'كاراتيه',
  gymnastics: 'جمباز',
};

const SPORT_COLORS: Record<string, string> = {
  boxing: Colors.boxing,
  kickboxing: Colors.kickboxing,
  karate: Colors.karate,
  gymnastics: Colors.gymnastics,
};

const SPORT_DIM_COLORS: Record<string, string> = {
  boxing: Colors.boxingDim,
  kickboxing: Colors.kickboxingDim,
  karate: Colors.karateDim,
  gymnastics: Colors.gymnasticsDim,
};

const FILTER_CONFIG: Record<
  string,
  { label: string; color: string; dimColor: string; icon: keyof typeof MaterialIcons.glyphMap; emptyMsg: string }
> = {
  all: {
    label: 'إجمالي المشتركين',
    color: Colors.statBlue,
    dimColor: Colors.statBlueDim,
    icon: 'people',
    emptyMsg: 'لا يوجد مشتركون بعد',
  },
  expiring: {
    label: 'ينتهي قريباً',
    color: Colors.statYellow,
    dimColor: Colors.statYellowDim,
    icon: 'schedule',
    emptyMsg: 'لا يوجد مشتركون على وشك الانتهاء',
  },
  expired: {
    label: 'منتهي الاشتراك',
    color: Colors.statRed,
    dimColor: Colors.statRedDim,
    icon: 'event-busy',
    emptyMsg: 'لا يوجد مشتركون منتهية اشتراكاتهم',
  },
};

export default function FilteredMembersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sport, filter } = useLocalSearchParams<{ sport: string; filter: string }>();

  const { members } = useGym();
  const { martialArtsGames } = useTableGames();
  const dynamicSport = getSportOptions(martialArtsGames).find((option) => option.sport === sport);

  const sportKey = (sport || 'boxing') as SportKey;
  const {
    renewingMember,
    editingMember,
    handleDelete,
    handleRenewPress,
    handleRenew,
    handleEditPress,
    handleEditSave,
    closeRenew,
    closeEdit,
  } = useSportMemberActions(sportKey);
  const filterKey = filter || 'all';

  const sportColor = dynamicSport?.color || SPORT_COLORS[sportKey] || Colors.statBlue;
  const sportDimColor = dynamicSport?.dimColor || SPORT_DIM_COLORS[sportKey] || Colors.statBlueDim;
  const filterConfig = FILTER_CONFIG[filterKey] || FILTER_CONFIG.all;

  const filteredMembers = useMemo(() => {
    const list = members[sportKey] || [];
    if (filterKey === 'all') return list;
    return list.filter((m) => getMemberStatus(m.endDate) === filterKey);
  }, [members, sportKey, filterKey]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: sportColor + '30' }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-forward-ios" size={20} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{dynamicSport?.label || SPORT_LABELS[sportKey] || sportKey}</Text>
          <View style={[styles.filterBadge, { backgroundColor: filterConfig.dimColor, borderColor: filterConfig.color + '50' }]}>
            <MaterialIcons name={filterConfig.icon} size={13} color={filterConfig.color} />
            <Text style={[styles.filterBadgeText, { color: filterConfig.color }]}>
              {filterConfig.label}
            </Text>
          </View>
        </View>

        <View style={[styles.countBadge, { backgroundColor: filterConfig.dimColor, borderColor: filterConfig.color + '40' }]}>
          <Text style={[styles.countText, { color: filterConfig.color }]}>
            {filteredMembers.length}
          </Text>
        </View>
      </View>

      {/* Summary Bar */}
      <View style={[styles.summaryBar, { backgroundColor: filterConfig.dimColor, borderColor: filterConfig.color + '25' }]}>
        <MaterialIcons name={filterConfig.icon} size={18} color={filterConfig.color} />
        <Text style={[styles.summaryText, { color: filterConfig.color }]}>
          {filteredMembers.length} {filterKey === 'all' ? 'مشترك' : filterKey === 'expiring' ? 'مشترك ينتهي اشتراكه خلال أسبوع' : 'مشترك منتهي الاشتراك'}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <MemberCard member={item} sportColor={sportColor} onDelete={handleDelete} onRenew={handleRenewPress} onEdit={handleEditPress} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: filterConfig.dimColor }]}>
              <MaterialIcons name={filterConfig.icon} size={44} color={filterConfig.color + '70'} />
            </View>
            <Text style={styles.emptyTitle}>{filterConfig.emptyMsg}</Text>
          </View>
        }
      />
      <RenewSubscriptionModal
        visible={renewingMember !== null}
        member={renewingMember}
        sportColor={sportColor}
        onClose={closeRenew}
        onRenew={handleRenew}
      />
      <EditMemberModal
        visible={editingMember !== null}
        member={editingMember}
        sportLabel={dynamicSport?.label || SPORT_LABELS[sportKey] || sportKey}
        sportColor={sportColor}
        onClose={closeEdit}
        onSave={handleEditSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderWidth: 1,
  },
  filterBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  countBadge: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  summaryBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 70,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxxl,
    lineHeight: 24,
  },
});
