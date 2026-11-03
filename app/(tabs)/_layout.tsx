// Powered by OnSpace.AI
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Colors, FontSize, Spacing } from '@/constants/theme';

const HIDE_DELAY_MS = 3000;

const SIDEBAR_ITEMS = [
  { key: 'index', icon: 'sports-martial-arts', color: Colors.statBlue, label: 'الرياضات' },
  { key: 'other-games', icon: 'sports-esports', color: '#F97316', label: 'ألعاب أخرى' },
  { key: 'debts', icon: 'account-balance-wallet', color: Colors.warning, label: 'الديون' },
  { key: 'reports', icon: 'bar-chart', color: Colors.reports, label: 'التقارير' },
  { key: 'management', icon: 'tune', color: Colors.reports, label: 'الإدارة' },
];

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const [isVisible, setIsVisible] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeKey = useCallback(() => {
    const segment = pathname.replace('/(tabs)/', '').split('/')[0];
    return SIDEBAR_ITEMS.find((item) => item.key === segment)?.key ?? 'index';
  }, [pathname]);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const showSidebar = useCallback(() => {
    clearHideTimer();
    setIsVisible(true);
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [clearHideTimer, opacityAnim]);

  const hideSidebar = useCallback(() => {
    clearHideTimer();
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  }, [clearHideTimer, opacityAnim]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      hideSidebar();
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, hideSidebar]);

  const handleItemPress = useCallback(
    (key: string) => {
      // Only navigate when sidebar is fully visible; reveal-only while hidden/fading
      if (!isVisible) return;
      clearHideTimer();
      setIsVisible(false);
      opacityAnim.setValue(0);
      router.push(key === 'index' ? '/(tabs)' : `/(tabs)/${key}`);
    },
    [isVisible, clearHideTimer, opacityAnim, router]
  );

  useEffect(() => {
    scheduleHide();
  }, [pathname, scheduleHide]);

  useEffect(() => {
    opacityAnim.setValue(0);
    setIsVisible(false);
    return () => clearHideTimer();
  }, [clearHideTimer]);

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          tabBarStyle: { display: 'none' },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'الرياضات',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="sports-martial-arts" size={22} color={color} />
            ),
            tabBarActiveTintColor: Colors.reports,
          }}
        />
        <Tabs.Screen
          name="kickboxing"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="karate"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="gymnastics"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="other-games"
          options={{
            title: 'ألعاب أخرى',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="sports-esports" size={22} color={color} />
            ),
            tabBarActiveTintColor: '#F97316',
          }}
        />
        <Tabs.Screen
          name="debts"
          options={{
            title: 'الديون',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="account-balance-wallet" size={22} color={color} />
            ),
            tabBarActiveTintColor: Colors.warning,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'التقارير',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="bar-chart" size={22} color={color} />
            ),
            tabBarActiveTintColor: Colors.reports,
          }}
        />
        <Tabs.Screen
          name="management"
          options={{
            title: 'الإدارة',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="tune" size={22} color={color} />
            ),
            tabBarActiveTintColor: Colors.reports,
          }}
        />
      </Tabs>

      {/* Full-screen invisible backdrop: dismisses sidebar when tapping anywhere outside icons */}
      {isVisible && (
        <Pressable style={styles.backdrop} onPress={hideSidebar} hitSlop={20} />
      )}

      {/* Floating sidebar: hidden at rest, reveals on left-edge touch */}
      <Animated.View
        style={[
          styles.sidebar,
          { opacity: opacityAnim, pointerEvents: isVisible ? 'auto' : 'none' },
        ]}
      >
        <View style={styles.sidebarContent}>
          {SIDEBAR_ITEMS.map((item) => {
            const active = activeKey() === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.item,
                  active
                    ? { borderColor: '#1A73E8' }
                    : { borderColor: 'rgba(255, 255, 255, 0.22)' },
                ]}
                onPress={() => handleItemPress(item.key)}
                hitSlop={8}
              >
                <MaterialIcons
                  name={item.icon}
                  size={FontSize.xl}
                  color={active ? Colors.white : Colors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Bottom-edge invisible touch zone: reveals the bottom floating bar */}
      <View
        style={styles.bottomTouchZone}
        onStartShouldSetResponder={() => true}
        onTouchStart={showSidebar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sidebar: {
    position: 'absolute',
    bottom: 25,
    left: '50%',
    transform: [{ translateX: -160 }],
    width: 320,
    height: 65,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  sidebarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  item: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1.6,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  bottomTouchZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'transparent',
  },
});
