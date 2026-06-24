import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Alert, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { Activity, Clock, Camera, Image as ImageIcon } from 'lucide-react-native';

import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import { getSymptomsHistory, addSymptomLog, SymptomDB } from '../../database/dbHelpers';
import { saveFileLocally } from '../../services/fileService';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { VitalBadge } from '../../components/VitalBadge';
import { PageHeader } from '../../components/PageHeader';
import { IconContainer } from '../../components/IconContainer';

export const SymptomsScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const { themeMode, contrastMode, fontSizeScale, user } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const [loading, setLoading] = useState(true);
  const [symptomLogs, setSymptomLogs] = useState<SymptomDB[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (isFocused && user) {
      loadSymptoms();
    }
  }, [isFocused, user]);

  const loadSymptoms = () => {
    if (!user) return;
    setLoading(true);
    try {
      const logs = getSymptomsHistory(user.id, 50);
      setSymptomLogs(logs);
    } catch (error) {
      console.error('Error loading symptoms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (source: 'camera' | 'library') => {
    try {
      let permissionResult;
      if (source === 'camera') {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'MediTrack needs permission to access your camera/photos to attach logs.');
        return;
      }

      let pickerResult;
      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      };

      if (source === 'camera') {
        pickerResult = await ImagePicker.launchCameraAsync(options);
      } else {
        pickerResult = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!pickerResult.canceled && pickerResult.assets.length > 0) {
        const selectedUri = pickerResult.assets[0].uri;
        const savedUri = await saveFileLocally(selectedUri, `symptom_${Date.now()}.jpg`);
        if (savedUri) {
          setPhotoUri(savedUri);
        } else {
          setPhotoUri(selectedUri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Upload Failed', 'Could not load attachment.');
    }
  };

  const handleSaveSymptom = () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a symptom name.');
      return;
    }

    addSymptomLog({
      user_id: user.id,
      name: name.trim(),
      severity,
      notes: notes.trim() || null,
      photo_uri: photoUri,
    });

    Alert.alert('Saved', 'Symptom log entry added successfully.');
    setModalVisible(false);
    
    setName('');
    setSeverity(5);
    setNotes('');
    setPhotoUri(null);

    loadSymptoms();
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
      {/* Header with log button */}
      <View style={styles.headerRow}>
        <PageHeader title="Symptom Diary" icon={<Activity color="#FFFFFF" size={20} />} />
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Log Symptom</Text>
        </TouchableOpacity>
      </View>

      {/* Symptoms Timeline List */}
      <ScrollView contentContainerStyle={styles.scrollList}>
        {symptomLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Activity size={44} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, fontSize: 15 * fontScale, marginTop: 12, textAlign: 'center' }}>
              No symptoms logged yet. Tap "+ Log Symptom" to record how you feel.
            </Text>
          </View>
        ) : (
          symptomLogs.map((log, index) => {
            const isHighSeverity = log.severity >= 7;
            const isMediumSeverity = log.severity >= 4 && log.severity < 7;
            const badgeStatus = isHighSeverity ? 'critical' : isMediumSeverity ? 'borderline' : 'normal';

            return (
              <View key={log.id} style={styles.timelineItem}>
                {/* Vertical line indicator */}
                <View style={styles.timelineTrack}>
                  <View style={[styles.timelineDot, { backgroundColor: isHighSeverity ? theme.danger : isMediumSeverity ? theme.warning : theme.success }]} />
                  {index < symptomLogs.length - 1 && <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />}
                </View>

                {/* Card details */}
                <Card style={styles.symptomCard}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.symptomName, { color: theme.text, fontSize: 16 * fontScale }]}>{log.name}</Text>
                    <VitalBadge status={badgeStatus} label={`Severity ${log.severity}/10`} />
                  </View>
                  
                  <View style={styles.timestampRow}>
                    <Clock size={14} color={theme.textSecondary} />
                    <Text style={[styles.timestamp, { color: theme.textSecondary, fontSize: 13 * fontScale }]}>
                      {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                  </View>

                  {log.notes && (
                    <Text style={[styles.notesText, { color: theme.text, fontSize: 14 * fontScale }]}>
                      {log.notes}
                    </Text>
                  )}

                  {log.photo_uri && (
                    <Image source={{ uri: log.photo_uri }} style={styles.symptomImage} resizeMode="cover" />
                  )}
                </Card>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Log modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 0 }]}>
            <Text style={[styles.modalTitle, { color: theme.text, fontSize: 20 * fontScale }]}>Log New Symptom</Text>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <Input
                label="Symptom Name / Feeling"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Headache, Mild Fatigue"
              />

              <Text style={[styles.sliderLabel, { color: theme.text, fontSize: 16 * fontScale }]}>
                Severity Level: {severity}/10
              </Text>
              <View style={styles.severityRow}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const num = i + 1;
                  const isSelected = severity === num;
                  return (
                    <TouchableOpacity
                      key={num}
                      onPress={() => setSeverity(num)}
                      style={[
                        styles.severityNumBtn,
                        {
                          backgroundColor: isSelected
                            ? num >= 7
                              ? theme.danger
                              : num >= 4
                              ? theme.warning
                              : theme.success
                            : theme.background,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: isSelected ? '#FFFFFF' : theme.text, fontWeight: 'bold' }}>{num}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Input
                label="Describe Notes / Context"
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Started after lunch, went away after rest."
                multiline={true}
              />

              <Text style={[styles.label, { color: theme.text, fontSize: 15 * fontScale, marginTop: 16, marginBottom: 8 }]}>
                Attach Photo / Visual Log (Optional)
              </Text>
              <View style={styles.photoActionRow}>
                <TouchableOpacity
                  onPress={() => handlePickImage('camera')}
                  style={[styles.mediaBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                >
                  <Camera size={20} color={theme.primary} />
                  <Text style={[styles.mediaBtnText, { color: theme.text }]}>Use Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handlePickImage('library')}
                  style={[styles.mediaBtn, { backgroundColor: theme.background, borderColor: theme.border, marginLeft: 12 }]}
                >
                  <ImageIcon size={20} color={theme.primary} />
                  <Text style={[styles.mediaBtnText, { color: theme.text }]}>From Library</Text>
                </TouchableOpacity>
              </View>

              {photoUri && (
                <View style={styles.attachedImageContainer}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} />
                  <TouchableOpacity
                    onPress={() => setPhotoUri(null)}
                    style={[styles.removePhotoBtn, { backgroundColor: theme.danger }]}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>Remove Image</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ marginTop: 24 }}>
                <Button title="Save Log Entry" onPress={handleSaveSymptom} variant="primary" />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
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
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
  },
  timelineTrack: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 18,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    position: 'absolute',
    top: 24,
    bottom: 0,
    zIndex: 1,
  },
  symptomCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 16,
    padding: 14,
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
  },
  symptomName: {
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  timestamp: {
    marginLeft: 6,
    fontWeight: '500',
  },
  notesText: {
    lineHeight: 20,
    marginTop: 4,
  },
  symptomImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 12,
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
  sliderLabel: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  severityNumBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoActionRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
  },
  mediaBtnText: {
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 13,
  },
  attachedImageContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: 140,
    height: 105,
    borderRadius: 8,
  },
  removePhotoBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  label: {
    fontWeight: 'bold',
  },
});
