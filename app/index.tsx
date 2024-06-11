import React, { useState, useRef, useEffect } from 'react';
import { Button, View } from 'react-native';
import { Audio } from 'expo-av';
import axios from 'axios';
import 'react-native-reanimated';

const AudioChunkUpload = () => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const chunkQueue = useRef<string[]>([]);
  const uploadingRef = useRef<boolean>(false);

  useEffect(() => {
    // Start the upload process if it's not already running
    if (!uploadingRef.current) {
      uploadingRef.current = true;
      processUploadQueue();
    }
  }, [chunkQueue.current.length]);

  const startRecording = async () => {
    try {
      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();

      console.log('Setting audio mode..');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecording(recording);
      setIsRecording(true);
      isRecordingRef.current = true;

      // Start the chunking process
      chunkAudio();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    console.log('Stopping recording..');
    setIsRecording(false);
    isRecordingRef.current = false;
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      console.log('Recording stopped and stored at', uri);
    }
  };

  const chunkAudio = async () => {
    while (isRecordingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Chunk every 5 seconds

      if (!recordingRef.current) {
        return;
      }

      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        if (uri) {
          chunkQueue.current.push(uri); // Add chunk to the queue
        }

        // Start a new recording for the next chunk
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setRecording(recording);
      } catch (err) {
        console.error('Error chunking audio', err);
      }
    }
  };

  const processUploadQueue = async () => {
    while (chunkQueue.current.length > 0) {
      const uri = chunkQueue.current.shift(); // Get the first chunk in the queue
      if (uri) {
        const file = {
          uri,
          name: 'audio_chunk.m4a',
          type: 'audio/m4a',
        };

        const formData = new FormData();
        formData.append('file', file);

        try {
          console.log('Uploading chunk...');
          await axios.post('YOUR_UPLOAD_URL', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          console.log('Chunk uploaded successfully');
        } catch (err) {
          console.error('Error uploading chunk', err);
          // Re-add the failed chunk back to the queue
          // chunkQueue.current.unshift(uri);
        }
      }
    }
    uploadingRef.current = false; // Mark uploading as done when the queue is empty
  };

  return (
    <View>
      <Button title={isRecording ? 'Stop Recording' : 'Start Recording'} onPress={isRecording ? stopRecording : startRecording} />
    </View>
  );
};

export default AudioChunkUpload;
