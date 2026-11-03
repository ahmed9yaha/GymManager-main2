// Powered by OnSpace.AI
import { SportScreen } from '@/features/sports/components/SportScreen';
import { Colors } from '@/constants/theme';

export default function GymnasticsScreen() {
  return (
    <SportScreen
      sport="gymnastics"
      label="جمباز"
      color={Colors.gymnastics}
      dimColor={Colors.gymnasticsDim}
      icon="sports-gymnastics"
    />
  );
}
