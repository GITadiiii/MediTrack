import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Alert, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { HeartPulse, Calendar, Plus, Activity, Thermometer, Wind, Droplet, Scale, Pencil, Trash2 } from 'lucide-react-native';

import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import { getVitalsHistory, addVitalLog, updateVitalLog, deleteVitalLog, VitalDB } from '../../database/dbHelpers';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { VitalBadge, VitalStatus } from '../../components/VitalBadge';
import { PageHeader } from '../../components/PageHeader';
import { IconContainer } from '../../components/IconContainer';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};
import {
  evaluateBloodPressure,
  evaluateBloodSugar,
  evaluateSpO2,
  evaluateTemperature,
  evaluateHeartRate,
} from '../../utils/calculations';

export const VitalsScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const { themeMode, contrastMode, fontSizeScale, user } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const [loading, setLoading] = useState(true);
  const [vitalsList, setVitalsList] = useState<VitalDB[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVital, setEditingVital] = useState<VitalDB | null>(null);

  // Form inputs state
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [sugarFasting, setSugarFasting] = useState('');
  const [sugarPostMeal, setSugarPostMeal] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const [spo2, setSpo2] = useState('');
  const [heartRate, setHeartRate] = useState('');

  useEffect(() => {
    if (isFocused && user) {
      loadVitals();
    }
  }, [isFocused, user]);

  const loadVitals = () => {
    if (!user) return;
    setLoading(true);
    try {
      const history = getVitalsHistory(user.id, 50);
      setVitalsList(history);
    } catch (error) {
      console.error('Error loading vitals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingVital(null);
    setSystolic('');
    setDiastolic('');
    setSugarFasting('');
    setSugarPostMeal('');
    setTemperature('');
    setWeight('');
    setSpo2('');
    setHeartRate('');
    setModalVisible(true);
  };

  const handleOpenEdit = (vital: VitalDB) => {
    setEditingVital(vital);
    setSystolic(vital.systolic !== null ? vital.systolic.toString() : '');
    setDiastolic(vital.diastolic !== null ? vital.diastolic.toString() : '');
    setSugarFasting(vital.blood_sugar_fasting !== null ? vital.blood_sugar_fasting.toString() : '');
    setSugarPostMeal(vital.blood_sugar_post_meal !== null ? vital.blood_sugar_post_meal.toString() : '');
    setTemperature(vital.temperature !== null ? vital.temperature.toString() : '');
    setWeight(vital.weight !== null ? vital.weight.toString() : '');
    setSpo2(vital.spo2 !== null ? vital.spo2.toString() : '');
    setHeartRate(vital.heart_rate !== null ? vital.heart_rate.toString() : '');
    setModalVisible(true);
  };

  const handleDeleteVital = (vitalId: number) => {
    const executeDelete = () => {
      try {
        deleteVitalLog(vitalId);
        showAlert('Success', 'Vital log deleted successfully.');
        loadVitals();
      } catch (error) {
        console.error('Delete vital log error:', error);
        showAlert('Error', 'Unable to delete vital log.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete Vital Log?\n\nThis action cannot be undone.')) {
        executeDelete();
      }
      return;
    }

    Alert.alert('Delete Vital Log?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: executeDelete },
    ]);
  };

  const handleSaveVitals = () => {
    if (!user) return;

    if (
      !systolic &&
      !diastolic &&
      !sugarFasting &&
      !sugarPostMeal &&
      !temperature &&
      !weight &&
      !spo2 &&
      !heartRate
    ) {
      showAlert('Empty Form', 'Please enter at least one vital parameter value to save a log.');
      return;
    }

    const pSystolic = systolic ? parseFloat(systolic) : null;
    const pDiastolic = diastolic ? parseFloat(diastolic) : null;
    const pSugarFasting = sugarFasting ? parseFloat(sugarFasting) : null;
    const pSugarPostMeal = sugarPostMeal ? parseFloat(sugarPostMeal) : null;
    const pTemp = temperature ? parseFloat(temperature) : null;
    const pWeight = weight ? parseFloat(weight) : null;
    const pSpo2 = spo2 ? parseFloat(spo2) : null;
    const pBpm = heartRate ? parseFloat(heartRate) : null;

    try {
      if (editingVital) {
        updateVitalLog({
          id: editingVital.id,
          user_id: user.id,
          systolic: pSystolic,
          diastolic: pDiastolic,
          blood_sugar_fasting: pSugarFasting,
          blood_sugar_post_meal: pSugarPostMeal,
          temperature: pTemp,
          weight: pWeight,
          spo2: pSpo2,
          heart_rate: pBpm,
          timestamp: editingVital.timestamp,
        });
        showAlert('Saved', 'Your vitals have been updated successfully.');
      } else {
        addVitalLog({
          user_id: user.id,
          systolic: pSystolic,
          diastolic: pDiastolic,
          blood_sugar_fasting: pSugarFasting,
          blood_sugar_post_meal: pSugarPostMeal,
          temperature: pTemp,
          weight: pWeight,
          spo2: pSpo2,
          heart_rate: pBpm,
        });
        showAlert('Saved', 'Your vitals have been logged successfully.');
      }

      setModalVisible(false);
      
      setSystolic('');
      setDiastolic('');
      setSugarFasting('');
      setSugarPostMeal('');
      setTemperature('');
      setWeight('');
      setSpo2('');
      setHeartRate('');
      setEditingVital(null);
      
      loadVitals();
    } catch (error) {
      console.error('Vitals save error:', error);
      showAlert('Error', 'Unable to save vitals log. Please verify all required fields.');
    }
  };

  const getBpStatus = (sys: number | null, dia: number | null): { status: VitalStatus; text: string } | null => {
    if (sys === null || dia === null) return null;
    return evaluateBloodPressure(sys, dia);
  };

  const getSugarStatus = (fasting: number | null): { status: VitalStatus; text: string } | null => {
    if (fasting === null) return null;
    return evaluateBloodSugar(fasting);
  };

  const getSpo2Status = (val: number | null): { status: VitalStatus; text: string } | null => {
    if (val === null) return null;
    return evaluateSpO2(val);
  };

  const getTempStatus = (val: number | null): { status: VitalStatus; text: string } | null => {
    if (val === null) return null;
    return evaluateTemperature(val);
  };

  const getHeartRateStatus = (val: number | null): { status: VitalStatus; text: string } | null => {
    if (val === null) return null;
    return evaluateHeartRate(val);
  };

  const formatDateTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Title Header with Add Button in one row */}
      <PageHeader title="Vitals Log" icon={<HeartPulse color="#FFFFFF" size={20} />} />

      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={handleOpenAdd}
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Log Vitals</Text>
        </TouchableOpacity>
      </View>

      {/* History scroll list */}
      <ScrollView contentContainerStyle={styles.scrollList}>
        {vitalsList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <HeartPulse size={44} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 15 * fontScale, marginTop: 12, textAlign: 'center' }}>
              No vitals logged yet. Tap the button above to log your first record.
            </Text>
          </View>
        ) : (
          vitalsList.map((item) => {
            const bp = getBpStatus(item.systolic, item.diastolic);
            const sugarVal = item.blood_sugar_fasting || item.blood_sugar_post_meal;
            const sugar = getSugarStatus(sugarVal);
            const oxygen = getSpo2Status(item.spo2);
            const temp = getTempStatus(item.temperature);
            const hr = getHeartRateStatus(item.heart_rate);

            return (
              <Card key={item.id} style={styles.vitalCard}>
                {/* Date Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                    <Text style={[styles.cardTime, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                      {formatDateTime(item.timestamp)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleOpenEdit(item)} style={{ padding: 4, marginRight: 12 }} accessibilityLabel="Edit vitals log">
                      <Pencil size={16} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteVital(item.id)} style={{ padding: 4 }} accessibilityLabel="Delete vitals log">
                      <Trash2 size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Grid layout for parameters */}
                <View style={styles.paramGrid}>
                  {/* BP */}
                  {item.systolic !== null && item.diastolic !== null && bp && (
                    <View style={[styles.paramBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}>
                      <View style={styles.paramHeader}>
                        <Activity size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.paramName, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>BP</Text>
                      </View>
                      <Text style={[styles.paramVal, { color: theme.text, fontSize: 16 * fontScale }]}>
                        {item.systolic}/{item.diastolic} <Text style={{ fontSize: 10 }}>mmHg</Text>
                      </Text>
                      <VitalBadge status={bp.status} label={bp.text} />
                    </View>
                  )}

                  {/* Sugar */}
                  {sugarVal !== null && sugar && (
                    <View style={[styles.paramBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}>
                      <View style={styles.paramHeader}>
                        <Droplet size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.paramName, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>Sugar</Text>
                      </View>
                      <Text style={[styles.paramVal, { color: theme.text, fontSize: 14 * fontScale, marginVertical: 4 }]}>
                        {item.blood_sugar_fasting ? `Fasting: ${item.blood_sugar_fasting}` : ''}
                        {item.blood_sugar_fasting && item.blood_sugar_post_meal ? '\n' : ''}
                        {item.blood_sugar_post_meal ? `Post: ${item.blood_sugar_post_meal}` : ''}
                        <Text style={{ fontSize: 10 }}> mg/dL</Text>
                      </Text>
                      <VitalBadge status={sugar.status} label={sugar.text} />
                    </View>
                  )}

                  {/* SpO2 */}
                  {item.spo2 !== null && oxygen && (
                    <View style={[styles.paramBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}>
                      <View style={styles.paramHeader}>
                        <Wind size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.paramName, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>SpO2</Text>
                      </View>
                      <Text style={[styles.paramVal, { color: theme.text, fontSize: 16 * fontScale }]}>
                        {item.spo2}%
                      </Text>
                      <VitalBadge status={oxygen.status} label={oxygen.text} />
                    </View>
                  )}

                  {/* Temp */}
                  {item.temperature !== null && temp && (
                    <View style={[styles.paramBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}>
                      <View style={styles.paramHeader}>
                        <Thermometer size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.paramName, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>Temp</Text>
                      </View>
                      <Text style={[styles.paramVal, { color: theme.text, fontSize: 16 * fontScale }]}>
                        {item.temperature}°C
                      </Text>
                      <VitalBadge status={temp.status} label={temp.text} />
                    </View>
                  )}

                  {/* HR */}
                  {item.heart_rate !== null && hr && (
                    <View style={[styles.paramBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}>
                      <View style={styles.paramHeader}>
                        <HeartPulse size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.paramName, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>HR</Text>
                      </View>
                      <Text style={[styles.paramVal, { color: theme.text, fontSize: 16 * fontScale }]}>
                        {item.heart_rate} <Text style={{ fontSize: 10 }}>BPM</Text>
                      </Text>
                      <VitalBadge status={hr.status} label={hr.text} />
                    </View>
                  )}

                  {/* Weight */}
                  {item.weight !== null && (
                    <View style={[styles.paramBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 1 }]}>
                      <View style={styles.paramHeader}>
                        <Scale size={16} color={theme.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.paramName, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>Weight</Text>
                      </View>
                      <Text style={[styles.paramVal, { color: theme.text, fontSize: 16 * fontScale }]}>
                        {item.weight} <Text style={{ fontSize: 10 }}>kg</Text>
                      </Text>
                      <VitalBadge status="normal" label="Logged" />
                    </View>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Logging Modal Form */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 0 }]}>
            <Text style={[styles.modalTitle, { color: theme.text, fontSize: 20 * fontScale }]}>
              {editingVital ? 'Edit Vitals Log' : "Log Today's Vitals"}
            </Text>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formRow}>
                <Input
                  label="Systolic BP (mmHg)"
                  value={systolic}
                  onChangeText={setSystolic}
                  placeholder="e.g. 120"
                  keyboardType="numeric"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input
                  label="Diastolic BP (mmHg)"
                  value={diastolic}
                  onChangeText={setDiastolic}
                  placeholder="e.g. 80"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>

              <View style={styles.formRow}>
                <Input
                  label="Fasting Sugar (mg/dL)"
                  value={sugarFasting}
                  onChangeText={setSugarFasting}
                  placeholder="e.g. 95"
                  keyboardType="numeric"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input
                  label="Post-Meal Sugar (mg/dL)"
                  value={sugarPostMeal}
                  onChangeText={setSugarPostMeal}
                  placeholder="e.g. 140"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>

              <View style={styles.formRow}>
                <Input
                  label="SpO2 (%)"
                  value={spo2}
                  onChangeText={setSpo2}
                  placeholder="e.g. 98"
                  keyboardType="numeric"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input
                  label="Heart Rate (BPM)"
                  value={heartRate}
                  onChangeText={setHeartRate}
                  placeholder="e.g. 72"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>

              <View style={styles.formRow}>
                <Input
                  label="Temperature (°C)"
                  value={temperature}
                  onChangeText={setTemperature}
                  placeholder="e.g. 36.6"
                  keyboardType="numeric"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input
                  label="Weight (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="e.g. 78.4"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>

              <View style={{ marginTop: 24 }}>
                <Button title={editingVital ? 'Save Changes' : 'Save Log Record'} onPress={handleSaveVitals} variant="primary" />
                <Button
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  variant="secondary"
                  style={{ marginTop: 8 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtn: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollList: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  vitalCard: {
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  cardTime: {
    fontWeight: '600',
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  paramBox: {
    width: '48%',
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 6,
  },
  paramHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  paramName: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  paramVal: {
    fontWeight: 'bold',
    marginVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  formScroll: {
    paddingBottom: 60,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vitalCardFlat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderRadius: 12,
  },
  vitalCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vitalDetails: {
    marginLeft: 12,
  },
  vitalLabel: {
    fontWeight: 'bold',
  },
  vitalTime: {
    marginTop: 2,
  },
  vitalCardRight: {
    alignItems: 'flex-end',
  },
  vitalValText: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
});
