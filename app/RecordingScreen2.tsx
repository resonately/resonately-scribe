import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Alert, Animated, AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import NetInfo from '@react-native-community/netinfo';
import RecordingList from './RecordingList';
import RecordingButton from './RecordingButton';
import { useKeepAwake } from 'expo-keep-awake';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import Timer from '@/components/Timer';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import analytics from '@react-native-firebase/analytics';
import { FAB, IconButton, useTheme, ActivityIndicator } from 'react-native-paper';
import { Appointment } from './CalendarAppointments';
import { RootStackParamList } from './_layout';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  getRecordingUri,
  storeRecordingLocally,
  uploadChunkToServer,
  listRecordingsAsJson,
  deleteRecordingFolder,
  deleteStaleRecordings,
  deleteRecordingsByAge
} from './RecordUtils';
import { saveRecordings, loadRecordings, clearRecordings, displayRecordings } from './AsyncStorageUtils';
import LogoutChecker from './LogoutChecker';
import uuid from 'react-native-uuid';
import CalendarAppointments from './CalendarAppointments';
import TimelineCalendarScreen from './SampleTimeline';
import Constants from 'expo-constants';
import AppointmentManager from './AppointmentManager';
import TrackPlayer, { State } from 'react-native-track-player';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.rsn8ly.xyz';


export interface Recording {
  id: string;
  startDate: string;
  appointmentId: string;
  endDate: string | null;
  status: string;
  sound: Audio.Sound | null;
  chunks: Chunk[];
  chunkCounter: number;
}

export interface Chunk {
  position: number;
  isLastChunk: boolean;
  uri: string;
  startTime: string;
  endTime: string;
  status: string;
  retryCount: number;
}

// Define the navigation prop type
type RecordingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Update the Props type to include the navigation prop
type Props = {
  navigation: RecordingScreenNavigationProp;
};

const MAX_CHUNK_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const CHUNK_UPLOAD_FREQUENCY = 10 * 1000; // 10 seconds
const DELETE_RECORDINGS_RUN_REQUENCY = 60 * 1000; // every minute
const MAX_RECORDINGS_AGE = 2 * 24 * 60 * 60 * 1000; // 2 days
const MAX_DIR_AGE = 2 * 24 * 60 * 60 * 1000; // 10 days

