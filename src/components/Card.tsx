import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppStore } from '../store/appStore';
import { COLORS } from '../config/theme';

interface CardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  const { themeMode, contrastMode } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: contrastMode === 'high' ? 2 : 1,
    },
    contrastMode !== 'high' && styles.shadow,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
});
