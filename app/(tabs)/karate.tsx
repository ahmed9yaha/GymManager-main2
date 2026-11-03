// Powered by OnSpace.AI
import { SportScreen } from '@/features/sports/components/SportScreen';
import { Colors } from '@/constants/theme';

export default function KarateScreen() {
  return (
    <SportScreen
      sport="karate"
      label="كاراتيه"
      color={Colors.karate}
      dimColor={Colors.karateDim}
      icon="sports-martial-arts"
    />
  );
}
