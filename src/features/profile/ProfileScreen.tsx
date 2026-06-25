import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, TextInput, Platform, Modal, FlatList, ToastAndroid } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import {
  getMedicalProfile,
  updateMedicalProfile,
  getEmergencyContact,
  saveEmergencyContact,
  updateUserBasicDetails,
  MedicalProfileDB,
  EmergencyContactDB,
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContactDetail,
  deleteEmergencyContact,
} from '../../database/dbHelpers';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { IconContainer } from '../../components/IconContainer';
import { User, AlertTriangle, Settings, Pencil, Trash2 } from 'lucide-react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const showToast = (message: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else if (Platform.OS === 'web') {
    window.alert(message);
  } else {
    Alert.alert('', message);
  }
};

// Age calculation from DOB
const calculateAge = (dobString: string): string => {
  if (!dobString || !/^\d{2}-\d{2}-\d{4}$/.test(dobString)) return '';
  const [day, month, year] = dobString.split('-').map(Number);
  const today = new Date();
  let calculatedAge = today.getFullYear() - year;
  const m = today.getMonth() - (month - 1);
  if (m < 0 || (m === 0 && today.getDate() < day)) {
    calculatedAge--;
  }
  return Math.max(0, calculatedAge).toString();
};

// Zod validation schema for Personal Information
const personalSchema = z.object({
  name: z.string().min(1, 'Full Name is required.'),
  age: z.string().optional().or(z.literal('')).refine(
    (val) => {
      if (!val) return true;
      if (!/^\d{1,3}$/.test(val)) return false;
      const num = parseInt(val, 10);
      return num >= 0 && num <= 999;
    },
    { message: 'Please enter a valid age.' }
  ),
  gender: z.string().optional().or(z.literal('')).refine(
    (val) => {
      if (!val || val === '' || val === 'Select Gender') return true;
      return ['Male', 'Female', 'Other'].includes(val);
    },
    { message: 'Gender must be Male, Female, or Other.' }
  ),
  dob: z.string().optional().or(z.literal('')).refine(
    (val) => {
      if (!val || val === '') return true;
      if (!/^\d{2}-\d{2}-\d{4}$/.test(val)) return false;
      const [day, month, year] = val.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date <= today;
    },
    { message: 'Date of birth cannot be in the future.' }
  ),
  bloodGroup: z.string().optional().or(z.literal('')).refine(
    (val) => {
      if (!val || val === '' || val === 'Select Blood Group') return true;
      return ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(val);
    },
    { message: 'Please select a valid blood group.' }
  ),
  height: z.string().optional().or(z.literal('')).refine(
    (val) => {
      if (!val || val === '0' || val === '0.0') return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 50 && num <= 300;
    },
    { message: 'Height must be between 50 cm and 300 cm.' }
  ),
  weight: z.string().optional().or(z.literal('')).refine(
    (val) => {
      if (!val || val === '0' || val === '0.0') return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 1 && num <= 500;
    },
    { message: 'Weight must be between 1 kg and 500 kg.' }
  ),
});

// Reusable Dropdown select component
interface DropdownSelectProps {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onSelect: (val: string) => void;
  error?: string;
}

