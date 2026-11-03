// Powered by OnSpace.AI
import { SportScreen } from '@/features/sports/components/SportScreen';
import { Colors } from '@/constants/theme';

export default function KickboxingScreen() {
  return (
    <SportScreen
      sport="kickboxing"
      label="كيك بوكسينغ"
      color={Colors.kickboxing}
      dimColor={Colors.kickboxingDim}
      icon="sports-kabaddi"
    />
  );
}
