import { useContext } from 'react';
import { CoachContext } from '@/contexts/CoachContext';

export function useCoaches() {
  const context = useContext(CoachContext);
  if (!context) throw new Error('useCoaches must be used within CoachProvider');
  return context;
}
