import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import {
  getMedicalProfile,
  getEmergencyContact,
  getMedications,
  getVitalsRange,
  getSymptomsHistory,
  getDoctorVisits,
  getAdherenceStats,
  VitalDB,
  SymptomDB,
} from '../../database/dbHelpers';
import { generateAndShareReport, ReportData } from '../../services/pdfService';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export const ReportsScreen: React.FC = () => {
  const { themeMode, contrastMode, fontSizeScale, user } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');
  const [exporting, setExporting] = useState(false);

  const handleExportReport = async () => {
    if (!user) return;
    setExporting(true);

    try {
      const days = parseInt(dateRange, 10);
      const dateRangeLabel = days === 7 ? 'Last 7 Days (Weekly)' : days === 30 ? 'Last 30 Days (Monthly)' : 'Last 90 Days (Quarterly)';

      // 1. Fetch Patient Info & Medical Profile
      const mProfile = getMedicalProfile(user.id);
      if (!mProfile) {
        Alert.alert('Incomplete Profile', 'Your medical profile has not been created yet.');
        setExporting(false);
        return;
      }

      // Parse JSON fields
      let conditions: string[] = [];
      let allergies: string[] = [];
      let currentMeds: string[] = [];
      try { conditions = JSON.parse(mProfile.conditions || '[]'); } catch {}
      try { allergies = JSON.parse(mProfile.allergies || '[]'); } catch {}
      try { currentMeds = JSON.parse(mProfile.medications || '[]'); } catch {}

      // 2. Fetch Emergency Contact
      const eContact = getEmergencyContact(user.id);
      const emergencyContact = eContact ? { name: eContact.name, relation: eContact.relation, phone: eContact.phone } : null;

      // 3. Fetch Medications list
      const meds = getMedications(user.id);
      const medicationList = meds.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        unit: m.unit,
        instructions: m.instructions || 'None',
        frequencyType: m.frequency_type,
        stock: m.stock_remaining,
      }));

      // 4. Fetch Adherence Rate
      const stats = getAdherenceStats(user.id, days);
      const adherencePercentage = stats.total > 0 ? (stats.taken / stats.total) * 100 : 100;

      // 5. Fetch Vitals logs
      const vitalsLogs = getVitalsRange(user.id, days);

      // 6. Fetch Symptom logs
      const allSymptoms = getSymptomsHistory(user.id, 100);
      const symptomLogs = allSymptoms.filter((s) => {
        const logDate = new Date(s.timestamp);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return logDate >= cutoff;
      });

      // 7. Fetch Doctor Visits
      const allVisits = getDoctorVisits(user.id);
      const doctorVisits = allVisits.filter((v) => {
        const vDate = new Date(v.visit_date);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return vDate >= cutoff;
      });

      // Assemble full report dataset
      const reportData: ReportData = {
        patientName: user.name,
        age: mProfile.age,
        gender: mProfile.gender,
        bloodGroup: mProfile.blood_group,
        dob: mProfile.dob,
        height: mProfile.height,
        weight: mProfile.weight,
        conditions,
        allergies,
        medications: currentMeds,
        emergencyContact,
        adherencePercentage,
        medicationList,
        vitalsLogs: vitalsLogs.map((v) => ({
          systolic: v.systolic || undefined,
          diastolic: v.diastolic || undefined,
          blood_sugar_fasting: v.blood_sugar_fasting || undefined,
          blood_sugar_post_meal: v.blood_sugar_post_meal || undefined,
          temperature: v.temperature || undefined,
          weight: v.weight || undefined,
          spo2: v.spo2 || undefined,
          heart_rate: v.heart_rate || undefined,
          timestamp: v.timestamp,
        })),
        symptomLogs: symptomLogs.map((s) => ({
          name: s.name,
          severity: s.severity,
          notes: s.notes || undefined,
          timestamp: s.timestamp,
        })),
        doctorVisits: doctorVisits.map((v) => ({
          visit_date: v.visit_date,
          doctor_name: v.doctor_name,
          specialization: v.specialization,
          notes: v.notes || undefined,
          prescription_summary: v.prescription_summary || undefined,
        })),
      };

      // Generate PDF & trigger sharing
      const success = await generateAndShareReport(reportData, dateRangeLabel);
      if (success) {
        Alert.alert('Report Shared', 'Your health summary PDF report was generated and exported successfully.');
      } else {
        Alert.alert('Export Failed', 'Unable to open PDF share dialog.');
      }

    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'An error occurred during report preparation.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text, fontSize: 22 * fontScale }]}>Clinical PDF Reports</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>
        Compile and export structured clinical records to share with your physicians and specialists.
      </Text>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.text, fontSize: 16 * fontScale }]}>Select Reporting Date Window</Text>
        
        <View style={styles.selectorRow}>
          <TouchableOpacity
            onPress={() => setDateRange('7')}
            style={[
              styles.selectorBtn,
              {
                backgroundColor: dateRange === '7' ? theme.primary : theme.card,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.selectorBtnText, { color: dateRange === '7' ? '#FFFFFF' : theme.text, fontSize: 14 * fontScale }]}>
              Weekly (7d)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDateRange('30')}
            style={[
              styles.selectorBtn,
              {
                backgroundColor: dateRange === '30' ? theme.primary : theme.card,
                borderColor: theme.border,
                borderWidth: 1,
                marginLeft: 8,
              },
            ]}
          >
            <Text style={[styles.selectorBtnText, { color: dateRange === '30' ? '#FFFFFF' : theme.text, fontSize: 14 * fontScale }]}>
              Monthly (30d)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDateRange('90')}
            style={[
              styles.selectorBtn,
              {
                backgroundColor: dateRange === '90' ? theme.primary : theme.card,
                borderColor: theme.border,
                borderWidth: 1,
                marginLeft: 8,
              },
            ]}
          >
            <Text style={[styles.selectorBtnText, { color: dateRange === '90' ? '#FFFFFF' : theme.text, fontSize: 14 * fontScale }]}>
              Quarterly (90d)
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Information recap block */}
      <Card style={styles.infoCard}>
        <Text style={[styles.infoTitle, { color: theme.text, fontSize: 15 * fontScale }]}>📋 Included In Your PDF Report:</Text>
        
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.bulletLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Patient demographics, vital statistics, conditions, and allergies.</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.bulletLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Medication compliance rate and active daily schedules.</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.bulletLabel, { color: theme.text, fontSize: 14 * fontScale }]}>History log records for blood pressure, sugar, SpO2, and weight.</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.bulletLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Timeline of experienced symptoms and severity charts.</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={[styles.bulletLabel, { color: theme.text, fontSize: 14 * fontScale }]}>Consultation summaries and special clinic/hospital tags.</Text>
        </View>
      </Card>

      {/* Export Action */}
      <View style={styles.actionBlock}>
        {exporting ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loaderText, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>
              Compiling clinical logs. Please wait...
            </Text>
          </View>
        ) : (
          <Button title="📄 Compile & Export PDF Report" onPress={handleExportReport} variant="primary" style={styles.exportBtn} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    marginTop: 8,
  },
  subtitle: {
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 22,
    marginBottom: 16,
  },
  card: {
    padding: 14,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  selectorRow: {
    flexDirection: 'row',
  },
  selectorBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorBtnText: {
    fontWeight: 'bold',
  },
  infoCard: {
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    lineHeight: 18,
  },
  bulletLabel: {
    flex: 1,
    lineHeight: 20,
  },
  actionBlock: {
    marginTop: 32,
    marginBottom: 40,
    alignItems: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    padding: 16,
  },
  loaderText: {
    fontWeight: '600',
    marginTop: 12,
  },
  exportBtn: {
    width: '100%',
    height: 52,
  },
});
