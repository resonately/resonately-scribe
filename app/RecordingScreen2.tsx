import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, AppState, AppStateStatus } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import NetInfo from '@react-native-community/netinfo';
import { useKeepAwake } from 'expo-keep-awake';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import analytics from '@react-native-firebase/analytics';
import CreateMeetingSheet from './CreateMeetingSheet';
import { FAB, useTheme } from 'react-native-paper';
import { Appointment } from './CalendarAppointments';
import { RootStackParamList } from './_layout';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CalendarAppointments from './CalendarAppointments';
import AppointmentManager from './AppointmentManager';
import { useSQLiteContext } from 'expo-sqlite';
import DatabaseService from './DatabaseService';
import { Recording } from './types';
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { useAuth } from './AuthContext';
import LiveAudioManager from './LiveAudioManager';

// Define the navigation prop type
type RecordingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Update the Props type to include the navigation prop
type Props = {
  navigation: RecordingScreenNavigationProp;
};

const CHUNK_UPLOAD_FREQUENCY = 10 * 1000; // 10 seconds
const DELETE_RECORDINGS_RUN_REQUENCY = 60 * 1000; // every minute
const MAX_RECORDINGS_AGE = 2 * 24 * 60 * 60 * 1000; // 2 days
const MAX_DIR_AGE = 2 * 24 * 60 * 60 * 1000; // 10 days

const RecordingScreen: React.FC<Props> = ({ navigation }): JSX.Element => {
  useKeepAwake(); // Keeps the app awake while this component is mounted

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false); // New state for pause
  const [isConnected, setIsConnected] = useState(true);
  const connectionAnim = useRef(new Animated.Value(0)).current;
  const recordingIdRef = useRef<string | null>(null);
  const appointmentIdRef = useRef<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const recordingsRef = useRef<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const createMeetingSheetRef = useRef<BottomSheet>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [initialStartTime, setInitialStartTime] = useState<number | null>(null);
  const [iscreateMeetingSheetOpen, setIscreateMeetingSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const refreshAppointmentsRef = useRef<() => void>(() => {});

  const theme = useTheme();
  const db = useSQLiteContext();
  useDrizzleStudio(db);

  const { tenantName } = useAuth().tenantDetails;

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

  const getData = async () => {
	  const result = await db.getAllAsync<Recording>('SELECT * FROM recordings;');
	  console.log(result);
  }

  useEffect(() => {
	  DatabaseService.getInstance().initDb();
    LiveAudioManager.getInstance().setTenantName(tenantName);
    // DatabaseService.getInstance().deleteRecording('af4ea3ad-561a-4e7d-956f-926cf95ad9cf');
    // LiveAudioManager.getInstance().deleteAllFiles();
    setTimeout(() => {
    LiveAudioManager.getInstance().uploadChunksToServer();
    }, 500);
	  setTimeout(() => {
		  getData();
	  }, 5000);
  }, []);

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
						setIsSheetOpen={setIscreateMeetingSheetOpen} 
						setRefreshAppointments={setRefreshAppointments}
					/>
					<CreateMeetingSheet
						bottomSheetRef={createMeetingSheetRef}
						isSheetOpen={iscreateMeetingSheetOpen}
						setIsSheetOpen={setIscreateMeetingSheetOpen}
						refreshAppointments={refreshAppointmentsRef.current}
						event={selectedEvent} // Pass the selected event to the sheet
						// handleJoinMeeting={startRecording}
						// handleMuteToggle={handleMuteToggle}
						// handleEndCall={stopRecording}
						setAppointmentId={updateAppointmentId}
						isMuted={isPaused}
						isMeetingStarted={isRecording}
						initialStartTime={initialStartTime}
						navigation={navigation}
						collapseSheet={() => {
						setIscreateMeetingSheetOpen(!iscreateMeetingSheetOpen);
						}}
					/>
					{!isRecording && (
						<FAB
						style={{
							position: 'absolute',
							margin: 16,
							right: 0,
							bottom: 0,
							backgroundColor: iscreateMeetingSheetOpen ? 'white' : theme.colors.primary, // Change background color conditionally
							borderWidth: iscreateMeetingSheetOpen ? 1 : 0, // Add border for outlined style
							borderColor: theme.colors.primary, // Use primary color for border
						}}
						icon={() => iscreateMeetingSheetOpen ? <MaterialIcons name="close" size={25} color={theme.colors.primary} />:<MaterialIcons name="add-circle-outline" size={25} color="white" />}
						onPress={() => {
							setSelectedEvent(null);
							setIscreateMeetingSheetOpen(!iscreateMeetingSheetOpen);
							if (!iscreateMeetingSheetOpen) {
								updateAppointmentId(null);
								analytics().logEvent('open_new_appointment_sheet');
							} else {
								analytics().logEvent('close_new_appointment_sheet');
							}
						}}
						color={iscreateMeetingSheetOpen ? theme.colors.primary : "white"} // Change icon color conditionally
						label={iscreateMeetingSheetOpen ? "" : "New Appointment"}
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
