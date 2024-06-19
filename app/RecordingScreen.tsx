import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Alert, Button, ActivityIndicator } from 'react-native';
import { Audio, AVPlaybackStatusSuccess } from 'expo-av';
import BottomSheet from '@gorhom/bottom-sheet';
import RecordingList from './RecordingList';
import RecordingButton from './RecordingButton';
import { useKeepAwake } from 'expo-keep-awake';
import * as SecureStore from 'expo-secure-store';
import { useTenant } from './TenantContext';
import {
  getRecordingUri,
  storeRecordingLocally,
  uploadRecording,
  deleteRecordingFolder,
} from './RecordUtils';
import { saveRecordings, loadRecordings, clearRecordings } from './AsyncStorageUtils';
import AnimatedSoundBars from '@/components/AnimatedSoundBars';

interface Recording {
  id: string;
  startDate: string;
  endDate: string | null;
  status: string;
  sound: Audio.Sound | null;
  chunks: Chunk[];
  chunkCounter: number;
}

interface Chunk {
  position: number;
  isLastChunk: boolean;
  uri: string;
  startTime: string;
  endTime: string;
  status: string;
  retryCount: number;
}

const RecordingScreen = (): JSX.Element => {
  useKeepAwake(); // Keeps the app awake while this component is mounted

  const { tenantName } = useTenant().tenantDetails;

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    let intervalId: any;
  
    if (isRecording) {
      intervalId = setInterval(() => {
        setAudioLevel(prevLevel => {
          // Generate a small random delta value between -1 and 1
          const delta = (Math.random() - 0.5) * 5;
          // Apply the delta to the previous level
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
  }, [isRecording]); // Dependency array includes isRecording

  useEffect(() => {
    const fetchRecordings = async () => {
      const savedRecordings = await loadRecordings();
      setRecordings(savedRecordings);
    };

    fetchRecordings();
  }, []);

  const createRecording = async () => {
    const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
    const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-tenant-name': tenantName,
    };

    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }
    if (userEmail) {
      headers['created-by'] = userEmail; // replace with actual user id or username
    }

    try {
      console.log(sessionCookie);
      console.log(userEmail);
      console.log(tenantName);
      const response = await fetch('https://api.myhearing.app/server/v1/start-recording', {
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

  const startRecording = async () => {
    try {
      setStartLoading(true);
      setButtonDisabled(true); // Disable the button immediately when clicked
      console.log('Requesting permissions...');
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        console.log('Creating recording on the server...');
        const newRecordingId = await createRecording(); // Replace 'tenantName' with the actual tenant name
        if (!newRecordingId) {
          Alert.alert('Error', 'Failed to create recording on the server.');
          setStartLoading(false);
          setButtonDisabled(false); // Re-enable the button after API call
          return;
        }

        setRecordingId(newRecordingId); // Set the recordingId state

        console.log('Setting audio mode...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 0, // equivalent to Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX
          staysActiveInBackground: true,
          interruptionModeAndroid: 1, // equivalent to Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: true,
        });

        console.log('Starting recording...');
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        // Add new recording to the list with status "in progress"
        const newRecording: Recording = {
          id: newRecordingId,
          startDate: new Date().toISOString(),
          endDate: null,
          status: 'In Progress',
          sound: null,
          chunks: [],
          chunkCounter: 0,
        };
        setRecordings((prevRecordings) => {
          const updatedRecordings = [newRecording, ...prevRecordings];
          saveRecordings(updatedRecordings); // Save updated recordings
          return updatedRecordings;
        });

        setRecording(recording);
        setIsRecording(true);
        bottomSheetRef.current?.snapToIndex(1); // Expand the bottom drawer to 40%
      } else {
        alert('Permission to access microphone is required!');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    } finally {
      setStartLoading(false);
      setButtonDisabled(false); // Re-enable the button after API call is completed
    }
  };

  const stopRecording = async () => {
    console.log('stopRecording');
    setIsRecording(false);
    setStopLoading(true);
    setButtonDisabled(true); // Disable the button immediately when clicked

    console.log(recording);
    await recording?.stopAndUnloadAsync();
    console.log('recording?.stopAndUnloadAsync()');

    if (recording) {
      console.log('status.isLoaded && recording');
      const recordingUri = await getRecordingUri(recording);
      if (recordingUri) {
        const localFileUri = await storeRecordingLocally(recordingUri, recordingId!);
        
        // Get the chunk details
        const chunk = {
          position: recordings.find(rec => rec.id === recordingId)?.chunkCounter ?? 0,
          isLastChunk: true,
          uri: localFileUri,
          startTime: recordings.find(rec => rec.id === recordingId)?.startDate ?? new Date().toISOString(),
          endTime: new Date().toISOString(),
          status: 'created',
          retryCount: 0,
        };

        // Increment the chunk counter and add chunk details to recording
        setRecordings((prevRecordings) => {
          const updatedRecordings = prevRecordings.map((rec) => {
            if (rec.id === recordingId) {
              rec.chunkCounter += 1;
              rec.chunks.push(chunk);
            }
            return rec;
          });
          saveRecordings(updatedRecordings); // Save updated recordings
          return updatedRecordings;
        });

        // Update the status to "Uploading"
        console.log('Updating status to Uploading');
        setRecordings((prevRecordings) => {
          const updatedRecordings = prevRecordings.map((rec) =>
            rec.id === recordingId ? { ...rec, status: 'Uploading', endDate: new Date().toISOString() } : rec
          );
          saveRecordings(updatedRecordings); // Save updated recordings
          console.log('Updated recordings:', updatedRecordings); // Log the updated recordings
          return updatedRecordings;
        });

        const uploadSuccess = await uploadRecording(localFileUri, recordingId!, tenantName);

        if (uploadSuccess) {
          await deleteRecordingFolder(recordingId!);
          // Update the status to "Completed"
          console.log('Updating status to Completed');
          setRecordings((prevRecordings) => {
            const updatedRecordings = prevRecordings.map((rec) =>
              rec.id === recordingId ? { ...rec, status: 'Completed' } : rec
            );
            saveRecordings(updatedRecordings); // Save updated recordings
            console.log('Updated recordings:', updatedRecordings); // Log the updated recordings
            return updatedRecordings;
          });
        } else {
          // Update the status to "Failed"
          console.log('Updating status to Failed');
          setRecordings((prevRecordings) => {
            const updatedRecordings = prevRecordings.map((rec) =>
              rec.id === recordingId ? { ...rec, status: 'Failed' } : rec
            );
            saveRecordings(updatedRecordings); // Save updated recordings
            console.log('Updated recordings:', updatedRecordings); // Log the updated recordings
            return updatedRecordings;
          });
        }

        setRecording(null);
        bottomSheetRef.current?.snapToIndex(0); // Close the bottom drawer to 25%
      } else {
        console.error('Recording URI not found');
      }
    } else {
      console.error('Failed to load recording');
    }
    setStopLoading(false);
    setButtonDisabled(false); // Re-enable the button after API call is completed
  };

  const handleDelete = async (id: string) => {
    const updatedRecordings = recordings.filter((rec) => rec.id !== id);
    setRecordings(updatedRecordings);
    await saveRecordings(updatedRecordings); // Save recordings after deleting an item
  };

  const clearAsyncStorage = async () => {
    await clearRecordings();
    setRecordings([]);
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
            <RecordingButton
              isRecording={isRecording}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={buttonDisabled} // Disable the button based on state
              loading={isRecording ? stopLoading : startLoading} // Set loading state based on isRecording
            />
          </View>
          <AnimatedSoundBars style={styles.soundBars} isAnimating={isRecording} volume={audioLevel}/>
        </View>
      </BottomSheet>
      <Button title="Clear Recordings" onPress={clearAsyncStorage} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 30, // Ensure the button is at the top of the bottom sheet
  },
  bottomSheet: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start', // Align items at the top
    paddingBottom: 16,
  },
  button: {
    backgroundColor: 'red',
    padding: 16,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: 'gray',
  }
});

export default RecordingScreen;
