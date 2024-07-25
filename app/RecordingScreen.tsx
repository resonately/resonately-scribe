import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Alert, ActivityIndicator, Animated } from 'react-native';
import { Audio } from 'expo-av';
import BottomSheet from '@gorhom/bottom-sheet';
import NetInfo from '@react-native-community/netinfo';
import RecordingList from './RecordingList';
import RecordingButton from './RecordingButton';
import { useKeepAwake } from 'expo-keep-awake';
import * as SecureStore from 'expo-secure-store';
import { useTenant } from './TenantContext';
import Timer from '@/components/Timer';
import { FAB } from 'react-native-paper';
import {
  getRecordingUri,
  storeRecordingLocally,
  uploadRecording,
  deleteRecordingFolder,
  deleteStaleRecordings
} from './RecordUtils';
import { saveRecordings, loadRecordings, clearRecordings, displayRecordings } from './AsyncStorageUtils';
import AnimatedSoundBars from '@/components/AnimatedSoundBars';
import LogoutChecker from './LogoutChecker';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.rsn8ly.xyz';

interface Recording {
  id: string;
  startDate: string;
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

const MAX_CHUNK_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const CHUNK_UPLOAD_FREQUENCY = 10 * 1000; // 10 seconds
const DELETE_RECORDINGS_RUN_REQUENCY = 60 * 1000; // every minute
const MAX_RECORDINGS_AGE = 2 * 24 * 60 * 60 * 1000; // 2 day
const MAX_DIR_AGE = 2 * 24 * 60 * 60 * 1000; // 10 days

const RecordingScreen = (): JSX.Element => {
  useKeepAwake(); // Keeps the app awake while this component is mounted

  const { tenantName } = useTenant().tenantDetails;

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false); // New state for pause
  const [isConnected, setIsConnected] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('');
  const connectionAnim = useRef(new Animated.Value(0)).current;
  const recordingIdRef = useRef<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const recordingsRef = useRef<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkStartTimeRef = useRef<Date | null>(null); // Track chunk start time
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateRecordingsState = (newRecordings: Recording[]) => {
    recordingsRef.current = newRecordings;
    setRecordings(newRecordings);
  };

  const updateRecordingId = (newRecordingId: string | null) => {
    recordingIdRef.current = newRecordingId;
    setRecordingId(newRecordingId);
  };

  const handleChunkCreation = async (isLastChunk: boolean = false) => {
    try {
      await stopAndUnloadRecording(recordingRef.current);
      const localFileUri = await handleRecordingUri(recordingRef.current);

      if (localFileUri) {
        const chunk = createChunk(localFileUri, chunkStartTimeRef.current!, new Date(), isLastChunk);
        await addChunkToAsyncStorage(chunk); // Add chunk to async storage
        incrementChunkCounter();
      }

    } catch (error: any) {
      console.error(error.message);
    }
  };

  const deleteOldRecordings = async () => {
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
    const intervalId = setInterval(deleteOldRecordings, DELETE_RECORDINGS_RUN_REQUENCY); // Run every 10 seconds

    // Clear the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const addChunkToAsyncStorage = async (chunk: Chunk) => {
    const updatedRecordings = recordingsRef.current.map((rec) => {
      if (rec.id === recordingIdRef.current) {
        if (!rec.chunks) {
          rec.chunks = [];
        }
        rec.chunks.push(chunk);
      }
      return rec;
    });
    console.log('addChunkToAsyncStorage');
    console.log(updatedRecordings);
    await saveRecordings(updatedRecordings); // Save updated recordings
    updateRecordingsState(updatedRecordings);
  };

  const incrementChunkCounter = () => {
    const updatedRecordings = recordingsRef.current.map((rec) => {
      if (rec.id === recordingIdRef.current) {
        rec.chunkCounter = (rec.chunkCounter ?? 0) + 1;
      }
      return rec;
    });
    saveRecordings(updatedRecordings); // Save updated recordings
    updateRecordingsState(updatedRecordings);
  };

  const uploadChunk = async (chunk: Chunk, recordingId: string, tenantName: string) => {
    const success = await uploadRecording(chunk, recordingId, tenantName);
    if (success) {
      chunk.status = 'uploaded';
      await saveUpdatedRecordingsState();
      return true;
    }
    return false;
  };

