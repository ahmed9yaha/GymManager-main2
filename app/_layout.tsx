// Powered by OnSpace.AI
import { useEffect } from 'react';
import { AlertProvider } from '@/contexts/AlertContext';
import { FontScaleProvider } from '@/contexts/FontScaleContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { GymProvider } from '@/contexts/GymContext';
import { TableGamesProvider } from '@/contexts/TableGamesContext';
import { ShiftProvider } from '@/contexts/ShiftContext';
import { CoachProvider } from '@/contexts/CoachContext';
import { StatusBar } from 'expo-status-bar';
import { getAllMembers } from '@/services/storage';
import { initializeLocalNotifications, reconcileMemberExpiryNotifications } from '@/services/notifications';

export default function RootLayout() {
  useEffect(() => {
    let mounted = true;
    void initializeLocalNotifications().then(async (granted) => {
      if (!mounted || !granted) return;
      const members = await getAllMembers();
      if (mounted) await reconcileMemberExpiryNotifications(members);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <FontScaleProvider>
      <AlertProvider>
        <SafeAreaProvider>
          <ShiftProvider>
            <CoachProvider>
              <GymProvider>
                <TableGamesProvider>
                  <StatusBar style="light" />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="filtered-members"
                      options={{
                        headerShown: false,
                        animation: 'slide_from_left',
                      }}
                    />
                  </Stack>
                </TableGamesProvider>
              </GymProvider>
            </CoachProvider>
          </ShiftProvider>
        </SafeAreaProvider>
      </AlertProvider>
    </FontScaleProvider>
  );
}
