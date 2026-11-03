import { Colors } from '@/constants/theme';
import { MartialArtsGame } from '@/services/tableGames';
import { SportKey } from '@/services/storage';

export interface SportOption {
  sport: SportKey;
  label: string;
  color: string;
  dimColor: string;
  icon: string;
  iconFamily: 'material' | 'community';
  type: 'martial_arts';
}

const BUILT_IN_SPORTS: SportOption[] = [
  { type: 'martial_arts', sport: 'boxing', label: 'ملاكمة', color: Colors.boxing, dimColor: Colors.boxingDim, icon: 'sports-mma', iconFamily: 'material' },
  { type: 'martial_arts', sport: 'kickboxing', label: 'كيك بوكسينغ', color: Colors.kickboxing, dimColor: Colors.kickboxingDim, icon: 'sports-kabaddi', iconFamily: 'material' },
  { type: 'martial_arts', sport: 'karate', label: 'كاراتيه', color: Colors.karate, dimColor: Colors.karateDim, icon: 'sports-martial-arts', iconFamily: 'material' },
  { type: 'martial_arts', sport: 'gymnastics', label: 'جمباز', color: Colors.gymnastics, dimColor: Colors.gymnasticsDim, icon: 'sports-gymnastics', iconFamily: 'material' },
];

export function getSportOptions(martialArtsGames: MartialArtsGame[]): SportOption[] {
  return [
    ...BUILT_IN_SPORTS,
    ...martialArtsGames.filter((game) => game.type === 'martial_arts').map((game) => {
      const dimColor = `${game.color}20`;
      return {
        type: game.type,
        sport: `martial:${game.id}`,
        label: game.name,
        color: game.color,
        dimColor,
        icon: game.icon,
        iconFamily: 'community' as const,
      };
    }),
  ];
}
