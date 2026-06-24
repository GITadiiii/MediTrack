import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAppStore } from '../../store/appStore';
import { COLORS, getFontScale } from '../../config/theme';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { IconContainer } from '../../components/IconContainer';
import { Bell, AlertTriangle, Pill, Calendar } from 'lucide-react-native';

interface NotificationsCenterScreenProps {
  navigation: any;
}

export const NotificationsCenterScreen: React.FC<NotificationsCenterScreenProps> = ({ navigation }) => {
  const { themeMode, contrastMode, fontSizeScale, notifications, markNotificationAsRead, clearAllNotifications } = useAppStore();
  const theme = COLORS[themeMode][contrastMode];
  const fontScale = getFontScale(fontSizeScale);

  const getIconForType = (type: string, color: string) => {
    switch (type) {
      case 'medication_refill':
        return <AlertTriangle size={20} color={color} />;
      case 'medication_reminder':
        return <Pill size={20} color={color} />;
      case 'appointment':
        return <Calendar size={20} color={color} />;
      case 'daily_check':
      default:
        return <Bell size={20} color={color} />;
    }
  };

  const handleClearAll = () => {
    Alert.alert('Clear Notifications', 'Are you sure you want to clear your notification alerts history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: clearAllNotifications },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <PageHeader title="Notifications" icon={<Bell color="#FFFFFF" size={20} />} />
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={[styles.clearBtnText, { color: theme.danger, fontSize: 15 * fontScale }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.scrollList}>
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconContainer size={64} backgroundColor="#EFF6FF">
              <Bell size={32} color="#2563EB" />
            </IconContainer>
            <Text style={{ color: theme.textSecondary, fontSize: 16 * fontScale, marginTop: 16, textAlign: 'center' }}>
              No notifications yet. You will see alerts for low stock refills and follow-up sessions here.
            </Text>
            <Button
              title="Return to Dashboard"
              onPress={() => navigation.goBack()}
              variant="primary"
              style={{ marginTop: 24 }}
            />
          </View>
        ) : (
          notifications.map((notif) => (
            <Card
              key={notif.id}
              style={[
                styles.notifCard,
                {
                  opacity: notif.isRead ? 0.7 : 1,
                  borderLeftColor: notif.isRead ? theme.border : theme.primary,
                  borderLeftWidth: 4,
                },
              ]}
            >
              <View style={styles.notifContent}>
                <IconContainer size={40} backgroundColor={notif.isRead ? '#F1F5F9' : '#EFF6FF'}>
                  {getIconForType(notif.type, notif.isRead ? theme.textSecondary : '#2563EB')}
                </IconContainer>
                
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.notifTitle, { color: theme.text, fontSize: 15 * fontScale, fontWeight: notif.isRead ? 'bold' : '900' }]}>
                    {notif.title}
                  </Text>
                  <Text style={[styles.notifMsg, { color: theme.textSecondary, fontSize: 14 * fontScale }]}>
                    {notif.message}
                  </Text>
                  <Text style={[styles.timestamp, { color: theme.textSecondary, fontSize: 11 * fontScale }]}>
                    {new Date(notif.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </Text>
                </View>
                
                {!notif.isRead && (
                  <TouchableOpacity
                    onPress={() => markNotificationAsRead(notif.id)}
                    style={[styles.readBtn, { backgroundColor: theme.primaryLight }]}
                  >
                    <Text style={[styles.readBtnTxt, { color: theme.primary, fontSize: 12 * fontScale }]}>Mark Read</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontWeight: 'bold',
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
  notifCard: {
    padding: 12,
    marginBottom: 10,
  },
  notifContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifTitle: {
    marginBottom: 2,
  },
  notifMsg: {
    lineHeight: 18,
    marginVertical: 2,
  },
  timestamp: {
    fontWeight: '500',
    marginTop: 2,
  },
  readBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readBtnTxt: {
    fontWeight: 'bold',
  },
});
