import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppStore } from '../store/appStore';
import { COLORS, getFontScale, TOUCH_TARGET } from '../config/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) => {
  const { themeMode, contrastMode, fontSizeScale } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const getColors = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: theme.card,
          text: theme.primary,
          border: theme.primary,
        };
      case 'danger':
        return {
          bg: theme.danger,
          text: '#FFFFFF',
          border: theme.danger,
        };
      case 'success':
        return {
          bg: theme.success,
          text: '#FFFFFF',
          border: theme.success,
        };
      case 'primary':
      default:
        return {
          bg: theme.primary,
          text: '#FFFFFF',
          border: theme.primary,
        };
    }
  };

  const colors = getColors();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? theme.border : colors.bg,
          borderColor: contrastMode === 'high' ? theme.border : colors.border,
          borderWidth: contrastMode === 'high' ? 2 : 1,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.primary : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            styles.text,
            {
              color: disabled ? theme.textSecondary : colors.text,
              fontSize: 16 * fontScale,
              fontWeight: contrastMode === 'high' ? '900' : '700',
            },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET.minHeight,
    paddingHorizontal: TOUCH_TARGET.padding * 1.5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 6,
  },
  text: {
    textAlign: 'center',
  },
});
