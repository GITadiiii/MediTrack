import React from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions, Platform } from 'react-native';
import { useAppStore } from '../store/appStore';
import { COLORS, getFontScale } from '../config/theme';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
  type?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  multiline = false,
  numberOfLines = 1,
  style,
  type,
}) => {
  const { themeMode, contrastMode, fontSizeScale } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.label,
          {
            color: theme.text,
            fontSize: 15 * fontScale,
            fontWeight: contrastMode === 'high' ? '900' : '600',
          },
        ]}
      >
        {label}
      </Text>
      {Platform.OS === 'web' && type === 'date' ? (
        React.createElement('input', {
          type: 'date',
          value: value,
          onChange: (e: any) => onChangeText(e.target.value),
          style: StyleSheet.flatten([
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.card,
              borderColor: error ? theme.danger : theme.border,
              borderWidth: error || contrastMode === 'high' ? 2 : 1,
              fontSize: 16 * fontScale,
              paddingTop: multiline ? 12 : 10,
              paddingBottom: multiline ? 12 : 10,
              paddingLeft: 14,
              paddingRight: 14,
              minHeight: multiline ? 80 : 48,
              borderRadius: 8,
              outline: 'none',
              fontFamily: 'inherit',
            },
            style
          ]),
        })
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.card,
              borderColor: error ? theme.danger : theme.border,
              borderWidth: error || contrastMode === 'high' ? 2 : 1,
              fontSize: 16 * fontScale,
              paddingVertical: multiline ? 12 : 10,
              minHeight: multiline ? 80 : 48,
            },
          ]}
        />
      )}
      {error && (
        <Text
          style={[
            styles.errorText,
            {
              color: theme.danger,
              fontSize: 13 * fontScale,
              fontWeight: '700',
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  label: {
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 14,
    textAlignVertical: 'top',
  },
  errorText: {
    marginTop: 4,
  },
});
