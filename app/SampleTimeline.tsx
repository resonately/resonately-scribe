import React, { useState, useEffect, useCallback } from 'react';
import { Alert, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { CalendarProvider, ExpandableCalendar, TimelineList } from 'react-native-calendars';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import { fetchAppointments } from './RecordUtils';
import { useAuth } from './AuthContext';
import CalendarEvent from './CalendarEvent';

export interface Appointment {
  start: string;
  end: string;
  title: string;
  summary?: string;
  patient_name?: string;
  appointment_type?: string;
}

interface CalendarAppointmentsProps {
  setSelectedEvent: (event: Appointment | null) => void;
  setIsSheetOpen: (isOpen: boolean) => void;
  setRefreshAppointments: (refreshFunc: () => void) => void;
}

const CalendarAppointments: React.FC<CalendarAppointmentsProps> = ({ setSelectedEvent, setIsSheetOpen, setRefreshAppointments }) => {
  const theme = useTheme();
  const { tenantName } = useAuth().tenantDetails;
  const [events, setEvents] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const localDate = new Date();
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  });
  const [markedDates, setMarkedDates] = useState({});

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedAppointments = await fetchAppointments(tenantName);
      const mappedAppointments = mapAppointmentsToTimeline(fetchedAppointments);
      setEvents(mappedAppointments);

      // Update marked dates
      const newMarkedDates: any = {};
      Object.keys(mappedAppointments)?.forEach(date => {
        newMarkedDates[date] = { marked: true };
      });
      newMarkedDates[selectedDate] = { ...newMarkedDates[selectedDate], selected: true };
      setMarkedDates(newMarkedDates);

    } catch (error) {
      console.error('Error fetching appointments:', error);
      setEvents({}); // Ensure the timeline renders even if there are no events
    } finally {
      setLoading(false);
    }
  }, [selectedDate, tenantName]);

  useEffect(() => {
    const fetchAndUpdate = async () => {
      await loadAppointments();
      setTimeout(fetchAndUpdate, 5000); // Refresh data every 5 seconds
    };
    fetchAndUpdate();
  }, [loadAppointments]);

  useEffect(() => {
    setRefreshAppointments(loadAppointments);
  }, [setRefreshAppointments, loadAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const mapAppointmentsToTimeline = (appointments: any[]): any => {
    const events: any = {};
    appointments?.forEach(appointment => {
      const localStart = convertUTCToLocal(appointment.expected_appointment_start_time);
      const localEnd = convertUTCToLocal(appointment.expected_appointment_end_time);
      const date = localStart.split(' ')[0]; // Extract date from local start time

      if (!events[date]) {
        events[date] = [];
      }

      events[date].push({
        ...appointment, // Include all properties from the appointment object
        start: localStart,
        end: localEnd,
        title: appointment.appointment_title || 'No title',
        summary: `${appointment.patient_name} - ${appointment.appointment_type}`,
      });
    });
    return events;
  };

  const convertUTCToLocal = (utcString: string) => {
    const utcDate = new Date(utcString);
    const localDate = new Date(utcDate.getTime()); // Adjust for timezone offset

    const dateOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const localString = localDate.toLocaleString('en-GB', dateOptions);
    const [date, time] = localString.split(', ');
    const [day, month, year] = date.split('/');
    const formattedDate = `${year}-${month}-${day}`;

    return `${formattedDate} ${time}`;
  };

  const handleEventPress = (event: Appointment) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
  };

  const renderEvent = (event: Appointment) => (
    <CalendarEvent event={event} onPress={() => handleEventPress(event)} />
  );

  const getInitialTime = (events: any, date: string) => {
    if (events[date] && events[date].length > 0) {
      const firstEvent = events[date][0];
      const [hours, minutes] = firstEvent.start.split(' ')[1].split(':');
      return { hour: parseInt(hours, 10), minutes: parseInt(minutes, 10) };
    }
    return { hour: 9, minutes: 0 };
  };

  return (
    <CalendarProvider
      date={selectedDate}
      onDateChanged={(date) => {
        setSelectedDate(date);
      }}
      style={{ backgroundColor: 'transparent' }}
    >
      <ExpandableCalendar
        firstDay={1}
        markedDates={markedDates}
        theme={{
          selectedDayBackgroundColor: theme.colors.primary,
          todayTextColor: theme.colors.secondary,
          dotColor: theme.colors.primary,
          backgroundColor: 'transparent',
        }}
        style={{ backgroundColor: 'transparent' }}
      />
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
          }
        >
          <TimelineList
            events={events}
            timelineProps={{
              format24h: true,
              onEventPress: handleEventPress,
              renderEvent,
              theme: {
                todayDotColor: theme.colors.primary,
                dotColor: theme.colors.primary,
                backgroundColor: 'transparent',
              },
            }}
            showNowIndicator
            initialTime={getInitialTime(events, selectedDate)}
            style={{ backgroundColor: 'transparent' }}
          />
        </ScrollView>
      )}
    </CalendarProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CalendarAppointments;
