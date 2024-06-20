// recordUtils.ts
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import { Chunk } from './RecordingScreen';

export const getRecordingUri = async (recording: Audio.Recording): Promise<string | null> => {
  return recording.getURI();
};

export const storeRecordingLocally = async (recordingUri: string, recordingId: string): Promise<string | null> => {
  if (recordingId) {
    const recordingDir = `${FileSystem.documentDirectory}recordings/rec_${recordingId}/`;

  // Ensure the directory exists
  await FileSystem.makeDirectoryAsync(recordingDir, { intermediates: true });

  // Generate a unique filename using a timestamp
  const uniqueTimestamp = new Date().getTime();
  const localFileUri = `${recordingDir}${recordingId}_${uniqueTimestamp}.m4a`;

  // Move the recording to the new location
  await FileSystem.moveAsync({
    from: recordingUri,
    to: localFileUri,
  });

  return localFileUri;
  }
  return null;
};

export const uploadRecording = async (chunk: Chunk, recordingId: string, tenantName: string): Promise<boolean> => {
  const { position, startTime, endTime, uri } = chunk;

  console.log('Recording ID:', recordingId);
  console.log('Chunk Start Time:', startTime);
  console.log('Chunk End Time:', endTime);
  console.log('Chunk URI:', uri);

  const fileExists = await FileSystem.getInfoAsync(uri);

  if (!fileExists.exists) {
    console.log('File not found locally.');
    return true;
  }

  const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
  const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

  const headers: HeadersInit = {
    'x-tenant-name': tenantName,
  };

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }
  if (userEmail) {
    headers['created-by'] = userEmail;
  }

  const formData = new FormData();
  formData.append('file', {
    uri: uri,
    type: 'audio/m4a',
    name: 'audio_chunk.m4a',
  } as any);

  formData.append('position', position.toString());
  formData.append('recordingId', recordingId);
  formData.append('chunkStartTime', new Date(startTime).toUTCString());
  formData.append('chunkEndTime', new Date(endTime).toUTCString());

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second
  let attempt = 0;
  let success = false;

  while (attempt < MAX_RETRIES && !success) {
    try {
      const response = await fetch('https://api.myhearing.app/server/v1/upload-audio-chunks', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.status === 200) {
        console.log('Chunk uploaded successfully.');
        return true;
      } else if (response.status >= 500 || !navigator.onLine) {
        console.log(response.statusText);
        // Server-side error or no network
        console.log('Server error or no network. Retrying...');
      } else {
        // Other errors
        console.log('Failed to upload chunk.');
      }
    } catch (error) {
      console.error('Error uploading chunk:', error);
    }

    attempt++;
    if (!success) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }

  return false;
};


export const deleteRecordingFolder = async (recordingId: string): Promise<void> => {
  console.log('deleteRecordingFolder');
  const recordingDir = `${FileSystem.documentDirectory}recordings/rec_${recordingId}/`;
  await FileSystem.deleteAsync(recordingDir, { idempotent: true });
};

export const deleteStaleRecordings = async (maxAge: number): Promise<void> => {
  try {
    const recordingsDir = `${FileSystem.documentDirectory}recordings/`;
    const dirInfo = await FileSystem.getInfoAsync(recordingsDir);

    if (dirInfo.exists && dirInfo.isDirectory) {
      const dirs = await FileSystem.readDirectoryAsync(recordingsDir);
      
      const now = new Date().getTime();
      for (const dir of dirs) {
        const dirPath = `${recordingsDir}${dir}/`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        
        if (dirInfo.exists) {
          const dirCreationTime = new Date(dirInfo.modificationTime).getTime();
          const age = now - dirCreationTime;

          if (age > maxAge) {
            await FileSystem.deleteAsync(dirPath, { idempotent: true });
            console.log(`Deleted stale recording folder: ${dirPath}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error deleting stale recordings:', error);
  }
};
