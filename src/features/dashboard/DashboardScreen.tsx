import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Home as HomeIcon,
  Bell,
  HeartPulse,
  Pill,
  Activity,
  FileText,
  ShieldAlert,
  Check,
  X,
  ChevronRight,
  ClipboardList,
  Stethoscope,
  FolderOpen
} from 'lucide-react-native';

import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import {
  getVitalsHistory,
  getMedications,
  getMedicationLogs,
  getSymptomsHistory,
  getEmergencyContact,
  getMedicalProfile,
  logMedicationDose,
  getAdherenceStats,
  VitalDB,
  MedicationDB,
  SymptomDB,
} from '../../database/dbHelpers';
import { getCurrentLocation } from '../../services/locationService';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { VitalBadge, VitalStatus } from '../../components/VitalBadge';
import { IconContainer } from '../../components/IconContainer';
import { CircularProgress } from '../../components/CircularProgress';

interface QuickActionCardProps {
  onPress: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  fontScale: number;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ onPress, title, subtitle, icon, fontScale }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.gridCellWrapper}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={['#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gridCellGradient}
        >
          <View style={styles.iconCircleContainer}>
            {icon}
          </View>
          <Text style={[styles.gridCellTitle, { fontSize: 16 * fontScale }]}>{title}</Text>
          <Text style={[styles.gridCellSubtitle, { fontSize: 12 * fontScale }]}>{subtitle}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const { themeMode, contrastMode, fontSizeScale, user, notifications, setIsLocked } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const [loading, setLoading] = useState(true);
  const [lastVital, setLastVital] = useState<VitalDB | null>(null);
  const [medicationsList, setMedicationsList] = useState<MedicationDB[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<Array<{ med: MedicationDB; time: string; taken: boolean; skipped: boolean }>>([]);
  const [lastSymptom, setLastSymptom] = useState<SymptomDB | null>(null);
  const [adherence, setAdherence] = useState(100);
  const [healthScore, setHealthScore] = useState(70);
  const [sosLoading, setSosLoading] = useState(false);

  useEffect(() => {
    if (isFocused && user) {
      loadDashboardData();
    }
  }, [isFocused, user]);

  const loadDashboardData = () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch last vitals
      const vitals = getVitalsHistory(user.id, 1);
      setLastVital(vitals.length > 0 ? vitals[0] : null);

      // 2. Fetch medications
      const meds = getMedications(user.id);
      setMedicationsList(meds);

      // 3. Fetch symptom logs
      const symptoms = getSymptomsHistory(user.id, 1);
      setLastSymptom(symptoms.length > 0 ? symptoms[0] : null);

      // 4. Calculate Adherence (past 7 days)
      const stats = getAdherenceStats(user.id, 7);
      const rate = stats.total > 0 ? (stats.taken / stats.total) * 100 : 100;
      setAdherence(rate);

      // 5. Generate Today's Medication Schedule Checklist
      const todayLogs = getMedicationLogs(user.id, 1); // Logs in past 24 hrs
      const schedule: typeof todaySchedule = [];

      meds.forEach((med) => {
        let times: string[] = [];
        try {
          times = JSON.parse(med.frequency_details || '[]');
        } catch {
          times = ['08:00'];
        }

        times.forEach((time) => {
          const scheduledTimeStr = `${new Date().toISOString().split('T')[0]} ${time}`;
          const isLogged = todayLogs.find((l) => l.medication_id === med.id && l.scheduled_time === scheduledTimeStr);
          
          schedule.push({
            med,
            time,
            taken: isLogged?.status === 'TAKEN',
            skipped: isLogged?.status === 'SKIPPED',
          });
        });
      });

      schedule.sort((a, b) => a.time.localeCompare(b.time));
      setTodaySchedule(schedule);

      // 6. Calculate Dynamic Health Score
      let score = 50; // Base score
      if (vitals.length > 0) {
        const lastVitalDate = new Date(vitals[0].timestamp);
        const diffHrs = (new Date().getTime() - lastVitalDate.getTime()) / (1000 * 60 * 60);
        if (diffHrs <= 24) score += 20;
      }
      if (symptoms.length > 0) {
        const lastSymptomDate = new Date(symptoms[0].timestamp);
        const diffHrs = (new Date().getTime() - lastSymptomDate.getTime()) / (1000 * 60 * 60);
        if (diffHrs <= 24) score += 10;
      }
      if (rate >= 85) score += 20;
      else if (rate >= 65) score += 10;

      setHealthScore(Math.min(100, score));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogMedication = (medId: number, time: string, status: 'TAKEN' | 'SKIPPED') => {
    if (!user) return;
    const scheduledTime = `${new Date().toISOString().split('T')[0]} ${time}`;
    logMedicationDose(medId, scheduledTime, status);
    Alert.alert('Medication Logged', `Marked dose scheduled at ${time} as ${status.toLowerCase()}.`);
    loadDashboardData();
  };

  const handleSOS = async () => {
    if (!user) return;
    setSosLoading(true);
    try {
      const contact = getEmergencyContact(user.id);
      if (!contact) {
        Alert.alert(
          'Emergency Setup Required',
          'You must add an Emergency Contact in your Profile before using the SOS feature.',
          [{ text: 'Setup Contact', onPress: () => navigation.navigate('ProfileTab') }]
        );
        return;
      }

      const profile = getMedicalProfile(user.id);
      let conditions = 'None';
      let bloodGroup = 'Not specified';
      if (profile) {
        bloodGroup = profile.blood_group && profile.blood_group.trim() !== '' ? profile.blood_group : 'Not specified';
        try {
          const condArr = JSON.parse(profile.conditions || '[]');
          if (condArr.length > 0) conditions = condArr.join(', ');
        } catch {}
      }

      const location = await getCurrentLocation();
      const mapsUrl = location ? location.mapsUrl : 'GPS signal unavailable';

      const message = `I need medical assistance.\n\nName: ${user.name}\nBlood Group: ${bloodGroup}\nConditions: ${conditions}\n\nLocation:\n${mapsUrl}\n\nPlease contact me immediately.`;

      await Share.share({
        message,
        title: 'MediTrack Emergency SOS',
      });

    } catch (error) {
      console.error('SOS failed:', error);
      Alert.alert('SOS Trigger Failed', 'Could not access location or emergency services.');
    } finally {
      setSosLoading(false);
    }
  };

  const getBpStatus = (systolic: number | null, diastolic: number | null): { status: VitalStatus; badge: string } => {
    if (!systolic || !diastolic) return { status: 'normal', badge: 'Unknown' };
    if (systolic >= 140 || diastolic >= 90) return { status: 'critical', badge: 'High BP' };
    if (systolic >= 121 || diastolic >= 81) return { status: 'borderline', badge: 'Borderline' };
    return { status: 'normal', badge: 'Normal' };
  };

  const getSugarStatus = (fasting: number | null, post: number | null): { status: VitalStatus; badge: string } => {
    const val = fasting || post;
    if (!val) return { status: 'normal', badge: 'Unknown' };
    if (fasting && fasting >= 126) return { status: 'critical', badge: 'High Sugar' };
    if (fasting && fasting >= 100) return { status: 'borderline', badge: 'Pre-diabetic' };
    return { status: 'normal', badge: 'Normal' };
  };

  const getSpo2Status = (val: number | null): { status: VitalStatus; badge: string } => {
    if (!val) return { status: 'normal', badge: 'Unknown' };
    if (val < 90) return { status: 'critical', badge: 'Critical Low' };
    if (val <= 94) return { status: 'borderline', badge: 'Borderline' };
    return { status: 'normal', badge: 'Normal' };
  };

  const getHeartRateStatus = (val: number | null): { status: VitalStatus; badge: string } => {
    if (val === null) return { status: 'normal', badge: 'Unknown' };
    if (val < 40) return { status: 'critical', badge: 'CRITICAL LOW' };
    if (val >= 40 && val <= 59) return { status: 'borderline', badge: 'LOW' };
    if (val >= 60 && val <= 100) return { status: 'normal', badge: 'NORMAL' };
    if (val >= 101 && val <= 120) return { status: 'borderline', badge: 'HIGH' };
    return { status: 'critical', badge: 'CRITICAL HIGH' };
  };

  const getTempStatus = (val: number | null): { status: VitalStatus; badge: string } => {
    if (val === null) return { status: 'normal', badge: 'Unknown' };
    if (val < 35.0) return { status: 'low_temp', badge: 'LOW BODY TEMPERATURE' };
    if (val >= 35.0 && val <= 37.5) return { status: 'normal', badge: 'NORMAL' };
    if (val >= 37.6 && val <= 38.5) return { status: 'borderline', badge: 'FEVER' };
    return { status: 'critical', badge: 'HIGH FEVER' };
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const bpDetails = lastVital ? getBpStatus(lastVital.systolic, lastVital.diastolic) : null;
  const sugarDetails = lastVital ? getSugarStatus(lastVital.blood_sugar_fasting, lastVital.blood_sugar_post_meal) : null;
  const spo2Details = lastVital ? getSpo2Status(lastVital.spo2) : null;
  const hrDetails = lastVital ? getHeartRateStatus(lastVital.heart_rate) : null;
  const tempDetails = lastVital ? getTempStatus(lastVital.temperature) : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Welcome Bar incorporating Custom Page Header style */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <IconContainer size={44} backgroundColor="#2563EB">
            <HomeIcon color="#FFFFFF" size={22} />
          </IconContainer>
          <View style={styles.welcomeTextGroup}>
            <Text style={[styles.welcomeText, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>Hello,</Text>
            <Text style={[styles.nameText, { color: theme.text, fontSize: 20 * fontScale }]}>
              {user?.name.split(' ')[0]}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationsCenter')}
          style={[styles.notifBadge, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}
        >
          <Bell size={22} color={theme.text} />
          {notifications.filter((n) => !n.isRead).length > 0 && (
            <View style={[styles.badgeCount, { backgroundColor: theme.danger }]}>
              <Text style={styles.badgeText}>{notifications.filter((n) => !n.isRead).length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Health Score Summary Gauge with Gradient */}
      <LinearGradient
        colors={['#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.scoreHeroCard}
      >
        <View style={styles.scoreRow}>
          <View style={styles.scoreGauge}>
            <CircularProgress progress={healthScore} size={76} strokeWidth={6} />
          </View>
          <View style={styles.scoreDetails}>
            <Text style={styles.scoreHeadline}>Overall Health Status</Text>
            <Text style={styles.scoreDesc}>
              {healthScore >= 85
                ? 'Excellent log consistency and medication compliance!'
                : healthScore >= 65
                ? 'Good, but make sure to log your medications and vitals daily.'
                : 'Attention needed: Daily vitals or medication logging is incomplete.'}
            </Text>
            <View style={styles.adherenceBadge}>
              <Text style={styles.adherenceLabel}>Medication Adherence: {adherence.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Redesigned Quick Action Cards */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * fontScale }]}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <QuickActionCard
          onPress={() => navigation.navigate('VitalsTab')}
          title="Log Vitals"
          subtitle="Track your daily health metrics"
          icon={<HeartPulse size={28} color="#2563EB" />}
          fontScale={fontScale}
        />

        <QuickActionCard
          onPress={() => navigation.navigate('MedicinesTab')}
          title="Add Medicine"
          subtitle="Manage medication schedules"
          icon={<Pill size={28} color="#2563EB" />}
          fontScale={fontScale}
        />

        <QuickActionCard
          onPress={() => navigation.navigate('SymptomsTab')}
          title="Log Symptoms"
          subtitle="Record how you feel today"
          icon={<Activity size={28} color="#2563EB" />}
          fontScale={fontScale}
        />

        <QuickActionCard
          onPress={() => navigation.navigate('ReportsTab')}
          title="Reports"
          subtitle="Compile and share logs"
          icon={<FileText size={28} color="#2563EB" />}
          fontScale={fontScale}
        />
      </View>

      {/* EMERGENCY SOS BUTTON */}
      <TouchableOpacity
        onPress={handleSOS}
        disabled={sosLoading}
        style={[
          styles.sosButton,
          {
            backgroundColor: theme.danger,
            borderColor: contrastMode === 'high' ? '#FFFFFF' : theme.danger,
            borderWidth: contrastMode === 'high' ? 3 : 0,
          },
        ]}
      >
        {sosLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={styles.sosRow}>
            <ShieldAlert size={22} color="#FFFFFF" style={styles.sosIcon} />
            <Text style={[styles.sosButtonText, { fontSize: 18 * fontScale }]}>EMERGENCY SOS</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Today's Medicines Checklist */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 18 * fontScale }]}>Today's Medicines</Text>
      <Card style={styles.checklistCard}>
        {todaySchedule.length === 0 ? (
          <View style={styles.emptyChecklist}>
            <IconContainer size={40} backgroundColor={theme.primaryLight}>
              <Check color={theme.primary} size={20} />
            </IconContainer>
            <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, marginTop: 8 }}>
              No medications scheduled for today.
            </Text>
          </View>
        ) : (
          todaySchedule.map((item, index) => (
            <View
              key={index}
              style={[
                styles.checkItem,
                { borderBottomColor: theme.border, borderBottomWidth: index === todaySchedule.length - 1 ? 0 : 1 },
              ]}
            >
              <View style={styles.checkItemLeft}>
                <Text style={[styles.checkTime, { color: theme.primary, fontSize: 15 * fontScale }]}>{item.time}</Text>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.checkMedName, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {item.med.name}
                  </Text>
                  <Text style={[styles.checkMedDosage, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>
                    {item.med.dosage} {item.med.unit} - {item.med.instructions || 'No instructions'}
                  </Text>
                </View>
              </View>

              <View style={styles.checkItemRight}>
                {item.taken ? (
                  <View style={[styles.statusBadge, styles.statusTaken]}>
                    <Check size={14} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={styles.statusBadgeTextTaken}>Taken</Text>
                  </View>
                ) : item.skipped ? (
                  <View style={[styles.statusBadge, styles.statusSkipped]}>
                    <X size={14} color="#64748B" style={{ marginRight: 4 }} />
                    <Text style={styles.statusBadgeTextSkipped}>Skipped</Text>
                  </View>
                ) : (
                  <View style={styles.checkActionRow}>
                    <TouchableOpacity
                      onPress={() => handleLogMedication(item.med.id, item.time, 'TAKEN')}
                      style={[styles.actionBtnCheck, { backgroundColor: theme.success }]}
                    >
                      <Check size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleLogMedication(item.med.id, item.time, 'SKIPPED')}
                      style={[styles.actionBtnCheck, { backgroundColor: theme.border, marginLeft: 8 }]}
                    >
                      <X size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Today's Vitals Summary Card */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 18 * fontScale }]}>Latest Vitals Status</Text>
      <Card style={styles.vitalsSummaryCard}>
        {lastVital ? (
          <View>
            {lastVital.systolic && lastVital.diastolic && bpDetails && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Blood Pressure
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {lastVital.systolic}/{lastVital.diastolic} mmHg
                  </Text>
                </View>
                <VitalBadge status={bpDetails.status} label={bpDetails.badge} />
              </View>
            )}

            {(lastVital.blood_sugar_fasting || lastVital.blood_sugar_post_meal) && sugarDetails && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Blood Sugar
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {lastVital.blood_sugar_fasting
                      ? `Fasting: ${lastVital.blood_sugar_fasting}`
                      : `Post-Meal: ${lastVital.blood_sugar_post_meal}`}{' '}
                    mg/dL
                  </Text>
                </View>
                <VitalBadge status={sugarDetails.status} label={sugarDetails.badge} />
              </View>
            )}

            {lastVital.spo2 && spo2Details && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Oxygen Saturation (SpO2)
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {lastVital.spo2}%
                  </Text>
                </View>
                <VitalBadge status={spo2Details.status} label={spo2Details.badge} />
              </View>
            )}

            {lastVital.heart_rate && hrDetails && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Heart Rate
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {lastVital.heart_rate} BPM
                  </Text>
                </View>
                <VitalBadge status={hrDetails.status} label={hrDetails.badge} />
              </View>
            )}

            {lastVital.temperature && tempDetails && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Body Temperature
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {lastVital.temperature}°C
                  </Text>
                </View>
                <VitalBadge status={tempDetails.status} label={tempDetails.badge} />
              </View>
            )}

            {lastVital.weight && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Current Weight
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {lastVital.weight} kg
                  </Text>
                </View>
                <View style={[styles.statusBadge, styles.statusLogged]}>
                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: 'bold' }}>Logged</Text>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={() => navigation.navigate('VitalsTab')} style={styles.viewMoreVitals}>
              <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 14 * fontScale }}>
                View Full Vitals Logs History
              </Text>
              <ChevronRight size={16} color={theme.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, textAlign: 'center' }}>
              No vitals logged yet today.
            </Text>
            <Button
              title="Log Vitals Now"
              onPress={() => navigation.navigate('VitalsTab')}
              variant="primary"
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </Card>

      {/* Symptom status */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 18 * fontScale }]}>Last Logged Symptom</Text>
      <Card style={styles.symptomSummaryCard}>
        {lastSymptom ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[styles.checkMedName, { color: theme.text, fontSize: 16 * fontScale }]}>
                {lastSymptom.name}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 * fontScale, marginTop: 2 }}>
                Logged at: {new Date(lastSymptom.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
              {lastSymptom.notes && (
                <Text style={{ color: theme.textSecondary, fontSize: 13 * fontScale, fontStyle: 'italic', marginTop: 4 }}>
                  "{lastSymptom.notes}"
                </Text>
              )}
            </View>
            <VitalBadge
              status={lastSymptom.severity >= 7 ? 'critical' : lastSymptom.severity >= 4 ? 'borderline' : 'normal'}
              label={`Severity: ${lastSymptom.severity}/10`}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, textAlign: 'center' }}>
              No symptoms logged recently.
            </Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeTextGroup: {
    marginLeft: 16,
  },
  welcomeText: {
    fontWeight: '500',
  },
  nameText: {
    fontWeight: 'bold',
    marginTop: 2,
  },
  notifBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  scoreHeroCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreGauge: {
    width: 76,
    height: 76,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreDetails: {
    flex: 1,
    marginLeft: 16,
  },
  scoreHeadline: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scoreDesc: {
    color: '#E0F2FE',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  adherenceBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  adherenceLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCellWrapper: {
    width: '48%',
    marginVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  gridCellGradient: {
    borderRadius: 16,
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridCellTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  gridCellSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  sosButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  sosRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sosIcon: {
    marginRight: 8,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  checklistCard: {
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyChecklist: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  checkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  checkItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkTime: {
    fontWeight: '800',
    minWidth: 42,
  },
  checkMedName: {
    fontWeight: 'bold',
  },
  checkMedDosage: {
    marginTop: 2,
  },
  checkItemRight: {
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTaken: {
    backgroundColor: '#D1FAE5',
  },
  statusSkipped: {
    backgroundColor: '#F1F5F9',
  },
  statusLogged: {
    backgroundColor: '#DBEAFE',
  },
  statusBadgeTextTaken: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusBadgeTextSkipped: {
    color: '#64748B',
    fontWeight: 'bold',
    fontSize: 12,
  },
  checkActionRow: {
    flexDirection: 'row',
  },
  actionBtnCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalsSummaryCard: {
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  vitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 12,
  },
  vitalLabel: {
    fontWeight: '600',
  },
  vitalValue: {
    fontWeight: 'bold',
    marginTop: 2,
  },
  viewMoreVitals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  symptomSummaryCard: {
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    padding: 16,
  },
});
