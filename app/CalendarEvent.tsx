import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

interface Appointment {
  start: string;
  end: string;
  title: string;
  summary?: string;
  status?: string;
}

interface CalendarEventProps {
  event: Appointment;
  onPress: () => void;
}

const CalendarEvent: React.FC<CalendarEventProps> = ({ event, onPress }) => {
  const theme = useTheme();

  const renderStatusIcon = () => {
    switch (event.status) {
      // case 'created':
      //   return <View style={[styles.statusCircle, { backgroundColor: 'yellow' }]} />;
      case 'in progress':
        return <View style={[styles.statusCircle, { backgroundColor: 'yellow' }]} />;
      case 'completed':
        return null;
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.touchable}>
      <Card style={[styles.event, { backgroundColor: theme.colors.primary }]}>
        <Card.Content style={styles.cardContent}>
          <Text style={[styles.eventTitle, { color: theme.colors.onPrimary }]}>{event.title}</Text>
          <View style={styles.statusContainer}>
            {renderStatusIcon()}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    width: '100%',
    height: '100%',
    marginTop: -5, // Adjust this value to stretch more on top
    marginLeft: -5, // Adjust this value to stretch more on the left
    marginRight: 5, // Adjust this value to stretch more on the right
  },
  event: {
    flex: 1,
    borderRadius: 5,
    width: '100%',
    height: '100%',
    padding: -10,
    marginBottom: -11,
    marginTop: -13,
    marginRight: 20,
    paddingRight: 20,
    position: 'relative', // Add this line
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 0,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    margin: 0,
    padding: 0,
  },
  statusContainer: {
    position: 'absolute', // Add this line
    top: 20, // Adjust this value to position correctly
    right: -10, // Adjust this value to position correctly
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default CalendarEvent;