const DropdownSelect: React.FC<DropdownSelectProps> = ({
  label,
  value,
  options,
  placeholder,
  onSelect,
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { themeMode, contrastMode, fontSizeScale } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const displayVal = value && value !== 'Select Gender' && value !== 'Select Blood Group' ? value : '';

  return (
    <View style={styles.dropdownContainer}>
      <Text style={[styles.inputLabel, { color: theme.text, fontSize: 15 * fontScale }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={[
          styles.dropdownTrigger,
          {
            backgroundColor: theme.card,
            borderColor: error ? theme.danger : theme.border,
            borderWidth: error || contrastMode === 'high' ? 2 : 1,
          },
        ]}
      >
        <Text style={{ color: displayVal ? theme.text : theme.textSecondary, fontSize: 16 * fontScale }}>
          {displayVal || placeholder}
        </Text>
      </TouchableOpacity>
      {error && (
        <Text style={[styles.errorText, { color: theme.danger, fontSize: 13 * fontScale }]}>
          {error}
        </Text>
      )}

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.dropdownModalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 0 }]}>
            <Text style={[styles.dropdownModalTitle, { color: theme.text, fontSize: 18 * fontScale }]}>
              Select {label}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                  style={[styles.dropdownOption, { borderBottomColor: theme.border }]}
                >
                  <Text style={{ color: theme.text, fontSize: 16 * fontScale }}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <Button
              title="Cancel"
              onPress={() => setModalVisible(false)}
              variant="secondary"
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Reusable Date Picker component
interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  initialValue?: string;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  onSelect,
  initialValue,
}) => {
  const { themeMode, contrastMode, fontSizeScale } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (visible) {
      if (initialValue && /^\d{2}-\d{2}-\d{4}$/.test(initialValue)) {
        const [d, m, y] = initialValue.split('-').map(Number);
        setDay(d);
        setMonth(m);
        setYear(y);
      } else {
        const today = new Date();
        setDay(today.getDate());
        setMonth(today.getMonth() + 1);
        setYear(today.getFullYear());
      }
    }
  }, [visible, initialValue]);

  const years = Array.from({ length: 127 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const getDaysInMonth = (m: number, y: number) => {
    return new Date(y, m, 0).getDate();
  };

  const maxDays = getDaysInMonth(month, year);
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  useEffect(() => {
    if (day > maxDays) {
      setDay(maxDays);
    }
  }, [month, year, maxDays]);

  const handleConfirm = () => {
    const formattedDay = day.toString().padStart(2, '0');
    const formattedMonth = month.toString().padStart(2, '0');
    const dateStr = `${formattedDay}-${formattedMonth}-${year}`;
    onSelect(dateStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.datePickerContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: contrastMode === 'high' ? 2 : 0 }]}>
          <Text style={[styles.dropdownModalTitle, { color: theme.text, fontSize: 18 * fontScale }]}>
            Select Date of Birth
          </Text>

          <View style={styles.columnsRow}>
            <View style={styles.columnContainer}>
              <Text style={[styles.columnHeader, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>DAY</Text>
              <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                {days.map((d) => {
                  const isSelected = d === day;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDay(d)}
                      style={[
                        styles.pickerItem,
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: isSelected ? '#FFFFFF' : theme.text, fontSize: 16 * fontScale },
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.columnContainer}>
              <Text style={[styles.columnHeader, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>MONTH</Text>
              <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                {months.map((m) => {
                  const isSelected = m.value === month;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      onPress={() => setMonth(m.value)}
                      style={[
                        styles.pickerItem,
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: isSelected ? '#FFFFFF' : theme.text, fontSize: 14 * fontScale },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.columnContainer}>
              <Text style={[styles.columnHeader, { color: theme.textSecondary, fontSize: 12 * fontScale }]}>YEAR</Text>
              <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                {years.map((y) => {
                  const isSelected = y === year;
                  return (
                    <TouchableOpacity
                      key={y}
                      onPress={() => setYear(y)}
                      style={[
                        styles.pickerItem,
                        isSelected && { backgroundColor: theme.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: isSelected ? '#FFFFFF' : theme.text, fontSize: 16 * fontScale },
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button title="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1, marginRight: 8 }} />
            <Button title="Confirm" onPress={handleConfirm} variant="primary" style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

type ProfileSection = 'personal' | 'medical' | 'emergency';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { themeMode, contrastMode, fontSizeScale, user, setUser, logout } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<z.infer<typeof personalSchema>>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      name: '',
      age: '',
      gender: '',
      dob: '',
      bloodGroup: '',
      height: '',
      weight: '',
    },
    mode: 'onChange',
  });

  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<MedicalProfileDB | null>(null);
  
  // Form states - Personal Info
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Form states - Medical Info (comma separated strings for ease of entry)
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [surgeries, setSurgeries] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');

  // Form states - Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [phoneType, setPhoneType] = useState<'IN' | 'INTL'>('IN');
  const [rawPhone, setRawPhone] = useState('');
  const [contactsList, setContactsList] = useState<EmergencyContactDB[]>([]);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);

  useEffect(() => {
    if (isFocused && user) {
      loadProfileData();
    }
  }, [isFocused, user]);

  const formatDisplayValue = (value: string | number | null | undefined, unit?: string): string => {
    if (value === null || value === undefined) return 'Not specified';
    const str = value.toString().trim();
    if (
      str === '' ||
      str === '0' ||
      str === '0.0' ||
      str === 'Select Gender' ||
      str === 'Select Blood Group'
    ) {
      return 'Not specified';
    }
    return unit ? `${str} ${unit}` : str;
  };

  const loadProfileData = () => {
    if (!user) return;
    
    // Load Medical Profile
    const medProfile = getMedicalProfile(user.id);
    if (medProfile) {
      setProfile(medProfile);
      
      // Personal
      setName(user.name || '');
      setAge(medProfile.age && medProfile.age !== 0 ? medProfile.age.toString() : '');
      setGender(medProfile.gender || '');
      
      let formattedDob = medProfile.dob || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(formattedDob)) {
        const [year, month, day] = formattedDob.split('-');
        formattedDob = `${day}-${month}-${year}`;
      }
      setDob(formattedDob);

      setBloodGroup(medProfile.blood_group || '');
      setHeight(medProfile.height && medProfile.height !== 0 ? medProfile.height.toString() : '');
      setWeight(medProfile.weight && medProfile.weight !== 0 ? medProfile.weight.toString() : '');

      // Medical Arrays
      setConditions(parseJsonArrayToCommaString(medProfile.conditions));
      setAllergies(parseJsonArrayToCommaString(medProfile.allergies));
      setMedications(parseJsonArrayToCommaString(medProfile.medications));
      setSurgeries(parseJsonArrayToCommaString(medProfile.surgeries));
      setFamilyHistory(parseJsonArrayToCommaString(medProfile.family_history));
    } else {
      setName(user.name || '');
      setAge('');
      setGender('');
      setDob('');
      setBloodGroup('');
      setHeight('');
      setWeight('');
    }

    // Load Emergency Contact List
    const list = getEmergencyContacts(user.id);
    setContactsList(list);

    if (list.length > 0) {
      const primary = list[0];
      setEmergencyName(primary.name);
      setEmergencyRelation(primary.relation);
      const phoneVal = primary.phone || '';
      setEmergencyPhone(phoneVal);
    } else {
      setEmergencyName('');
      setEmergencyRelation('');
      setEmergencyPhone('');
    }
  };

  const startEditingContact = (contact: EmergencyContactDB) => {
    setEditingContactId(contact.id);
    setEmergencyName(contact.name);
    setEmergencyRelation(contact.relation);
    setEmergencyPhone(contact.phone);
    
    const phoneVal = contact.phone || '';
    if (phoneVal.startsWith('+91') && phoneVal.length === 13) {
      setPhoneType('IN');
      setRawPhone(phoneVal.slice(3));
    } else {
      setPhoneType('INTL');
      setRawPhone(phoneVal);
    }
    setIsEditing(true);
  };

  const startAddingContact = () => {
    if (contactsList.length >= 5) {
      showAlert('Limit Reached', 'You can enter a maximum of 5 emergency contacts.');
      return;
    }
    setEditingContactId(null);
    setEmergencyName('');
    setEmergencyRelation('');
    setEmergencyPhone('');
    setRawPhone('');
    setPhoneType('IN');
    setIsEditing(true);
  };

  const handleDeleteContact = (contactId: number) => {
    const executeDelete = () => {
      try {
        deleteEmergencyContact(contactId);
        showAlert('Success', 'Emergency contact deleted successfully.');
        loadProfileData();
      } catch (error) {
        console.log("SQLite Error:", error);
        showAlert('Error', 'Unable to delete emergency contact.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this emergency contact?')) {
        executeDelete();
      }
      return;
    }

    Alert.alert('Delete Contact', 'Are you sure you want to delete this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: executeDelete },
    ]);
  };

  const parseJsonArrayToCommaString = (jsonStr: string | null): string => {
    if (!jsonStr) return '';
    try {
      const arr = JSON.parse(jsonStr);
      return Array.isArray(arr) ? arr.join(', ') : '';
    } catch {
      return '';
    }
  };

  const parseCommaStringToJsonArray = (commaStr: string): string => {
    const arr = commaStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return JSON.stringify(arr);
  };

  const onSubmitPersonal = (data: z.infer<typeof personalSchema>) => {
    if (!user) return;

    const parsedAge = !data.age ? 0 : parseInt(data.age, 10);
    const parsedHeight = !data.height ? 0 : parseFloat(data.height);
    const parsedWeight = !data.weight ? 0 : parseFloat(data.weight);

    const formData = {
      name: data.name.trim(),
      age: parsedAge,
      gender: data.gender || '',
      dob: data.dob || '',
      blood_group: data.bloodGroup || '',
      height: parsedHeight,
      weight: parsedWeight,
    };

    // Double check constraints before database save as requested
    if (!formData.name) {
      showToast('Validation failed. Name is required.');
      return;
    }
    if (formData.age < 0 || formData.age > 999) {
      showToast('Validation failed. Age must be between 0 and 999.');
      return;
    }
    if (formData.gender && !['Male', 'Female', 'Other'].includes(formData.gender)) {
      showToast('Validation failed. Invalid gender selected.');
      return;
    }
    if (formData.dob) {
      const [day, month, year] = formData.dob.split('-').map(Number);
      const dobDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dobDate > today) {
        showToast('Validation failed. Date of birth cannot be in the future.');
        return;
      }
    }
    if (formData.blood_group && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(formData.blood_group)) {
      showToast('Validation failed. Invalid blood group selected.');
      return;
    }
    if (formData.height !== 0 && (formData.height < 50 || formData.height > 300)) {
      showToast('Validation failed. Height must be between 50 and 300 cm.');
      return;
    }
    if (formData.weight !== 0 && (formData.weight < 1 || formData.weight > 500)) {
      showToast('Validation failed. Weight must be between 1 and 500 kg.');
      return;
    }

    const currentProfile = getMedicalProfile(user.id) || {
      conditions: '[]',
      allergies: '[]',
      medications: '[]',
      surgeries: '[]',
      family_history: '[]'
    };

    try {
      updateUserBasicDetails(user.id, formData.name);
      updateMedicalProfile({
        user_id: user.id,
        age: formData.age,
        gender: formData.gender,
        dob: formData.dob,
        blood_group: formData.blood_group,
        height: formData.height,
        weight: formData.weight,
        conditions: currentProfile.conditions,
        allergies: currentProfile.allergies,
        medications: currentProfile.medications,
        surgeries: currentProfile.surgeries,
        family_history: currentProfile.family_history,
      });

      setUser({
        ...user,
        name: formData.name,
      });

      showToast('Profile updated successfully.');
      setIsEditing(false);
      
      // Update local states so that display summary updates immediately
      setName(formData.name);
      setAge(formData.age && formData.age !== 0 ? formData.age.toString() : '');
      setGender(formData.gender);
      setDob(formData.dob);
      setBloodGroup(formData.blood_group);
      setHeight(formData.height && formData.height !== 0 ? formData.height.toString() : '');
      setWeight(formData.weight && formData.weight !== 0 ? formData.weight.toString() : '');

      loadProfileData();
    } catch (error) {
      console.log("SQLite Error:", error);
      showToast('Unable to save profile.');
    }
  };

  const handleSave = () => {
    if (!user) return;

    if (activeSection === 'personal') {
      return;
    } 
    
    else if (activeSection === 'medical') {
      const currentProfile = getMedicalProfile(user.id);
      if (!currentProfile) {
        console.log("Profile Update Result:", false);
        console.log("SQLite Error:", "Medical profile not found for user ID " + user.id);
        showAlert('Error', 'Unable to update medical records.');
        return;
      }

      const formData = {
        conditions: parseCommaStringToJsonArray(conditions),
        allergies: parseCommaStringToJsonArray(allergies),
        medications: parseCommaStringToJsonArray(medications),
        surgeries: parseCommaStringToJsonArray(surgeries),
        family_history: parseCommaStringToJsonArray(familyHistory),
      };
      console.log("Profile Form Data:", formData);

      try {
        updateMedicalProfile({
          user_id: user.id,
          age: currentProfile.age,
          gender: currentProfile.gender,
          dob: currentProfile.dob,
          blood_group: currentProfile.blood_group,
          height: currentProfile.height,
          weight: currentProfile.weight,
          conditions: formData.conditions,
          allergies: formData.allergies,
          medications: formData.medications,
          surgeries: formData.surgeries,
          family_history: formData.family_history,
        });

        console.log("Profile Update Result:", true);
        showAlert('Success', 'Medical records updated.');
        setIsEditing(false);
        loadProfileData();
      } catch (error) {
        console.log("Profile Update Result:", false);
        console.log("SQLite Error:", error);
        showAlert('Error', 'Unable to update medical records.');
      }
    } 
    
    else if (activeSection === 'emergency') {
      if (!emergencyName.trim() || !emergencyRelation.trim() || !rawPhone.trim()) {
        showAlert('Validation Error', 'Please fill in all emergency contact details.');
        return;
      }

      let finalPhone = '';
      if (phoneType === 'IN') {
        const cleaned = rawPhone.trim().replace(/\D/g, '');
        if (cleaned.length !== 10 || !/^[6-9]/.test(cleaned)) {
          showAlert('Validation Error', 'Enter a valid Indian mobile number.');
          return;
        }
        finalPhone = `+91${cleaned}`;
      } else {
        let cleaned = rawPhone.trim().replace(/\s+/g, '');
        if (!cleaned.startsWith('+')) {
          cleaned = `+${cleaned}`;
        }
        const parsed = parsePhoneNumberFromString(cleaned);
        if (!parsed || !parsed.isValid()) {
          showAlert(
            'Validation Error',
            'Enter a valid international phone number starting with + followed by 10 to 15 digits (e.g. +14155552671).'
          );
          return;
        }
        finalPhone = parsed.format('E.164');
      }

      const formData = {
        name: emergencyName.trim(),
        relation: emergencyRelation.trim(),
        phone: finalPhone,
      };
      console.log("Profile Form Data:", formData);

      try {
        if (editingContactId === null) {
          if (contactsList.length >= 5) {
            showAlert('Limit Reached', 'You can enter a maximum of 5 emergency contacts.');
            return;
          }
          addEmergencyContact(user.id, formData.name, formData.relation, formData.phone);
        } else {
          updateEmergencyContactDetail(editingContactId, formData.name, formData.relation, formData.phone);
        }

        console.log("Profile Update Result:", true);
        showAlert('Success', 'Emergency contact updated successfully.');
        setIsEditing(false);
        setEditingContactId(null);
        loadProfileData();
      } catch (error) {
        console.log("Profile Update Result:", false);
        console.log("SQLite Error:", error);
        showAlert('Error', 'Unable to update emergency contact.');
      }
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out of your session?')) {
        logout();
      }
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to log out of your session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const renderPersonalView = () => {
    if (isEditing) {
      return (
        <Card style={styles.formCard}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Full Name"
                value={value || ''}
                onChangeText={onChange}
                placeholder="John Doe"
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="age"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Age"
                value={value || ''}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 3);
                  onChange(cleaned);
                }}
                placeholder="e.g. 25"
                keyboardType="number-pad"
                error={errors.age?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="gender"
            render={({ field: { onChange, value } }) => (
              <DropdownSelect
                label="Gender"
                value={value || ''}
                options={['Male', 'Female', 'Other']}
                placeholder="Select Gender"
                onSelect={onChange}
                error={errors.gender?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="dob"
            render={({ field: { onChange, value } }) => {
              const [showPicker, setShowPicker] = useState(false);
              return (
                <View style={{ marginVertical: 8 }}>
                  <Text style={[styles.inputLabel, { color: theme.text, fontSize: 15 * fontScale }]}>Date of Birth</Text>
                  <TouchableOpacity
                    onPress={() => setShowPicker(true)}
                    style={[
                      styles.dropdownTrigger,
                      {
                        backgroundColor: theme.card,
                        borderColor: errors.dob?.message ? theme.danger : theme.border,
                        borderWidth: errors.dob?.message || contrastMode === 'high' ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: value ? theme.text : theme.textSecondary, fontSize: 16 * fontScale }}>
                      {value || 'DD-MM-YYYY'}
                    </Text>
                  </TouchableOpacity>
                  {errors.dob?.message && (
                    <Text style={[styles.errorText, { color: theme.danger, fontSize: 13 * fontScale }]}>
                      {errors.dob.message}
                    </Text>
                  )}
                  <DatePickerModal
                    visible={showPicker}
                    onClose={() => setShowPicker(false)}
                    initialValue={value || ''}
                    onSelect={(date) => {
                      onChange(date);
                      const computedAge = calculateAge(date);
                      if (computedAge) {
                        setValue('age', computedAge, { shouldValidate: true });
                      }
                    }}
                  />
                </View>
              );
            }}
          />

          <Controller
            control={control}
            name="bloodGroup"
            render={({ field: { onChange, value } }) => (
              <DropdownSelect
                label="Blood Group"
                value={value || ''}
                options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
                placeholder="Select Blood Group"
                onSelect={onChange}
                error={errors.bloodGroup?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="height"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Height (cm)"
                value={value || ''}
                onChangeText={(text) => {
                  let cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) {
                    cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
                  }
                  onChange(cleaned);
                }}
                placeholder="e.g. 170"
                keyboardType="decimal-pad"
                error={errors.height?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="weight"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Weight (kg)"
                value={value || ''}
                onChangeText={(text) => {
                  let cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) {
                    cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
                  }
                  onChange(cleaned);
                }}
                placeholder="e.g. 65"
                keyboardType="decimal-pad"
                error={errors.weight?.message}
              />
            )}
          />
        </Card>
      );
    }
 
    return (
      <Card style={styles.viewCard}>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Full Name</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale }]}>{name || 'Not specified'}</Text></View>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Age</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale }]}>{formatDisplayValue(age, 'years')}</Text></View>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Gender</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale }]}>{formatDisplayValue(gender)}</Text></View>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Date of Birth</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale }]}>{formatDisplayValue(dob)}</Text></View>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Blood Group</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale, fontWeight: 'bold' }]}>{formatDisplayValue(bloodGroup)}</Text></View>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Height</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale }]}>{formatDisplayValue(height, 'cm')}</Text></View>
        <View style={styles.dataRow}><Text style={[styles.label, { color: theme.textSecondary, fontSize: 15 * fontScale }]}>Weight</Text><Text style={[styles.value, { color: theme.text, fontSize: 17 * fontScale }]}>{formatDisplayValue(weight, 'kg')}</Text></View>
      </Card>
    );
  };

  const renderMedicalView = () => {
    if (isEditing) {
      return (
        <Card style={styles.formCard}>
          <Input label="Existing Medical Conditions (comma separated)" value={conditions} onChangeText={setConditions} placeholder="e.g. Diabetes, Hypertension" multiline={true} />
          <Input label="Allergies & Reactions" value={allergies} onChangeText={setAllergies} placeholder="e.g. Penicillin, Peanuts" multiline={true} />
          <Input label="Current Prescribed Medications" value={medications} onChangeText={setMedications} placeholder="e.g. Metformin 500mg, Lisinopril 10mg" multiline={true} />
          <Input label="Past Surgeries & Procedures" value={surgeries} onChangeText={setSurgeries} placeholder="e.g. Appendectomy (1985)" multiline={true} />
          <Input label="Family Medical History" value={familyHistory} onChangeText={setFamilyHistory} placeholder="e.g. Father: Heart Disease" multiline={true} />
        </Card>
      );
    }

    return (
      <Card style={styles.viewCard}>
        <View style={styles.dataBlock}>
          <Text style={[styles.blockLabel, { color: theme.primary, fontSize: 15 * fontScale }]}>Existing Conditions</Text>
          <Text style={[styles.blockValue, { color: theme.text, fontSize: 16 * fontScale }]}>{conditions || 'None listed'}</Text>
        </View>
        <View style={styles.dataBlock}>
          <Text style={[styles.blockLabel, { color: theme.danger, fontSize: 15 * fontScale }]}>Allergies</Text>
          <Text style={[styles.blockValue, { color: theme.text, fontSize: 16 * fontScale, fontWeight: allergies ? 'bold' : 'normal' }]}>{allergies || 'No known allergies'}</Text>
        </View>
        <View style={styles.dataBlock}>
          <Text style={[styles.blockLabel, { color: theme.primary, fontSize: 15 * fontScale }]}>Current Medications</Text>
          <Text style={[styles.blockValue, { color: theme.text, fontSize: 16 * fontScale }]}>{medications || 'None listed'}</Text>
        </View>
        <View style={styles.dataBlock}>
          <Text style={[styles.blockLabel, { color: theme.primary, fontSize: 15 * fontScale }]}>Past Surgeries</Text>
          <Text style={[styles.blockValue, { color: theme.text, fontSize: 16 * fontScale }]}>{surgeries || 'None listed'}</Text>
        </View>
        <View style={styles.dataBlock}>
          <Text style={[styles.blockLabel, { color: theme.primary, fontSize: 15 * fontScale }]}>Family History</Text>
          <Text style={[styles.blockValue, { color: theme.text, fontSize: 16 * fontScale }]}>{familyHistory || 'None listed'}</Text>
        </View>
      </Card>
    );
  };

  const renderEmergencyView = () => {
    if (isEditing) {
      return (
        <Card style={styles.formCard}>
          <Input label="Contact Full Name" value={emergencyName} onChangeText={setEmergencyName} placeholder="Sarah Doe" />
          <Input label="Relationship to Patient" value={emergencyRelation} onChangeText={setEmergencyRelation} placeholder="e.g. Spouse, Daughter, Son" />
          
          <View style={{ marginVertical: 8, width: '100%' }}>
            <Text
              style={{
                color: theme.text,
                fontSize: 15 * fontScale,
                fontWeight: contrastMode === 'high' ? '900' : '600',
                marginBottom: 6,
              }}
            >
              Emergency Contact Phone Number
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setPhoneType(phoneType === 'IN' ? 'INTL' : 'IN')}
                activeOpacity={0.7}
                style={{
                  height: 48,
                  width: 100,
                  borderRadius: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: contrastMode === 'high' ? 2 : 1,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 16 * fontScale, fontWeight: 'bold' }}>
                  {phoneType === 'IN' ? '🇮🇳 +91' : '🌐 Intl'}
                </Text>
              </TouchableOpacity>
              <TextInput
                value={rawPhone}
                onChangeText={setRawPhone}
                placeholder={phoneType === 'IN' ? '9876543210' : '+14155552671'}
                placeholderTextColor={theme.textSecondary}
                keyboardType={phoneType === 'IN' ? 'number-pad' : 'phone-pad'}
                maxLength={phoneType === 'IN' ? 10 : 20}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  color: theme.text,
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: contrastMode === 'high' ? 2 : 1,
                  fontSize: 16 * fontScale,
                }}
              />
            </View>
          </View>
        </Card>
      );
    }

    return (
      <View>
        {contactsList.length > 0 ? (
          contactsList.map((contact) => (
            <Card key={contact.id} style={[styles.viewCard, { marginBottom: 12, padding: 14 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 17 * fontScale }}>
                  {contact.relation} Contact
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => startEditingContact(contact)}
                    style={{ padding: 6, marginRight: 12 }}
                    activeOpacity={0.7}
                  >
                    <Pencil size={18} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteContact(contact.id)}
                    style={{ padding: 6 }}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={18} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.dataRowPlain}>
                <Text style={[styles.label, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>Contact Name</Text>
                <Text style={[styles.value, { color: theme.text, fontSize: 16 * fontScale }]}>{contact.name}</Text>
              </View>
              <View style={styles.dataRowPlain}>
                <Text style={[styles.label, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>Relationship</Text>
                <Text style={[styles.value, { color: theme.text, fontSize: 16 * fontScale }]}>{contact.relation}</Text>
              </View>
              <View style={styles.dataRowPlain}>
                <Text style={[styles.label, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>Phone Number</Text>
                <Text style={[styles.value, { color: theme.danger, fontSize: 16 * fontScale, fontWeight: 'bold' }]}>{contact.phone}</Text>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.viewCard}>
            <View style={{ alignItems: 'center', padding: 12 }}>
              <AlertTriangle size={32} color={theme.danger} style={{ marginBottom: 8 }} />
              <Text style={{ color: theme.danger, fontSize: 16 * fontScale, fontWeight: 'bold', textAlign: 'center' }}>
                No Emergency Contacts Listed!
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, textAlign: 'center', marginTop: 4 }}>
                Add a contact so the SOS module can function correctly in emergencies.
              </Text>
            </View>
          </Card>
        )}

        {contactsList.length >= 5 && (
          <View style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 * fontScale, fontWeight: 'bold' }}>
              Maximum limit of 5 emergency contacts reached.
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <PageHeader
        title="My Profile"
        icon={<User size={22} color="#FFFFFF" />}
        rightElement={
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsHeaderBtn}
            activeOpacity={0.7}
          >
            <Settings size={22} color={theme.text} />
          </TouchableOpacity>
        }
      />
      
      {/* Header Profile Area */}
      <View style={[styles.profileHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.avatarCircle}>
          <User size={40} color={theme.primary} />
        </View>
        <Text style={[styles.profileName, { color: theme.text, fontSize: 22 * fontScale }]}>
          {name || 'MediTrack User'}
        </Text>
        <Text style={[styles.profileEmail, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
          {user?.email}
        </Text>
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabContainer}>
        {(['personal', 'medical', 'emergency'] as ProfileSection[]).map((section) => (
          <TouchableOpacity
            key={section}
            onPress={() => {
              setActiveSection(section);
              setIsEditing(false);
            }}
            style={[
              styles.tabButton,
              {
                borderBottomColor: activeSection === section ? theme.primary : 'transparent',
                borderBottomWidth: activeSection === section ? 3 : 0,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeSection === section ? theme.primary : theme.textSecondary,
                  fontWeight: activeSection === section ? 'bold' : '600',
                  fontSize: 14 * fontScale,
                },
              ]}
            >
              {section === 'personal' ? 'Personal' : section === 'medical' ? 'Medical' : 'Emergency'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Profile Active content */}
      <View style={styles.contentContainer}>
        {activeSection === 'personal' && renderPersonalView()}
        {activeSection === 'medical' && renderMedicalView()}
        {activeSection === 'emergency' && renderEmergencyView()}

        {/* Action button row */}
        <View style={styles.actionRow}>
          {isEditing ? (
            <>
              {activeSection === 'personal' ? (
                <Button
                  title="Save Updates"
                  onPress={handleSubmit(onSubmitPersonal)}
                  variant="primary"
                  style={{ flex: 1, marginRight: 8 }}
                  disabled={!isValid}
                />
              ) : (
                <Button
                  title="Save Updates"
                  onPress={handleSave}
                  variant="primary"
                  style={{ flex: 1, marginRight: 8 }}
                />
              )}
              <Button
                title="Cancel"
                onPress={() => {
                  setIsEditing(false);
                  setEditingContactId(null);
                  if (activeSection === 'personal') {
                    reset({
                      name: name,
                      age: age,
                      gender: gender,
                      dob: dob,
                      bloodGroup: bloodGroup,
                      height: height,
                      weight: weight,
                    });
                  }
                }}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </>
          ) : (
            activeSection !== 'emergency' ? (
              <Button
                title={`Edit ${activeSection === 'personal' ? 'Personal' : 'Medical'} Details`}
                onPress={() => {
                  if (activeSection === 'personal') {
                    reset({
                      name: name,
                      age: age,
                      gender: gender,
                      dob: dob,
                      bloodGroup: bloodGroup,
                      height: height,
                      weight: weight,
                    });
                  }
                  setIsEditing(true);
                }}
                variant="primary"
                style={{ width: '100%' }}
              />
            ) : (
              contactsList.length < 5 && (
                <Button
                  title="Add Emergency Contact"
                  onPress={startAddingContact}
                  variant="primary"
                  style={{ width: '100%' }}
                />
              )
            )
          )}
        </View>

        {!isEditing && (
          <Button
            title="Log Out Session"
            onPress={handleLogout}
            variant="danger"
            style={{ width: '100%', marginTop: 24, marginBottom: 40 }}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F4FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontWeight: '900',
  },
  profileEmail: {
    fontWeight: '500',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 48,
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    textTransform: 'uppercase',
  },
  contentContainer: {
    padding: 16,
  },
  viewCard: {
    paddingVertical: 8,
  },
  formCard: {
    padding: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  label: {
    fontWeight: '600',
  },
  value: {
    fontWeight: '700',
    textAlign: 'right',
  },
  dataBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 8,
  },
  blockLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  blockValue: {
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  settingsHeaderBtn: {
    padding: 8,
    marginRight: 16,
  },
  dataRowPlain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  dropdownContainer: {
    marginVertical: 8,
    width: '100%',
  },
  inputLabel: {
    marginBottom: 6,
    fontWeight: '600',
  },
  dropdownTrigger: {
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    minHeight: 48,
  },
  errorText: {
    marginTop: 4,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalContent: {
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownModalTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  dropdownOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  datePickerContent: {
    borderRadius: 12,
    padding: 16,
    width: '95%',
    maxWidth: 450,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 250,
    marginVertical: 16,
  },
  columnContainer: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'stretch',
  },
  columnHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  columnScroll: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  pickerItem: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemText: {
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
