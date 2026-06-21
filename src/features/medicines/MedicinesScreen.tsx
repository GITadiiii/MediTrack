import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Alert, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import {
  getMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  MedicationDB,
} from '../../database/dbHelpers';
import { scheduleMedicationReminders, cancelAllReminders, scheduleRefillAlert } from '../../services/notificationService';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

export const MedicinesScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const { themeMode, contrastMode, fontSizeScale, user, addNotification } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const [loading, setLoading] = useState(true);
  const [medsList, setMedsList] = useState<MedicationDB[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMed, setEditingMed] = useState<MedicationDB | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [unit, setUnit] = useState('');
  const [instructions, setInstructions] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [frequencyType, setFrequencyType] = useState('Once Daily');
  const [timesInput, setTimesInput] = useState('08:00'); // Comma-separated times (e.g. 08:00, 20:00)
  const [stockRemaining, setStockRemaining] = useState('');
  const [refillThreshold, setRefillThreshold] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    if (isFocused && user) {
      loadMedications();
    }
  }, [isFocused, user]);

  const loadMedications = () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = getMedications(user.id);
      setMedsList(data);

      // Check stock levels and log unread center notifications
      data.forEach((med) => {
        if (med.stock_remaining <= med.refill_alert_threshold) {
          scheduleRefillAlert(med.id, med.name, med.stock_remaining);
          addNotification({
            title: `⚠️ Refill Alert: ${med.name}`,
            message: `${med.name} stock is low (${med.stock_remaining} left). Refill soon!`,
            type: 'medication_refill',
            referenceId: med.id,
          });
        }
      });
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setUnit('mg');
    setInstructions('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('2026-12-31');
    setFrequencyType('Once Daily');
    setTimesInput('08:00');
    setStockRemaining('30');
    setRefillThreshold('7');
    setRemindersEnabled(true);
    setModalVisible(true);
  };

  const handleOpenEdit = (med: MedicationDB) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setUnit(med.unit);
    setInstructions(med.instructions || '');
    setStartDate(med.start_date);
    setEndDate(med.end_date);
    setFrequencyType(med.frequency_type);
    
    // Parse times array to comma-separated
    let parsedTimes = '08:00';
    try {
      const arr = JSON.parse(med.frequency_details || '[]');
      parsedTimes = arr.join(', ');
    } catch {}
    setTimesInput(parsedTimes);
    
    setStockRemaining(med.stock_remaining.toString());
    setRefillThreshold(med.refill_alert_threshold.toString());
    setRemindersEnabled(med.reminders_enabled === 1);
    setModalVisible(true);
  };

  const handleSaveMed = async () => {
    if (!user) return;

    if (!name.trim() || !dosage.trim() || !unit.trim() || !startDate.trim() || !endDate.trim() || !stockRemaining.trim()) {
      Alert.alert('Validation Error', 'Please fill in all mandatory medication details.');
      return;
    }

    const pStock = parseFloat(stockRemaining);
    const pThreshold = refillThreshold ? parseFloat(refillThreshold) : 0;
    if (isNaN(pStock) || isNaN(pThreshold)) {
      Alert.alert('Validation Error', 'Stock values must be numbers.');
      return;
    }

    // Process times input
    const times = timesInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => /^\d{2}:\d{2}$/.test(t)); // Basic HH:MM validation

    if (times.length === 0) {
      Alert.alert('Validation Error', 'Please specify at least one time in HH:MM format (e.g. 08:00).');
      return;
    }

    const medData = {
      user_id: user.id,
      name,
      dosage,
      unit,
      instructions: instructions || null,
      start_date: startDate,
      end_date: endDate,
      frequency_type: frequencyType,
      frequency_details: JSON.stringify(times),
      stock_remaining: pStock,
      refill_alert_threshold: pThreshold,
      reminders_enabled: remindersEnabled ? 1 : 0,
    };

    try {
      if (editingMed) {
        updateMedication({
          ...medData,
          id: editingMed.id,
        });
        
        // Re-schedule alarms
        if (remindersEnabled) {
          await scheduleMedicationReminders(editingMed.id, name, dosage, unit, times);
        }
        
        Alert.alert('Success', 'Medication updated successfully.');
      } else {
        const insertId = addMedication(medData);
        
        // Schedule alarms
        if (remindersEnabled) {
          await scheduleMedicationReminders(insertId, name, dosage, unit, times);
        }

        Alert.alert('Success', 'Medication scheduled successfully.');
      }

      setModalVisible(false);
      loadMedications();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save medication schedule.');
    }
  };

  const handleDeleteMed = (id: number) => {
    Alert.alert('Delete Medication', 'Are you sure you want to delete this medication and all scheduled reminders?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMedication(id);
          loadMedications();
        },
      },
    ]);
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
      {/* Header Bar */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontSize: 22 * fontScale }]}>My Medication Schedules</Text>
        <TouchableOpacity
          onPress={handleOpenAdd}
          style={[styles.addBtn, { backgroundColor: theme.primary, minHeight: 48, minWidth: 48 }]}
        >
          <Text style={styles.addBtnText}>+ Add Routine</Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      <ScrollView contentContainerStyle={styles.scrollList}>
        {medsList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 40 }}>💊</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 16 * fontScale, marginTop: 8, textAlign: 'center' }}>
              No medications listed yet. Click "+ Add Routine" to create your first schedule.
            </Text>
          </View>
        ) : (
          medsList.map((med) => {
            const isLowStock = med.stock_remaining <= med.refill_alert_threshold;
            let displayTimes = '';
            try {
              const arr = JSON.parse(med.frequency_details || '[]');
              displayTimes = arr.join(', ');
            } catch {}

            return (
              <Card key={med.id} style={styles.medCard}>
                <View style={styles.medHeader}>
                  <View>
                    <Text style={[styles.medName, { color: theme.text, fontSize: 18 * fontScale }]}>
                      {med.name}
                    </Text>
                    <Text style={[styles.medInstructions, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                      {med.dosage} {med.unit} - {med.instructions || 'No instructions'}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => handleOpenEdit(med)} style={styles.actionIcon}>
                      <Text style={{ fontSize: 16, color: theme.primary }}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteMed(med.id)} style={[styles.actionIcon, { marginLeft: 12 }]}>
                      <Text style={{ fontSize: 16, color: theme.danger }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Details grid */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailBox}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>Frequency</Text>
                    <Text style={[styles.detailVal, { color: theme.text, fontSize: 14 * fontScale }]}>{med.frequency_type}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>Schedule Times</Text>
                    <Text style={[styles.detailVal, { color: theme.text, fontSize: 14 * fontScale }]}>{displayTimes}</Text>
                  </View>
                  <View style={styles.detailBox}>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>Remaining Stock</Text>
                    <Text
                      style={[
                        styles.detailVal,
                        {
                          color: isLowStock ? theme.danger : theme.text,
                          fontWeight: 'bold',
                          fontSize: 14 * fontScale,
                        },
                      ]}
                    >
                      {med.stock_remaining} doses {isLowStock ? '⚠️ LOW' : ''}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 0 }]}>
            <Text style={[styles.modalTitle, { color: theme.text, fontSize: 20 * fontScale }]}>
              {editingMed ? 'Edit Medication Schedule' : 'Schedule New Medication'}
            </Text>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <Input label="Medicine Name" value={name} onChangeText={setName} placeholder="e.g. Lisinopril" />

              <View style={styles.formRow}>
                <Input
                  label="Dosage"
                  value={dosage}
                  onChangeText={setDosage}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input
                  label="Unit"
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="e.g. mg, pill, puff"
                  style={{ flex: 1 }}
                />
              </View>

              <Input
                label="Special Instructions"
                value={instructions}
                onChangeText={setInstructions}
                placeholder="e.g. Take with food in the morning"
              />

              <View style={styles.formRow}>
                <Input
                  label="Start Date"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input label="End Date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
              </View>

              <Input
                label="Frequency Type"
                value={frequencyType}
                onChangeText={setFrequencyType}
                placeholder="Once Daily / Twice Daily / Weekly / Custom"
              />

              <Input
                label="Scheduled Times (comma-separated HH:MM)"
                value={timesInput}
                onChangeText={setTimesInput}
                placeholder="e.g. 08:00, 20:00"
              />

              <View style={styles.formRow}>
                <Input
                  label="Stock Remaining (doses)"
                  value={stockRemaining}
                  onChangeText={setStockRemaining}
                  placeholder="e.g. 60"
                  keyboardType="numeric"
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Input
                  label="Refill Notice Threshold"
                  value={refillThreshold}
                  onChangeText={setRefillThreshold}
                  placeholder="e.g. 7"
                  keyboardType="numeric"
                  style={{ flex: 1 }}
                />
              </View>

              {/* Reminders Toggle */}
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: theme.text, fontSize: 16 * fontScale }]}>
                  Enable Local Reminders (Alarms)
                </Text>
                <Switch value={remindersEnabled} onValueChange={setRemindersEnabled} trackColor={{ true: theme.primary }} />
              </View>

              <View style={{ marginTop: 24 }}>
                <Button title={editingMed ? 'Save Changes' : 'Schedule Medication'} onPress={handleSaveMed} variant="primary" />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
  },
  addBtn: {
    paddingHorizontal: 16,
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
  medCard: {
    padding: 14,
    marginBottom: 12,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  medName: {
    fontWeight: '900',
  },
  medInstructions: {
    fontWeight: '500',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionIcon: {
    padding: 6,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailBox: {
    width: '48%',
    marginVertical: 4,
  },
  detailLabel: {
    fontWeight: '600',
  },
  detailVal: {
    fontWeight: '700',
    marginTop: 2,
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
    paddingBottom: 24,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  toggleLabel: {
    fontWeight: '600',
  },
});