  const saveUpdatedRecordingsState = async () => {
    await saveRecordings(recordingsRef.current);
    updateRecordingsState(recordingsRef.current);
  };

  const processChunks = async () => {
    console.log('processChunks');
    for (const recording of recordingsRef.current) {
      let uploadSuccessful = false;
      if (recording.status !== 'Completed') {
        // Sort chunks by position in ascending order
        recording.chunks.sort((a, b) => a.position - b.position);

        for (const chunk of recording.chunks) {
          if (chunk.status === 'created') {
            console.log(chunk);
            await saveUpdatedRecordingsState();

            const uploadSuccess = await uploadChunk(chunk, recording.id, tenantName);
            if (!uploadSuccess) {
              break; // Stop processing further chunks if upload fails
            }
            if (chunk.isLastChunk) {
              console.log('chunk.isLastChunk');
              console.log(chunk.isLastChunk);
              recording.status = 'Uploading';
              if (!recording.endDate) {
                recording.endDate = new Date().toISOString();
              }
            }
          }
        }
        
        let hasCreatedChunks = false;
        for (const chunk of recording.chunks) {
          if (chunk.status === 'created') {
            hasCreatedChunks = true;
            break;
          }
        }

        if (!hasCreatedChunks && recording.chunks.length > 0 && recording.endDate) {
          let uploadSuccessful = await stopRecordingOnServer(recording.id, recording.endDate);
          if (uploadSuccessful) {
            recording.status = 'Completed';
          }
          await saveUpdatedRecordingsState();
        }
      }
    }
  };

  const uploadChunksPeriodically = async () => {
    uploadIntervalRef.current = setInterval(async () => {
      if (!isProcessingRef.current) {
        isProcessingRef.current = true;
        await loadAndProcessChunks();
        isProcessingRef.current = false;
      }
    }, CHUNK_UPLOAD_FREQUENCY); // 10 seconds interval
  };

  const loadAndProcessChunks = async () => {
    const savedRecordings = await loadRecordings();
    updateRecordingsState(savedRecordings);
    await processChunks();
  };

