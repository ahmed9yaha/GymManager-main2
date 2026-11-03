// Powered by OnSpace.AI
export const Colors = {
  background: '#0A0A0A',
  surface: '#141414',
  card: '#1C1C1C',
  cardElevated: '#242424',
  border: '#2A2A2A',

  // Sport Colors
  boxing: '#E53E3E',
  boxingDim: '#2D1515',
  kickboxing: '#ED8936',
  kickboxingDim: '#2D1C0A',
  karate: '#3B82F6',
  karateDim: '#0D1A30',
  gymnastics: '#A855F7',
  gymnasticsDim: '#1A0D2A',
  reports: '#10B981',
  reportsDim: '#0A2018',

  // Stats Cards
  statBlue: '#3B82F6',
  statBlueDim: '#0D1A30',
  statYellow: '#F59E0B',
  statYellowDim: '#2A1E05',
  statRed: '#EF4444',
  statRedDim: '#2D1010',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',

  // Functional
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',

  white: '#FFFFFF',
  black: '#000000',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const SportConfig = {
  boxing: {
    label: 'ملاكمة',
    color: Colors.boxing,
    dimColor: Colors.boxingDim,
    icon: 'sports-mma',
    key: 'boxing',
  },
  kickboxing: {
    label: 'كيك بوكسينغ',
    color: Colors.kickboxing,
    dimColor: Colors.kickboxingDim,
    icon: 'sports-kabaddi',
    key: 'kickboxing',
  },
  karate: {
    label: 'كاراتيه',
    color: Colors.karate,
    dimColor: Colors.karateDim,
    icon: 'sports-martial-arts',
    key: 'karate',
  },
  gymnastics: {
    label: 'جمباز',
    color: Colors.gymnastics,
    dimColor: Colors.gymnasticsDim,
    icon: 'sports-gymnastics',
    key: 'gymnastics',
  },
};
