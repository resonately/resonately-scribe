import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView, View, StyleSheet, Vibration, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { FontAwesome } from '@expo/vector-icons';
import Timer from '@/components/Timer';
import AnimatedSoundBars from '@/components/AnimatedSoundBars';
import * as FileSystem from 'expo-file-system';
import { Button, Text } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import { StackNavigationProp } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import NetInfo from '@react-native-community/netinfo';
import WavyPattern from '../components/WavyPattern';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import LogoutChecker from './LogoutChecker';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';


type RootStackParamList = {
  Record: undefined;
  LoginScreen: undefined;
};


const AudioChunkUpload = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const [chunks, setChunks] = useState<Array<{ startTime: number; endTime: number; uri: string }>>([]);
  const uploadingRef = useRef<boolean>(false);
  const startTimeRef = useRef<number | null>(null);
  const [originalStartTimeRef, setOriginalStartTimeRef] = useState<number | null>(null);
  const silenceThreshold = 10; // Adjust this threshold as needed
  const silenceDuration = 5000; // Duration of silence to detect a pause (in milliseconds)
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const maxChunkDuration = 120 * 1000; // Maximum duration of a chunk
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [isRecordingStopped, setIsRecordingStopped] = useState(false);
  const [chunkUploadPromises, setChunkUploadPromises] = useState<Promise<void>[]>([]);
  const [isConnected, setIsConnected] = useState(true); // Track internet connection status
  const [meteringData, setMeteringData] = useState(Array(50).fill(0.05));
  const [userEmail, setUserEmail] = useState('');
  const { logout, isAuthenticated } = useAuth();


  type RecordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Record'>;
  const navigation = useNavigation<RecordScreenNavigationProp>();
  const { tenantName } = useTenant().tenantDetails;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected === true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let intervalId: any;
  
    if (isRecording && !isPaused) {
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
  }, [isRecording, isPaused]); // Dependency array includes isRecording


  useEffect(() => {
    const validateSession = async () => {
      try {
        const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
        const sessionExpiry = await SecureStore.getItemAsync('sessionExpiry');
        const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

        if (userEmail) {
          setUserEmail(userEmail);
        }

        if (!sessionCookie || !sessionExpiry) {
          throw new Error('No session cookie or expiry found');
        }

        const expiryDate = new Date(sessionExpiry);
        if (expiryDate <= new Date()) {
          throw new Error('Session expired');
        }

        // Session is valid, proceed with your logic
      } catch (error) {
        console.error('Session validation error', error);
        Alert.alert('Session expired', 'Please log in again.');
        navigation.replace('LoginScreen'); // Navigate to the login screen
      }
    };

    validateSession();
  }, [navigation]);

  useEffect(() => {
    if (!uploadingRef.current) {
      uploadingRef.current = true;
      processUploadQueue();
    }
  }, [chunks]);

  const createRecording = async (tenantName: string) => {
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

    const currentDate = new Date();
    const formattedDate =
      currentDate.getFullYear() +
      '-' +
      String(currentDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(currentDate.getDate()).padStart(2, '0') +
      ' ' +
      String(currentDate.getHours()).padStart(2, '0') +
      ':' +
      String(currentDate.getMinutes()).padStart(2, '0') +
      ':' +
      String(currentDate.getSeconds()).padStart(2, '0');

    
      try {
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
          return result.recordingId;
          Alert.alert('Success', 'Recording started successfully');
        } else {
          Alert.alert('Error', result.message || 'Failed to start recording');
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Error', 'An error occurred while starting the recording');
      } finally {
        setLoading(false);
      }

    return null;
  };

  const monitorAudioVolume = async () => {
    isRecordingRef.current = true;

    const interval = setInterval(async () => {
      if (recordingRef.current) {
        const status = await recordingRef.current.getStatusAsync();
        if (status.metering !== undefined) {
          const currentLevel = status.metering + 90; // Normalize the value
          const volumeLevels = Array.from({ length: 50 }).map(() =>
            Math.random() * (1.5 - 0.5) + 0.5
          );
          volumeLevels.push(currentLevel); // Add the current level to the array
          setMeteringData(volumeLevels);

        }
      }
    }, 100)
  };

  const startRecording = async () => {
    try {
      setLoading(true); // Show loading animation
      setLoadingMessage('Starting');

      // API call to create a new recording
      const recordingId = await createRecording(tenantName);
      if (!recordingId) {
        Alert.alert("An error occurred.")
        setLoading(false); // Show loading animation
        setLoadingMessage('');
        return;
      }
      
      setRecordingId(recordingId);

      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();

      console.log('Setting audio mode..');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 0, // equivalent to Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX
        staysActiveInBackground: true,
        interruptionModeAndroid: 1, // equivalent to Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: true,
      });
      

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      
      monitorAudioVolume();

      setRecording(recording);
      setIsRecording(true);
      setIsPaused(false);
      isRecordingRef.current = true;
      startTimeRef.current = Date.now();
      setOriginalStartTimeRef(Date.now());

      // Start the chunking process
      detectSilence();
      startChunkTimer();
    } catch (err) {
      console.error('Failed to start recording', err);
    } finally {
      setLoading(false); // Hide loading animation
      setLoadingMessage('');
    }
  };

  const uploadStopRecording = async (tenantName: string) => {
    const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'x-tenant-name': tenantName,
      'created-by': userEmail,
    };

    if (sessionCookie) {
      headers['Cookie'] = sessionCookie;
    }

    const currentDate = new Date();
    const formattedDate =
      currentDate.getFullYear() +
      '-' +
      String(currentDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(currentDate.getDate()).padStart(2, '0') +
      ' ' +
      String(currentDate.getHours()).padStart(2, '0') +
      ':' +
      String(currentDate.getMinutes()).padStart(2, '0') +
      ':' +
      String(currentDate.getSeconds()).padStart(2, '0');

    const response = await fetch(`https://api.myhearing.app/server/v1/stop-recording`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        recordingName: recordingId, // Use the recordingId
        endTime: new Date().toISOString(),
      }),
    });

    const result = await response.json();

    console.log(result);

    if (!response || !result.success) {
      throw new Error('Failed to update the recording');
    }

    // Reset the recordingId
    setRecordingId(null);
  };

  const stopRecording = async () => {
    setLoading(true); // Show loader on the button
    setLoadingMessage('Uploading...');
    console.log('Stopping recording..');

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        if (uri) {
          const endTime = Date.now();
          let isUploaded = false;
          let retryCount = 0;
          let startTime = new Date();
          
          setIsRecordingStopped(true);
          setIsRecording(false);
          setIsPaused(false);
          isRecordingRef.current = false;
          resetRecordingState();
          
          startTimeRef.current = null;

          while (!isUploaded && retryCount < 10) {
            try {
              console.log('Uploading chunk...');

              const fileInfo = await FileSystem.getInfoAsync(uri);

              if (fileInfo.exists && !fileInfo.isDirectory) {
                console.log(`File size: ${fileInfo.size} bytes`); 
              }

              const formData = new FormData();
              formData.append('file', {
                uri: fileInfo.uri,
                type: 'audio/m4a',
                name: 'audio_chunk.m4a',
              });

              // Ensure startTimeRef.current is not null
              if (!originalStartTimeRef) {
                throw new Error('Recording start time is not set');
              }

              formData.append('recordingStartTime', new Date(originalStartTimeRef).toUTCString());
              formData.append('chunkStartTime', new Date(startTime).toUTCString());
              formData.append('chunkEndTime', new Date(endTime).toUTCString());
              formData.append('userEmail', userEmail);
              if (recordingId) {
                formData.append('recordingId', recordingId);
              }

              const res = await fetch('https://api.myhearing.app/server/v1/upload-audio-chunks', {
                method: 'POST',
                headers: {
                  'Content-Type': 'multipart/form-data',
                  'x-tenant-name': tenantName,
                },
                body: formData,
              });

              console.log(JSON.stringify(res));
              console.log('Chunk uploaded successfully');
              isUploaded = true;
            } catch (err) {
              retryCount++;
              console.error(`Error uploading chunk, retrying... (${retryCount}/10)`, err);
              if (retryCount >= 10) {
                console.error('Max retries reached. Stopping upload for this chunk.');
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 4000)); // Wait for 4 seconds before retrying
            }
          }

          console.log('Recording stopped and stored at', uri);
          console.log('Chunks:', chunks);
        }
      } catch (err) {
        console.error('Error stopping recording', err);
      } finally {
        clearChunkTimer();
        recordingRef.current = null;
      }
    }

    // Process any new chunks added after stopping recording
    await processUploadQueue();

    // Wait for all chunks to be uploaded
    let counter = 1;
    while (chunks.length > 0 || chunkUploadPromises.length > 0) {
      counter = counter + 1;
      if (counter > 20) {
        break;
      }
      await Promise.all(chunkUploadPromises);
      await new Promise<void>((resolve) => {
        console.log(chunks.length);
        console.log(chunkUploadPromises.length);
        console.log('Waiting for chunks to be uploaded...');
        setTimeout(resolve, 1000);
      }); // Wait for 1 second before checking again
    }

    // Call finalizeRecording to complete the process
    finalizeRecording();
  };

  const finalizeRecording = async () => {
    // Wait for any remaining uploads to complete
    setIsLoading(true);

    try {
      console.log('Starting uploadStopRecording API');
      await uploadStopRecording(tenantName);
      Alert.alert('Upload Complete.');
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to stop recording and upload. Please try again.');
    } finally {
      setLoading(false); // Hide loader on the button
      setLoadingMessage('');
    }
  };

  const resetRecordingState = () => {
    setRecording(null);
    setIsRecording(false);
    setIsPaused(false);
    recordingRef.current = null;
    isRecordingRef.current = false;
    setChunks([]);
    startTimeRef.current = null;
    setOriginalStartTimeRef(null);
    uploadingRef.current = false;
  };

  const pauseRecording = async () => {
    if (recordingRef.current && isRecording) {
      if (!isPaused) {
        await recordingRef.current.pauseAsync();
        setIsPaused(true);
        clearChunkTimer();
      } else {
        await recordingRef.current.startAsync();
        setIsPaused(false);
        startChunkTimer();
      }
    }
  };

  const detectSilence = async () => {
    if (!recordingRef.current) {
      return;
    }

    let lastNonSilenceTime = Date.now();

    while (isRecordingRef.current) {
      const status = await recordingRef.current.getStatusAsync();
      if (status.metering !== undefined) {
        const currentLevel = status.metering;
        setAudioLevel(currentLevel + 90);

        if (currentLevel > silenceThreshold) {
          lastNonSilenceTime = Date.now();
        } else if (Date.now() - lastNonSilenceTime >= silenceDuration) {
          // Detected a pause
          // await chunkAudio();
          lastNonSilenceTime = Date.now();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200)); // Check every 200ms
    }
  };

  const startChunkTimer = () => {
    chunkTimerRef.current = setInterval(async () => {
      if (isRecordingRef.current) {
        await chunkAudio();
      }
    }, maxChunkDuration);
  };

  const clearChunkTimer = () => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
  };

  const chunkAudio = async () => {
    if (!recordingRef.current) {
      return;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (uri) {
        console.log('Chunk file path:', uri); // Log the file path
        const endTime = Date.now();
        setChunks((prevChunks) => [
          ...prevChunks,
          { startTime: startTimeRef.current!, endTime, uri },
        ]);
        startTimeRef.current = endTime;

        // Start a new recording for the next chunk
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setRecording(recording);
      }
    } catch (err) {
      console.error('Error chunking audio', err);
    }
  };

  const processUploadQueue = async () => {
    console.log("processUploadQueue");

    const newUploadPromises = chunks.map(async (chunk, index) => {
      const { uri, startTime, endTime } = chunk;

      if (uri) {
        let isUploaded = false;
        let retryCount = 0;

        while (!isUploaded && retryCount < 10) {
          try {
            console.log('Uploading chunk...');
            const fileInfo = await FileSystem.getInfoAsync(uri);
            
            if (fileInfo.exists && !fileInfo.isDirectory) {
              console.log(`File size: ${fileInfo.size} bytes`); 
            }

            const formData = new FormData();
            formData.append('file', {
              uri: fileInfo.uri,
              type: 'audio/m4a',
              name: 'audio_chunk.m4a',
            });

            // Ensure startTimeRef.current is not null
            if (!originalStartTimeRef) {
              throw new Error('Recording start time is not set');
            }

            formData.append('recordingStartTime', new Date(originalStartTimeRef).toUTCString());
            formData.append('chunkStartTime', new Date(startTime).toUTCString());
            formData.append('chunkEndTime', new Date(endTime).toUTCString());
            formData.append('userEmail', userEmail);
            if (recordingId) {
              formData.append('recordingId', recordingId);
            }

            const res = await fetch('https://api.myhearing.app/server/v1/upload-audio-chunks', {
              method: 'POST',
              headers: {
                'Content-Type': 'multipart/form-data',
                'x-tenant-name': tenantName,
              },
              body: formData,
            });

            console.log(JSON.stringify(res));
            console.log('Chunk uploaded successfully');
            isUploaded = true;
            // Remove the successfully uploaded chunk
            setChunks((prevChunks) => prevChunks.filter((_, i) => i !== index));

          } catch (err) {
            retryCount++;
            console.error(`Error uploading chunk, retrying... (${retryCount}/10)`, err);
            if (retryCount >= 10) {
              console.error('Max retries reached. Stopping upload for this chunk.');
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 4000)); // Wait for 4 seconds before retrying
          }
        }
      }
    });

    setChunkUploadPromises((prevPromises) => [...prevPromises, ...newUploadPromises]);

    await Promise.all(newUploadPromises);

    setChunkUploadPromises((prevPromises) =>
      prevPromises.filter((promise) => !newUploadPromises.includes(promise))
    );

    uploadingRef.current = false; // Mark uploading as done when the queue is empty
  };

  return (
    <View style={styles.container}>
      <Timer isRunning={isRecording} isPaused={isPaused} />
      {/* <Text variant="bodyLarge">Audio Level: {audioLevel}</Text> */}
      <View style={styles.headerContainer}>
        <View style={[styles.statusPill, { backgroundColor: isConnected ? '#4CAF50' : '#FFC107' }]}>
          <Text style={styles.statusText}>{isConnected ? 'Online' : 'No Internet'}</Text>
        </View>
      </View>
      <AnimatedSoundBars style={styles.soundBars} isAnimating={isRecording && !isPaused} volume={audioLevel}/>
      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => {
            Vibration.vibrate();
            if (isRecording) {
              stopRecording();
            } else {
              startRecording();
            }
          }}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon={() => (
            <FontAwesome name={isRecording ? 'stop' : 'microphone'} size={24} color="#ffffff" />
          )}
        >
          {loading ? loadingMessage : isRecording ? 'Stop & Submit' : 'Record'}
        </Button>
        {isRecording && (
          <Button
            mode="outlined"
            onPress={() => {
              Vibration.vibrate();
              pauseRecording();
            }}
            style={styles.pauseButton}
            contentStyle={styles.iconButtonContent}
            disabled={!isRecording}
          >
            <FontAwesome name={isPaused ? 'play' : 'pause'} size={24} color="#1E88E5" />
          </Button>
        )}
      </View>
      <LogoutChecker isRecordingInProgress={isRecording} />
    </View>
  );
};

const styles = StyleSheet.create({
  pauseButton: {
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#3949ab', // Light Indigo border color
    width: 100,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8eaf6', // Light Indigo background
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Ensures the pill is pushed to the right
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 50,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1, // Takes up the available space
  },
  statusPill: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 15,
    marginLeft: 10, // Optional: adds space between the title and pill
  },
  soundBars: {
    marginBottom: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 10,
    borderRadius: 30,
    backgroundColor: '#3949ab', // Light Indigo button
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonContent: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    color: '#ffffff', // White font color
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 30,
    backgroundColor: '#3949ab', // Light Indigo button
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AudioChunkUpload;