  useEffect(() => {
    uploadChunksPeriodically();

    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let intervalId: any;

    if (isRecording) {
      intervalId = setInterval(() => {
        setAudioLevel((prevLevel) => {
          const delta = (Math.random() - 0.5) * 5;
          const newLevel = prevLevel + delta;
          return newLevel;
        });
      }, 200); // Update every 100 milliseconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId); // Clean up the interval on component unmount or when isRecording changes to false
      }
    };
  }, [isRecording]);

  useEffect(() => {
    const fetchRecordings = async () => {
      const savedRecordings = await loadRecordings();
      updateRecordingsState(savedRecordings);
    };

    fetchRecordings();
  }, []);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const requestPermissions = async () => {
    console.log('Requesting permissions...');
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      throw new Error('Permission to access microphone is required!');
    }
  };

  const pauseRecording = async () => {
    console.log('pauseRecording');
    setIsPaused(true);
    // await stopAndUnloadRecording(recordingRef.current);
  };

  const unmuteRecording = async () => {
    console.log('unmuteRecording');
    setIsPaused(false);
    if (recordingIdRef.current) {
      await startAudioRecording();
    }
  };

  const createRecording = async () => {
    const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
    // const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-tenant-name': tenantName,
    };

    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }
    // if (userEmail) {
    //   headers['created-by'] = userEmail; // replace with actual user id or username
    // }

    try {
      console.log(tenantName);
      const response = await fetch(`${API_BASE_URL}/server/v1/start-recording`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recordingStartTime: new Date().toISOString(), // replace with actual recording start time
          recordingType: 'Audio', // replace with actual recording type
          status: 'STARTED', // replace with actual status
        }),
      });

      const result = await response.json();
      console.log(response);

      if (response.ok) {
        console.log('result.recordingId');
        console.log(result.recordingId);
        return result.recordingId;
      } else {
        Alert.alert('Error', result.message || 'Failed to start recording');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'An error occurred while starting the recording');
    } finally {
      setStartLoading(false);
      setButtonDisabled(false);
    }

    return null;
  };

  const createRecordingOnServer = async (tenantName: string) => {
    console.log('Creating recording on the server...');
    const newRecordingId = await createRecording();
    if (!newRecordingId) {
      throw new Error('Failed to create recording on the server.');
    }
    return newRecordingId;
  };

  const setAudioMode = async () => {
    console.log('Setting audio mode...');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: 0,
      staysActiveInBackground: true,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: true,
    });
  };

  const startAudioRecording = async () => {
    console.log('Starting recording...');
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    chunkStartTimeRef.current = new Date(); // Set the start time for the chunk
    return recording;
  };

  const addNewRecordingToList = async (newRecordingId: string) => {
    const newRecording: Recording = {
      id: newRecordingId,
      startDate: new Date().toISOString(),
      endDate: null,
      status: 'In Progress',
      sound: null,
      chunks: [],
      chunkCounter: 0,
    };

    const updatedRecordings = [newRecording, ...recordingsRef.current];
    await saveRecordings(updatedRecordings); // Save updated recordings
    updateRecordingsState(updatedRecordings);

    return newRecording;
  };

  const stopRecordingOnServer = async (recordingId: string, endDate: string) => {
    const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
    // const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-tenant-name': tenantName,
    };

    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }
    console.log('stopRecordingOnServer');
    console.log(endDate);
    try {
      const response = await fetch(`${API_BASE_URL}/server/v1/stop-recording`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recordingId: recordingId,
          recordingEndTime: new Date().toISOString()
        }),
      });

      if (response.ok) {
        console.log('Recording stopped successfully on the server.');
        return true;
      } else {
        console.error('Failed to stop recording on the server:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error stopping recording on the server:', error);
      return false;
    }
  };

  const stopAndUnloadRecording = async (recording: Audio.Recording | null) => {
    await recording?.stopAndUnloadAsync();
  };

  const handleRecordingUri = async (recording: Audio.Recording | null) => {
    if (recording) {
      const recordingUri = await getRecordingUri(recording);
      if (recordingUri && recordingIdRef && recordingIdRef.current) {
        return storeRecordingLocally(recordingUri, recordingIdRef.current);
      } else {
        throw new Error('Recording URI not found');
      }
    } else {
      throw new Error('Failed to unload recording');
    }
  };

  const createChunk = (localFileUri: string, chunkStartTime: Date, chunkEndTime: Date, isLastChunk: boolean): Chunk => {
    const recording = recordingsRef.current.find((rec) => rec.id === recordingIdRef.current);
    const chunkCounter = recording?.chunkCounter ?? 0;

    return {
      position: chunkCounter,
      isLastChunk: isLastChunk,
      uri: localFileUri,
      startTime: chunkStartTime.toISOString(),
      endTime: chunkEndTime.toISOString(),
      status: 'created',
      retryCount: 0,
    };
  };

  const updateStatus = (status: string) => {
    const updatedRecordings = recordingsRef.current.map((rec) =>
      rec.id === recordingIdRef.current ? { ...rec, status } : rec
    );
    saveRecordings(updatedRecordings); // Save updated recordings
    updateRecordingsState(updatedRecordings);
  };

  const updateRecordingEndDate = (recordingId: string, endDate: string) => {
    const updatedRecordings = recordingsRef.current.map((rec) => {
      if (rec.id === recordingId) {
        return { ...rec, endDate };
      }
      return rec;
    });
    saveRecordings(updatedRecordings); // Save updated recordings
    updateRecordingsState(updatedRecordings); // Update the state and ref
  };

  const finalizeRecording = async () => {

    recordingRef.current = null;
    bottomSheetRef.current?.snapToIndex(0); // Close the bottom drawer to 25%
    setStopLoading(false);
    setButtonDisabled(false); // Re-enable the button after API call is completed
  };

  const initializeRecording = async () => {
    await requestPermissions();
    const newRecordingId = await createRecordingOnServer(tenantName);
    updateRecordingId(newRecordingId); // Set the recordingId state
    await setAudioMode();
    const newRecording = await startAudioRecording();
    await addNewRecordingToList(newRecordingId);
    recordingRef.current = newRecording;
    setIsRecording(true);
  };

  const startRecording = async () => {
    try {
      setStartLoading(true);
      setButtonDisabled(true); // Disable the button immediately when clicked

      await initializeRecording();

      // Set up interval to stop and restart the recording every minute
      recordingIntervalRef.current = setInterval(async () => {
        console.log('Creating new chunk');
        await handleChunkCreation();
        const newRecording = await startAudioRecording();
        recordingRef.current = newRecording;
      }, MAX_CHUNK_DURATION_MS);

      bottomSheetRef.current?.snapToIndex(1); // Expand the bottom drawer to 40%
    } catch (err: any) {
      console.error('Failed to start recording', err);
      // Alert.alert('Error', err.message);
    } finally {
      updateStatus('Recording');
      setStartLoading(false);
      setButtonDisabled(false); // Re-enable the button after API call is completed
    }
  };

  const stopRecording = async () => {
    console.log('stopRecording');
    setIsRecording(false);
    setStopLoading(true);
    setButtonDisabled(true); // Disable the button immediately when clicked

    try {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      const recording = recordingsRef.current.find(rec => rec.id === recordingIdRef.current);
      const endDate = new Date().toISOString();

      if (recording) {
        updateStatus('Uploading');
        recording.endDate = endDate;
        updateRecordingsState([...recordingsRef.current]);
        await saveRecordings(recordingsRef.current);
      }

      await handleChunkCreation(true);

      if (!isProcessingRef.current) {
        isProcessingRef.current = true;
        await loadAndProcessChunks();
        isProcessingRef.current = false;
      }

    } catch (error: any) {
      console.error(error.message);
    } finally {
      if (recordingIdRef.current) {
        const endDate = new Date().toISOString();
        updateRecordingEndDate(recordingIdRef.current, endDate);
      }

      finalizeRecording();
    }
  };

  const handleDelete = async (id: string) => {
    const updatedRecordings = recordingsRef.current.filter((rec) => rec.id !== id);
    await saveRecordings(updatedRecordings); // Save recordings after deleting an item
    updateRecordingsState(updatedRecordings);
  };

  const clearAsyncStorage = async () => {
    await clearRecordings();
    updateRecordingsState([]);
  };

  // clearAsyncStorage();

  const clearRecordingById = async (recordingId: string) => {
    const savedRecordings = await loadRecordings();
    const updatedRecordings = savedRecordings.filter((rec: any) => rec.id !== recordingId);
    await saveRecordings(updatedRecordings);
    updateRecordingsState(updatedRecordings);
  };

  return (
    <View style={styles.container}>
      <RecordingList recordings={recordings} onDelete={handleDelete} />
      <BottomSheet
        ref={bottomSheetRef}
        index={0} // Start at the first snap point (25%)
        snapPoints={['25%', '40%']}
        onChange={(index) => {
          if (index < 0) {
            bottomSheetRef.current?.snapToIndex(0);
          }
        }}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.buttonContainer}>
            <View style={styles.fabContainer}>
              {isRecording ? (
                <>
                  {stopLoading ? (
                    <ActivityIndicator size="small" color="red" />
                  ) : (
                    <FAB
                      style={[styles.fab, styles.stopButton]}
                      icon="stop"
                      onPress={stopRecording}
                      disabled={buttonDisabled}
                    />
                  )}
                </>
              ) : (
                <>
                  {startLoading ? (
                    <ActivityIndicator size="small" color="red" />
                  ) : (
                    <FAB
                      style={[styles.fab, styles.recordButton]}
                      icon="microphone"
                      onPress={startRecording}
                      disabled={buttonDisabled}
                    />
                  )}
                </>
              )}
            </View>
            <Timer isRunning={isRecording} isPaused={isPaused} />
          </View>
          <AnimatedSoundBars style={styles.soundBars} isAnimating={isRecording} volume={audioLevel} />
          <LogoutChecker isRecordingInProgress={isRecording}></LogoutChecker>
        </View>
      </BottomSheet>
      {/* <Button title="Clear Recordings" onPress={clearAsyncStorage} /> */}
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
    alignItems: 'center',
    marginTop: 30,
  },
  bottomSheet: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 16,
    backgroundColor: '#f3edf6'

  },
  fabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '60%',
    paddingBottom: 10,
  },
  fab: {
    backgroundColor: 'red',
  },
  recordButton: {
    backgroundColor: 'red',
  },
  muteButton: {
    backgroundColor: 'white',
    borderColor: 'red',
    borderWidth: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: 'white',
    borderColor: 'red',
    borderWidth: 2,
  },
  soundBars: {
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: 'gray',
  },
});

export default RecordingScreen;
