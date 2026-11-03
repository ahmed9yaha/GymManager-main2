import React, { createContext, ReactNode, useContext, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/ScaledText';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const normalizedButtons = buttons?.length ? buttons : [{ text: 'OK' }];
    if (Platform.OS === 'web') {
      setAlertState({ visible: true, title, message: message || '', buttons: normalizedButtons });
      return;
    }

    Alert.alert(title, message || '', normalizedButtons.map((button) => ({
      text: button.text,
      onPress: button.onPress,
      style: button.style,
    })));
  };

  const hideAlert = () => setAlertState((previous) => ({ ...previous, visible: false }));
  const handleButtonPress = (button: AlertButton) => {
    try {
      button.onPress?.();
    } catch (error) {
      console.warn('[AlertProvider] Button press error:', error);
    } finally {
      hideAlert();
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {Platform.OS === 'web' ? (
        <WebAlertModal alertState={alertState} onButtonPress={handleButtonPress} />
      ) : null}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextType {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context;
}

function WebAlertModal({
  alertState,
  onButtonPress,
}: {
  alertState: AlertState;
  onButtonPress: (button: AlertButton) => void;
}) {
  if (!alertState.visible) return null;

  const getButtonTextStyle = (button: AlertButton) => {
    switch (button.style) {
      case 'cancel': return styles.cancelButtonText;
      case 'destructive': return styles.destructiveButtonText;
      default: return styles.defaultButtonText;
    }
  };

  return (
    <Modal visible={alertState.visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>{alertState.title}</Text>
            {alertState.message ? <Text style={styles.message}>{alertState.message}</Text> : null}
          </View>
          <View style={styles.buttonContainer}>
            {alertState.buttons.length === 1 ? (
              <TouchableOpacity
                style={[styles.button, styles.singleButton]}
                onPress={() => onButtonPress(alertState.buttons[0])}
                activeOpacity={0.8}
              >
                <Text style={getButtonTextStyle(alertState.buttons[0])}>{alertState.buttons[0].text}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.multiButtonContainer}>
                {alertState.buttons.map((button, index) => (
                  <TouchableOpacity
                    key={`${button.text}-${index}`}
                    style={[styles.button, index < alertState.buttons.length - 1 && styles.buttonWithBorder]}
                    onPress={() => onButtonPress(button)}
                    activeOpacity={0.8}
                  >
                    <Text style={getButtonTextStyle(button)}>{button.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'ios' ? 14 : 12,
    minWidth: 280,
    maxWidth: 420,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  title: { fontSize: 17, fontWeight: Platform.OS === 'ios' ? '600' : '500', color: '#1D1D1F', marginBottom: 8, textAlign: 'center', letterSpacing: Platform.OS === 'ios' ? -0.24 : 0 },
  message: { fontSize: 15, color: '#86868B', textAlign: 'center', lineHeight: 20, letterSpacing: Platform.OS === 'ios' ? -0.24 : 0 },
  buttonContainer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D1D1D6' },
  multiButtonContainer: { flexDirection: 'row' },
  button: { paddingVertical: 17, alignItems: 'center', justifyContent: 'center', minHeight: 56, flex: 1, backgroundColor: 'transparent' },
  singleButton: { flex: 0, width: '100%' },
  buttonWithBorder: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#D1D1D6' },
  defaultButtonText: { color: '#007AFF', fontSize: 17, fontWeight: Platform.OS === 'ios' ? '600' : '500', letterSpacing: Platform.OS === 'ios' ? -0.24 : 0 },
  cancelButtonText: { color: '#007AFF', fontSize: 17, fontWeight: '400', letterSpacing: Platform.OS === 'ios' ? -0.24 : 0 },
  destructiveButtonText: { color: '#FF3B30', fontSize: 17, fontWeight: Platform.OS === 'ios' ? '600' : '500', letterSpacing: Platform.OS === 'ios' ? -0.24 : 0 },
});
