import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, StyleSheet, ScrollView, RefreshControl, View, Text } from 'react-native';
import { CalendarProvider, ExpandableCalendar, TimelineList } from 'react-native-calendars';
import { useTheme, ActivityIndicator } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { fetchAppointments } from './RecordUtils';
import { useAuth } from './AuthContext';
import CalendarEvent from './CalendarEvent';
import analytics from '@react-native-firebase/analytics';

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
  const [events, setEvents] = useState<any>([{}]);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const localDate = new Date();
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  });
  const [markedDates, setMarkedDates] = useState({});
  const [isConnected, setIsConnected] = useState(true);
  const initialScrollDoneRef = useRef(false);

  const timelineListRef = useRef<any>(null); // Create a ref for the TimelineList

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state != null && state.isConnected != null) {
        setIsConnected(state.isConnected);
        analytics().logEvent('network_status_change', {
          is_connected: state.isConnected,
        });
      }
    });

    // Cleanup the listener on component unmount
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (events && Object.keys(events).length > 0) {
      // Reset initial scroll state when the date changes
      setInitialScrollDone(false);
    }
  }, [selectedDate, events]);

  useEffect(() => {
    if (!initialScrollDoneRef.current && timelineListRef.current) {
      const initialTime = getInitialTime(events, selectedDate);
      setTimeout(() => {
        timelineListRef.current?.scrollTo({ hour: initialTime.hour, minute: initialTime.minutes });
        initialScrollDoneRef.current = true; // Mark the initial scroll as done
      }, 300); // Slight delay to ensure the component is rendered
    }
  }, [events, selectedDate]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [selectedDate]);

  const calculateDateRange = (date: string) => {
    const selectedDate = new Date(date);
    const startDate = new Date(selectedDate);
    const endDate = new Date(selectedDate);
    const fetchWindow = 30;
    startDate.setDate(selectedDate.getDate() - fetchWindow);
    endDate.setDate(selectedDate.getDate() + fetchWindow);

    const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const loadAppointments = useCallback(async () => {
    try {
      const { startDate, endDate } = calculateDateRange(selectedDate);
      const fetchedAppointments = await fetchAppointments(tenantName, startDate, endDate);
      const mappedAppointments = mapAppointmentsToTimeline(fetchedAppointments);
      setEvents(JSON.parse(JSON.stringify(mappedAppointments)));

      // Update marked dates
      const newMarkedDates = {};
      Object.keys(mappedAppointments).forEach(date => {
        newMarkedDates[date] = { marked: true };
      });
      newMarkedDates[selectedDate] = { ...newMarkedDates[selectedDate], selected: true };
      setMarkedDates(JSON.parse(JSON.stringify(newMarkedDates)));

      analytics().logEvent('load_appointments', {
        start_date: startDate,
        end_date: endDate,
      });

    } catch (error) {
      console.error('Error fetching appointments:', error);
      analytics().logEvent('fetch_appointments_error', {
        error: error.message,
      });
    }
  }, [selectedDate, tenantName]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const fetchAndUpdate = async () => {
      await loadAppointments();
      timeoutId = setTimeout(fetchAndUpdate, 5000); // Refresh data every 5 seconds
    };

    fetchAndUpdate();

    // Cleanup function to clear the timeout when the component unmounts
    return () => clearTimeout(timeoutId);
  }, [loadAppointments]);

  useEffect(() => {
    setRefreshAppointments(loadAppointments);
  }, [setRefreshAppointments, loadAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
    analytics().logEvent('refresh_appointments', {
      date: selectedDate,
    });
  };

  const mapAppointmentsToTimeline = (appointments: any[]): any => {
    const events = {};
    appointments.forEach(appointment => {
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
    analytics().logEvent('select_event', {
      event_title: event.title,
      event_start: event.start,
      event_end: event.end,
    });
  };

  const renderEvent = (event: Appointment) => (
    <CalendarEvent event={event} onPress={() => handleEventPress(event)} />
  );

  const isToday = (date: string) => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return date === todayString;
  };

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
        setInitialScrollDone(false); // Reset scroll flag when date changes
        analytics().logEvent('date_change', {
          new_date: date,
        });
      }}
      style={{ backgroundColor: 'transparent' }}
    >
      {!isConnected && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>No internet connection</Text>
        </View>
      )}
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
      <ScrollView>
        <TimelineList
          scrollToNow
          ref={timelineListRef} // Assign the ref to the TimelineList
          events={events}
          timelineProps={{
            format24h: false,
            onEventPress: handleEventPress,
            renderEvent,
            theme: {
              todayDotColor: theme.colors.primary,
              dotColor: theme.colors.primary,
              backgroundColor: 'transparent',
            },
          }}
          showNowIndicator
          initialTime={{ hour: 9, minutes: 0 }}
          style={{ backgroundColor: 'transparent' }}
        />
      </ScrollView>
    </CalendarProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    backgroundColor: '#FFC107',
    padding: 10,
    height: 40, // Set a height to ensure vertical centering
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
  },
  bannerText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center', // Ensure text is centered
  },
});

export default CalendarAppointments;
