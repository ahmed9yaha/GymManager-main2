import React, { useEffect, useMemo, useState } from 'react';
import { SportScreen } from '@/features/sports/components/SportScreen';
import { getSportOptions } from '@/features/sports/sportConfig';
import { useTableGames } from '@/hooks/useTableGames';
import { SportKey } from '@/services/storage';

export function UnifiedSportsScreen() {
  const { martialArtsGames, configurationLoaded } = useTableGames();
  const sportOptions = useMemo(() => getSportOptions(martialArtsGames), [martialArtsGames]);
  const [selectedSport, setSelectedSport] = useState<SportKey>('boxing');
  const selectedOption = sportOptions.find((option) => option.sport === selectedSport) ?? sportOptions[0];

  useEffect(() => {
    if (configurationLoaded && !sportOptions.some((option) => option.sport === selectedSport)) {
      setSelectedSport('boxing');
    }
  }, [configurationLoaded, selectedSport, sportOptions]);

  if (!selectedOption) return null;

  return (
    <SportScreen
      key={selectedOption.sport}
      {...selectedOption}
      sportOptions={sportOptions}
      onSelectSport={setSelectedSport}
    />
  );
}