const RecordingScreen: React.FC<Props> = ({ navigation }): JSX.Element => {
  useKeepAwake(); // Keeps the app awake while this component is mounted

  const { tenantName } = useAuth().tenantDetails;

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false); // New state for pause
  const [isConnected, setIsConnected] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('');
  const connectionAnim = useRef(new Animated.Value(0)).current;
  const recordingIdRef = useRef<string | null>(null);
  const appointmentIdRef = useRef<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const recordingsRef = useRef<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkStartTimeRef = useRef<Date | null>(null); // Track chunk start time
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [initialStartTime, setInitialStartTime] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const refreshAppointmentsRef = useRef<() => void>(() => {});



  const theme = useTheme();

  const updateRecordingsState = (newRecordings: Recording[]) => {
    recordingsRef.current = newRecordings;
    setRecordings(newRecordings);
  };

  const updateRecordingId = (newRecordingId: string | null) => {
    recordingIdRef.current = newRecordingId;
    setRecordingId(newRecordingId);
  };

  const updateAppointmentId = (newAppointmentId: string | null) => {
    appointmentIdRef.current = newAppointmentId;
    setAppointmentId(newAppointmentId);
  };

  
  const setRefreshAppointments = (refreshFunc: () => void) => {
    refreshAppointmentsRef.current = refreshFunc;
  };

  const deleteOldRecordings = async () => {
    const recordingsAsJson = await listRecordingsAsJson();
    await deleteRecordingsByAge(recordingsAsJson, MAX_RECORDINGS_AGE);
    console.log(recordingsAsJson);
    console.log('Running deleteOldRecordings function...');
    // await deleteStaleRecordings(MAX_DIR_AGE * 1000);

    // Fetch recordings from storage
    const savedRecordings = await loadRecordings();
    recordingsRef.current = savedRecordings;

    // Iterate over each recording
    for (const recording of recordingsRef.current) {
      const startTime = new Date(recording.startDate).getTime();
      const currentTime = Date.now();

      // Check if the recording is older than 5 seconds
      if (currentTime - startTime < MAX_RECORDINGS_AGE) {
        console.log(`Recording ${recording.id} is still young. Ignoring.`);
        continue;
      }

      if (recording.chunks.length > 0) {
        // Get the URI of the first chunk
        const firstChunkUri = recording.chunks[0].uri;

        try {
          // Find the directory of the chunk URI and delete it
          console.log(`Deleting directory for recording ${recording.id}...`);
          await deleteRecordingFolder(firstChunkUri);
          console.log(`Directory deleted for recording ${recording.id}.`);
        } catch (error) {
          console.error(`Failed to delete directory for recording ${recording.id}:`, error);
        }
      } else {
        console.log(`Recording ${recording.id} has no chunks. Deleting recording.`);
      }

      // Remove the recording from the list
      recordingsRef.current = recordingsRef.current.filter(rec => rec.id !== recording.id);
      console.log(`Recording ${recording.id} deleted from the list.`);
    }

    // Update the recordings storage
    await saveRecordings(recordingsRef.current);
    updateRecordingsState(recordingsRef.current);
    console.log('Recordings storage updated.');
  };
  
  useEffect(() => {
    AppointmentManager.uploadChunksPeriodically();    

  }, []);
  
  useEffect(() => {
    uploadIntervalRef.current = setInterval(async () => {
        AppointmentManager.uploadChunksPeriodically();
    }, CHUNK_UPLOAD_FREQUENCY); // 10 seconds interval
    

    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);


  const handleDelete = async (id: string) => {
    const updatedRecordings = recordingsRef.current.filter((rec) => rec.id !== id);
    await saveRecordings(updatedRecordings); // Save recordings after deleting an item
    updateRecordingsState(updatedRecordings);
  };

  const clearAsyncStorage = async () => {
    await clearRecordings();
    updateRecordingsState([]);
  };

  const clearRecordingById = async (recordingId: string) => {
    const savedRecordings = await loadRecordings();
    const updatedRecordings = savedRecordings.filter((rec: any) => rec.id !== recordingId);
    await saveRecordings(updatedRecordings);
    updateRecordingsState(updatedRecordings);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
        console.log('App has come to the foreground!');
        // Log the event when the app comes to the foreground
        analytics().logEvent('app_state_change', {
            state: 'foreground',
        });
    }

    if (nextAppState.match(/inactive|background/)) {
        console.log('App is in the background');
        // Log the event when the app goes to the background
        analytics().logEvent('app_state_change', {
            state: 'background',
        });
    }

    setAppState(nextAppState);
  };

  const handleNewAppointment = () => {
    // throw new Error("Function not implemented two.");
      setSelectedEvent(null);
      navigation.navigate("NewAppointmentScreen", {
        refreshAppointments: refreshAppointmentsRef.current,
        setAppointmentId: updateAppointmentId,
        isMeetingStarted: isRecording,
        event: selectedEvent,
      });
      analytics().logEvent('open_new_appointment_screen');
  }


  return (
    <View style={styles.container}>
  {!isConnected && (
    <View style={styles.connectionBar}>
      <Text style={styles.connectionText}>No Internet Connection</Text>
    </View>
  )}
  {isMounted && (
    <>
      <CalendarAppointments 
        setSelectedEvent={setSelectedEvent} 
        setRefreshAppointments={setRefreshAppointments}
        handleNewAppointment={handleNewAppointment}
      />
      {!isRecording && (
        <FAB
          style={{
              position: 'absolute',
              margin: 16,
              right: 0,
              bottom: 0,
              backgroundColor: theme.colors.primary, // Change background color conditionally
              borderWidth: 0, // Add border for outlined style
              borderColor: theme.colors.primary, // Use primary color for border
          }}
          icon={() => <MaterialIcons name="add-circle-outline" size={25} color="white" />}
          onPress={handleNewAppointment}
          color={"white"} // Change icon color conditionally
          label={"New Appointment"}
        />
      )}
    </>
  )}
</View>
  );  
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  connectionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#FFC107', // Yellow color for "No Internet"
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Make sure the bar is above other elements
  },
  connectionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 0,
    position: 'relative',
  },
  bottomSheet: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 6,
  },
  fabContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  startButton: {
    color: 'white',
  },
  stopButton: {
    backgroundColor: 'white',
    borderColor: 'red',
    borderWidth: 2,
    color: 'red',
    marginVertical: 10, // Add vertical margin to separate from other elements
    justifyContent: 'center', // Center the content vertically
  },
  muted: {
    borderColor: 'red',
    color: 'red',
  },
  soundBars: {
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  fabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center the button
    width: '100%',
    paddingHorizontal: 40, // Add horizontal padding
    marginTop: 0, // Ensure all elements start from the same vertical position
  },
  fab: {
    height: 56,
    marginBottom: 50, // Add bottom padding
    paddingHorizontal: 20, // Add horizontal padding
  },
  fullWidthFab: {
    width: '100%',
  },
  endVisitButton: {
    width: '40%',
    justifyContent: 'center',
    marginBottom: 20, // Add bottom padding
    paddingHorizontal: 0, // Add horizontal padding
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '50%',
    marginBottom: 20, // Add bottom padding
    paddingHorizontal: 0, // Add horizontal padding
  },
  muteButton: {
    backgroundColor: 'white',
    borderColor: 'gray',
    borderWidth: 1,
    color: 'black',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    width: '20%',
    marginVertical: 0,
    marginBottom: 20, // Add bottom padding
    paddingHorizontal: 0, // Add horizontal padding
  },
  createMeetingFab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0
  },
  
});

export default RecordingScreen;
