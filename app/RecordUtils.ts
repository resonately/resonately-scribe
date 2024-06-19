// recordingUtils.ts
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';

export const getRecordingUri = async (recording: Audio.Recording): Promise<string | null> => {
  return recording.getURI();
};

export const storeRecordingLocally = async (recordingUri: string, recordingId: string): Promise<string> => {
  const recordingDir = `${FileSystem.documentDirectory}recordings/rec_${recordingId}/`;

  // Ensure the directory exists
  await FileSystem.makeDirectoryAsync(recordingDir, { intermediates: true });

  const localFileUri = `${recordingDir}${recordingId}.m4a`;

  // Move the recording to the new location
  await FileSystem.moveAsync({
    from: recordingUri,
    to: localFileUri,
  });

  return localFileUri;
};

export const uploadRecording = async (fileUri: string, recordingId: string, tenantName: string): Promise<boolean> => {
    const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
    const userEmail = await SecureStore.getItemAsync('sessionUserEmail');
  
    const headers: HeadersInit = {
      'Content-Type': 'multipart/form-data',
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
      uri: fileUri,
      type: 'audio/m4a',
      name: `${recordingId}.m4a`,
    } as any);
  
    try {
      const response = await fetch('https://api.myhearing.app/server/v1/upload-audio-chunks', {
        method: 'POST',
        headers,
        body: formData,
      });
  
      if (response.status === 200) {
        console.log('Chunk uploaded successfully.');
        return true;
      } else {
        console.error('Failed to upload recording:', response.statusText);
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
    }
  
    return false;
  };

export const deleteRecordingFolder = async (recordingId: string): Promise<void> => {
    console.log('deleteRecordingFolder');
  const recordingDir = `${FileSystem.documentDirectory}recordings/rec_${recordingId}/`;
  await FileSystem.deleteAsync(recordingDir, { idempotent: true });
};
