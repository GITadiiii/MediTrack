import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// State & Theme
import { useAppStore } from './src/store/appStore';
import { COLORS, getFontScale } from './src/config/theme';
import { initDatabase } from './src/database/sqliteService';
import { checkUserExists, logMedicationDose } from './src/database/dbHelpers';
import { requestNotificationPermissions } from './src/services/notificationService';
import * as Notifications from 'expo-notifications';
import { Home, HeartPulse, Pill, Activity, FileText, User } from 'lucide-react-native';

// Screens
import { LoginScreen } from './src/features/auth/LoginScreen';
import { RegisterScreen } from './src/features/auth/RegisterScreen';
import { PinUnlockScreen } from './src/features/auth/PinUnlockScreen';
import { DashboardScreen } from './src/features/dashboard/DashboardScreen';
import { VitalsScreen } from './src/features/vitals/VitalsScreen';
import { MedicinesScreen } from './src/features/medicines/MedicinesScreen';
import { SymptomsScreen } from './src/features/symptoms/SymptomsScreen';
import { ReportsScreen } from './src/features/reports/ReportsScreen';
import { ProfileScreen } from './src/features/profile/ProfileScreen';
import { NotificationsCenterScreen } from './src/features/dashboard/NotificationsCenterScreen';
import { SearchScreen } from './src/features/dashboard/SearchScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { DoctorVisitsScreen } from './src/features/doctorVisits/DoctorVisitsScreen';
import { PrescriptionsScreen } from './src/features/prescriptions/PrescriptionsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator for main authenticated flow
function TabNavigator() {
  const { themeMode, contrastMode, fontSizeScale } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // Use custom premium PageHeader inside screens
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: contrastMode === 'high' ? 2 : 1,
          borderTopColor: theme.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12 * fontScale,
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size || 20} />,
        }}
      />
      <Tab.Screen
        name="VitalsTab"
        component={VitalsScreen}
        options={{
          title: 'Vitals',
          tabBarLabel: 'Vitals',
          tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size || 20} />,
        }}
      />
      <Tab.Screen
        name="MedicinesTab"
        component={MedicinesScreen}
        options={{
          title: 'Medicines',
          tabBarLabel: 'Medicines',
          tabBarIcon: ({ color, size }) => <Pill color={color} size={size || 20} />,
        }}
      />
      <Tab.Screen
        name="SymptomsTab"
        component={SymptomsScreen}
        options={{
          title: 'Symptoms',
          tabBarLabel: 'Symptoms',
          tabBarIcon: ({ color, size }) => <Activity color={color} size={size || 20} />,
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={ReportsScreen}
        options={{
          title: 'Reports',
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size || 20} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size || 20} />,
        }}
      />
    </Tab.Navigator>
  );
}


export default function App() {
  const {
    user,
    isLocked,
    hasPin,
    themeMode,
    contrastMode,
    setUser,
    setHasPin,
    setBiometricsEnabled,
    setIsLocked,
  } = useAppStore();

  const theme = COLORS[themeMode][contrastMode];

  useEffect(() => {
    // 1. Initialize SQLite Database & Tables
    initDatabase();

    // 2. Check if a registered user profile exists
    const localUser = checkUserExists();
    if (localUser) {
      setHasPin(true);
      setBiometricsEnabled(localUser.biometrics_enabled === 1);
      // Auto-lock on launch if PIN exists
      setIsLocked(true);
    }

    // 3. Request push notifications
    requestNotificationPermissions();

    // 4. Register Notification Actions listener
    let subscription: any = null;
    if (Platform.OS !== 'web') {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data;

        if (data && data.medId) {
          const { medId, medName, dosage, unit, scheduledTime } = data;
          console.log(`Notification action: ${actionIdentifier} for med: ${medName} (${medId})`);

          const todayDateStr = new Date().toISOString().split('T')[0];
          const logScheduledTime = `${todayDateStr} ${scheduledTime || '08:00'}`;

          if (actionIdentifier === 'TAKEN') {
            logMedicationDose(medId as number, logScheduledTime, 'TAKEN');
            Alert.alert('Medication Taken', `Marked ${medName} as taken.`);
          } else if (actionIdentifier === 'SKIP') {
            logMedicationDose(medId as number, logScheduledTime, 'SKIPPED');
            Alert.alert('Medication Skipped', `Marked ${medName} as skipped.`);
          } else if (actionIdentifier === 'SNOOZE') {
            Notifications.scheduleNotificationAsync({
              content: {
                title: `⏰ Snoozed Reminder: ${medName}`,
                body: `It is time to take ${dosage} ${unit} of ${medName}.`,
                categoryIdentifier: 'MEDICINE_ALERT',
                data: { medId, medName, dosage, unit, scheduledTime },
                sound: true,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 10 * 60,
              } as any,
            });
            Alert.alert('Snoozed', `Reminder for ${medName} snoozed for 10 minutes.`);
          }
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Show security overlay screen if locked
  if (user && isLocked && hasPin) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <PinUnlockScreen />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.card,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: theme.background,
          },
        }}
      >
        {user ? (
          // Authenticated App Flow
          <>
            <Stack.Screen
              name="MainApp"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NotificationsCenter"
              component={NotificationsCenterScreen}
              options={{ title: 'Notifications Center' }}
            />
            <Stack.Screen
              name="Search"
              component={SearchScreen}
              options={{ title: 'Global Search Cabinet' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings', headerShown: false }}
            />
            <Stack.Screen
              name="DoctorVisits"
              component={DoctorVisitsScreen}
              options={{ title: 'Doctor Visits', headerShown: false }}
            />
            <Stack.Screen
              name="Prescriptions"
              component={PrescriptionsScreen}
              options={{ title: 'Prescriptions', headerShown: false }}
            />
          </>
        ) : (
          // Unauthenticated Auth Flow
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
