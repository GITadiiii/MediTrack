import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { BackgroundGrid } from '../../components/BackgroundGrid';
import {
  Bell,
  HeartPulse,
  Pill,
  Thermometer,
  FileText,
  PhoneCall,
  Check,
  X,
  ChevronRight,
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



interface DashboardScreenProps {
  navigation: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const { themeMode, contrastMode, fontSizeScale, user, notifications, setIsLocked } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);
  const insets = useSafeAreaInsets();

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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <BackgroundGrid />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { backgroundColor: 'transparent', paddingTop: Math.max(insets.top + 16, Platform.OS === 'ios' ? 64 : 40) }]}
      >
        {/* Top Welcome Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={[styles.welcomeText, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>Hello,</Text>
            <Text style={[styles.nameText, { color: theme.text, fontSize: 22 * fontScale }]}>
              {user?.name.split(' ')[0]}
            </Text>
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

      {/* Health Score Summary Gauge */}
      <ExpoLinearGradient
        colors={
          themeMode === 'dark'
            ? ['#3B82F6', '#1E3A8A']
            : ['#60A5FA', '#3B82F6', '#2563EB']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.scoreHeroCard,
          {
            borderColor: contrastMode === 'high' ? '#FFFFFF' : theme.primary,
            borderWidth: contrastMode === 'high' ? 3 : 0,
          },
        ]}
      >
        <View style={[styles.scoreRow, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.scoreHeadline}>Daily Score</Text>
            <Text style={styles.scoreDesc}>
              {healthScore >= 85
                ? 'Excellent consistency!'
                : healthScore >= 65
                ? 'Good – keep logging your vitals daily.'
                : 'Attention needed: logging is incomplete.'}
            </Text>
            <View style={styles.adherenceBadge}>
              <Text style={styles.adherenceLabel}>Adherence: {adherence.toFixed(0)}%</Text>
            </View>
          </View>
          <CircularProgress
            size={76}
            strokeWidth={8}
            progress={healthScore}
            color="#FFFFFF"
            backgroundColor="rgba(255, 255, 255, 0.25)"
            textColor="#FFFFFF"
          />
        </View>
      </ExpoLinearGradient>

      {/* Quick Action Grid */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * fontScale, marginTop: 24 }]}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('VitalsTab')}
          style={[styles.squircleCell, { backgroundColor: theme.card }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <HeartPulse color="#3B82F6" size={20} />
          </View>
          <View style={styles.cellTextContainer}>
            <Text style={[styles.cellHeadline, { color: theme.text, fontSize: 18 * fontScale }]}>Vitals</Text>
            <Text style={[styles.cellSubtext, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>Log your stats</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('MedicinesTab')}
          style={[styles.squircleCell, { backgroundColor: theme.card }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
            <Pill color="#A855F7" size={20} />
          </View>
          <View style={styles.cellTextContainer}>
            <Text style={[styles.cellHeadline, { color: theme.text, fontSize: 18 * fontScale }]}>Medicine</Text>
            <Text style={[styles.cellSubtext, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>Track doses</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SymptomsTab')}
          style={[styles.squircleCell, { backgroundColor: theme.card }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <Thermometer color="#22C55E" size={20} />
          </View>
          <View style={styles.cellTextContainer}>
            <Text style={[styles.cellHeadline, { color: theme.text, fontSize: 18 * fontScale }]}>Symptoms</Text>
            <Text style={[styles.cellSubtext, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>How are you?</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ReportsTab')}
          style={[styles.squircleCell, { backgroundColor: theme.card }]}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.15)' }]}>
            <FileText color="#F97316" size={20} />
          </View>
          <View style={styles.cellTextContainer}>
            <Text style={[styles.cellHeadline, { color: theme.text, fontSize: 18 * fontScale }]}>Reports</Text>
            <Text style={[styles.cellSubtext, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>View history</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* EMERGENCY SOS BUTTON */}
      <View style={{ marginTop: 4, width: '100%', borderRadius: 28, backgroundColor: 'transparent', shadowColor: theme.danger, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSOS}
          disabled={sosLoading}
          style={{ width: '100%', borderRadius: 28, overflow: 'hidden' }}
        >
          <ExpoLinearGradient
            colors={
              themeMode === 'dark'
                ? ['#F87171', '#991B1B']
                : ['#FF4D4D', '#CC0000']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sosButton, { marginTop: 0, shadowColor: 'transparent', elevation: 0 }]}
          >
            {sosLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', padding: 6, borderRadius: 20, marginRight: 12 }}>
                  <PhoneCall color="#FFFFFF" size={20} strokeWidth={2.5} />
                </View>
                <Text style={[styles.sosButtonText, { fontSize: 18 * fontScale, letterSpacing: 1 }]}>EMERGENCY SOS</Text>
              </View>
            )}
          </ExpoLinearGradient>
        </TouchableOpacity>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120,
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
    marginTop: 0,
    marginBottom: 24,
  },
  welcomeText: {
    fontWeight: '500',
  },
  nameText: {
    fontWeight: '900',
    marginTop: 2,
  },
  notifBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  badgeCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scoreHeroCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreHeadline: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 20,
    marginBottom: 4,
  },
  scoreDesc: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  adherenceBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  adherenceLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  squircleCell: {
    width: '48%',
    aspectRatio: 1.6,
    borderRadius: 24,
    padding: 12,
    marginVertical: 4,
    justifyContent: 'space-between',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  cellTextContainer: {
    justifyContent: 'flex-end',
  },
  cellHeadline: {
    fontWeight: '900',
    marginBottom: 2,
  },
  cellSubtext: {
    fontWeight: '600',
  },
  sosButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
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
