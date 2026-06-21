import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
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
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDay = days[new Date().getDay()];

      meds.forEach((med) => {
        // Parse scheduled times
        let times: string[] = [];
        try {
          times = JSON.parse(med.frequency_details || '[]');
        } catch {
          times = ['08:00'];
        }

        // For simple demo, generate today's doses for all once/twice daily meds
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

      // Sort schedule chronologically
      schedule.sort((a, b) => a.time.localeCompare(b.time));
      setTodaySchedule(schedule);

      // 6. Calculate Dynamic Health Score
      let score = 50; // Base score
      if (vitals.length > 0) {
        // Vitals logged in past 24 hours
        const lastVitalDate = new Date(vitals[0].timestamp);
        const diffHrs = (new Date().getTime() - lastVitalDate.getTime()) / (1000 * 60 * 60);
        if (diffHrs <= 24) score += 20;
      }
      if (symptoms.length > 0) {
        // Symptom diary checked recently
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
    loadDashboardData(); // Refresh UI
  };

  // SOS Emergency Trigger
  const handleSOS = async () => {
    if (!user) return;
    setSosLoading(true);
    try {
      // 1. Get emergency contact
      const contact = getEmergencyContact(user.id);
      if (!contact) {
        Alert.alert(
          'Emergency Setup Required',
          'You must add an Emergency Contact in your Profile before using the SOS feature.',
          [{ text: 'Setup Contact', onPress: () => navigation.navigate('ProfileTab') }]
        );
        return;
      }

      // 2. Fetch Medical Profile Info
      const profile = getMedicalProfile(user.id);
      let conditions = 'None';
      let bloodGroup = 'Unknown';
      if (profile) {
        bloodGroup = profile.blood_group || 'Unknown';
        try {
          const condArr = JSON.parse(profile.conditions || '[]');
          if (condArr.length > 0) conditions = condArr.join(', ');
        } catch {}
      }

      // 3. Fetch GPS location
      const location = await getCurrentLocation();
      const mapsUrl = location ? location.mapsUrl : 'GPS signal unavailable';

      // 4. Formulate SOS SMS pre-fill content
      const message = `I need medical assistance.

Name: ${user.name}
Blood Group: ${bloodGroup}
Conditions: ${conditions}

Location:
${mapsUrl}

Please contact me immediately.`;

      // 5. Open Share Dialog preloaded with message
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

  // Vitals Status color logic helpers
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

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Calculate vital color badges
  const bpDetails = lastVital ? getBpStatus(lastVital.systolic, lastVital.diastolic) : null;
  const sugarDetails = lastVital ? getSugarStatus(lastVital.blood_sugar_fasting, lastVital.blood_sugar_post_meal) : null;
  const spo2Details = lastVital ? getSpo2Status(lastVital.spo2) : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
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
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {notifications.filter((n) => !n.isRead).length > 0 && (
            <View style={[styles.badgeCount, { backgroundColor: theme.danger }]}>
              <Text style={styles.badgeText}>{notifications.filter((n) => !n.isRead).length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Health Score Summary Gauge */}
      <Card style={[styles.scoreHeroCard, { backgroundColor: theme.primary }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreGauge}>
            <Text style={styles.scoreText}>{healthScore}</Text>
            <Text style={styles.scoreSub}>Score</Text>
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
              <Text style={styles.adherenceLabel}>Adherence: {adherence.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Quick Action Grid */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * fontScale }]}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          onPress={() => navigation.navigate('VitalsTab')}
          style={[styles.gridCell, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={styles.gridEmoji}>🩸</Text>
          <Text style={[styles.gridLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Log Vitals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('MedicinesTab')}
          style={[styles.gridCell, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={styles.gridEmoji}>💊</Text>
          <Text style={[styles.gridLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Add Medicine</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('SymptomsTab')}
          style={[styles.gridCell, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={styles.gridEmoji}>🤒</Text>
          <Text style={[styles.gridLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Log Symptom</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('ReportsTab')}
          style={[styles.gridCell, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={styles.gridEmoji}>📄</Text>
          <Text style={[styles.gridLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Reports</Text>
        </TouchableOpacity>
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
          <Text style={[styles.sosButtonText, { fontSize: 20 * fontScale }]}>🚨 EMERGENCY SOS</Text>
        )}
      </TouchableOpacity>

      {/* Today's Medicines Checklist */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * fontScale }]}>Today's Medicines</Text>
      <Card style={styles.checklistCard}>
        {todaySchedule.length === 0 ? (
          <View style={styles.emptyChecklist}>
            <Text style={{ fontSize: 32 }}>🎉</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 15 * fontScale, marginTop: 4 }}>
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
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.checkMedName, { color: theme.text, fontSize: 16 * fontScale }]}>
                    {item.med.name}
                  </Text>
                  <Text style={[styles.checkMedDosage, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    {item.med.dosage} {item.med.unit} - {item.med.instructions || 'No instructions'}
                  </Text>
                </View>
              </View>

              <View style={styles.checkItemRight}>
                {item.taken ? (
                  <View style={[styles.statusBadge, { backgroundColor: theme.successLight }]}>
                    <Text style={{ color: theme.success, fontWeight: 'bold' }}>Taken</Text>
                  </View>
                ) : item.skipped ? (
                  <View style={[styles.statusBadge, { backgroundColor: theme.border }]}>
                    <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>Skipped</Text>
                  </View>
                ) : (
                  <View style={styles.checkActionRow}>
                    <TouchableOpacity
                      onPress={() => handleLogMedication(item.med.id, item.time, 'TAKEN')}
                      style={[styles.actionBtnCheck, { backgroundColor: theme.success }]}
                    >
                      <Text style={styles.actionBtnText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleLogMedication(item.med.id, item.time, 'SKIPPED')}
                      style={[styles.actionBtnCheck, { backgroundColor: theme.border, marginLeft: 8 }]}
                    >
                      <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>✗</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Today's Vitals Summary Card */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * fontScale }]}>Latest Vitals Status</Text>
      <Card style={styles.vitalsSummaryCard}>
        {lastVital ? (
          <View>
            {lastVital.systolic && lastVital.diastolic && bpDetails && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Blood Pressure
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 17 * fontScale }]}>
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
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 17 * fontScale }]}>
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
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 17 * fontScale }]}>
                    {lastVital.spo2}%
                  </Text>
                </View>
                <VitalBadge status={spo2Details.status} label={spo2Details.badge} />
              </View>
            )}

            {lastVital.weight && (
              <View style={styles.vitalRow}>
                <View>
                  <Text style={[styles.vitalLabel, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    Current Weight
                  </Text>
                  <Text style={[styles.vitalValue, { color: theme.text, fontSize: 17 * fontScale }]}>
                    {lastVital.weight} kg
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: theme.primaryLight }]}>
                  <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Logged</Text>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={() => navigation.navigate('VitalsTab')} style={{ marginTop: 8, alignSelf: 'center' }}>
              <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 15 * fontScale }}>
                View Full Vitals Logs History →
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 15 * fontScale, textAlign: 'center' }}>
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
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 16 * fontScale }]}>Last Logged Symptom</Text>
      <Card style={{ marginBottom: 32 }}>
        {lastSymptom ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.checkMedName, { color: theme.text, fontSize: 16 * fontScale }]}>
                {lastSymptom.name}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, marginTop: 2 }}>
                Logged at: {new Date(lastSymptom.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </Text>
              {lastSymptom.notes && (
                <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, fontStyle: 'italic', marginTop: 4 }}>
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
            <Text style={{ color: theme.textSecondary, fontSize: 15 * fontScale, textAlign: 'center' }}>
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
    marginBottom: 16,
  },
  welcomeText: {
    fontWeight: '500',
  },
  nameText: {
    fontWeight: '900',
    marginTop: 2,
  },
  notifBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderColor: '#E2E8F0',
    borderWidth: 1,
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
    padding: 20,
    borderRadius: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreGauge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  scoreText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  scoreSub: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
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
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCell: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  gridEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  gridLabel: {
    fontWeight: '700',
  },
  sosButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  checklistCard: {
    padding: 8,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  vitalsSummaryCard: {
    paddingVertical: 8,
  },
  vitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  vitalLabel: {
    fontWeight: '600',
  },
  vitalValue: {
    fontWeight: 'bold',
    marginTop: 2,
  },
});
