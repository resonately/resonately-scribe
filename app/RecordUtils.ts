// recordUtils.ts
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import { Recording, Chunk } from './types';

const API_BASE_URL = 'https://api.rsn8ly.xyz';

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

export const deleteAppointment = async (appointmentId: number, tenantName: string): Promise<boolean> => {
  const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
  const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

  if (!sessionCookie || !userEmail) {
    console.error('Session cookie or user email not found.');
    return false;
  }

  const headers: HeadersInit = {
    'x-tenant-name': tenantName,
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
    'created-by': userEmail,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/server/v1/appointment/${appointmentId}`, {
      method: 'DELETE',
      headers,
    });

    if (response.ok) {
      console.log('Appointment deleted successfully.');
      return true;
    } else {
      console.error('Failed to delete appointment. Status:', response.status);
      const responseBody = await response.text();
      console.error('Response body:', responseBody);
      return false;
    }
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
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
    'x-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone
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
      const response = await fetch(`${API_BASE_URL}/server/v1/upload-audio-chunks`, {
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


export const uploadChunkToServer = async (chunk: Chunk, recording: Recording, tenantName: string): Promise<boolean> => {
  const { position, startTime, endTime, uri } = chunk;

  console.log(">>>> Inside uploadchunktoserver: ", chunk, recording, tenantName);

  const fileExists = await FileSystem.getInfoAsync(uri);

  if (!fileExists.exists) {
    console.log('>>>> File not found locally.');
    return true;
  }

  const sessionCookie = await SecureStore.getItemAsync('sessionCookie');
  const userEmail = await SecureStore.getItemAsync('sessionUserEmail');

  console.log('>>> Session Cookie:', sessionCookie);
  console.log('>>> User Email:', userEmail);

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
    name: uri.split('/').pop(), // Assuming the file name can be derived from the URI
    type: 'audio/wav' // Change the type to the appropriate MIME type if different
  } as any);

  console.log(">>> uploading recording:", recording);
  console.log(">>> uploading chunk:", chunk);

  formData.append('appointmentId', recording.appointmentId);
  formData.append('localRecordingId', recording.id!);
  formData.append('chunkType', chunk.isLastChunk ? 'last' : 'intermediate');
  formData.append('position', position.toString());
  formData.append('chunkStartTime', new Date(startTime).toUTCString());
  formData.append('chunkEndTime', new Date(endTime).toUTCString());


  const MAX_RETRIES = 5;
  const RETRY_DELAY = 2000; // 2 seconds
  let attempt = 0;
  let success = false;

  while (attempt < MAX_RETRIES && !success) {
    try {
      const response = await fetch(`${API_BASE_URL}/server/v1/chunk`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.status === 200) {
        console.log('Chunk uploaded successfully.');
        success = true;
        return true;
      } else if (response.status === 403) {
        console.log('403 Forbidden: Check session cookie and user permissions.');
        // Additional logging can be added here to understand the issue better
        const responseBody = await response.text();
        console.log('Response body:', responseBody);
        return false;
      } else if (response.status >= 500 || !navigator.onLine) {
        console.log(JSON.stringify(response));
        console.log('Server error or no network. Retrying...');
      } else {
        console.log('Failed to upload chunk. Status:', response.status);
        const responseBody = await response.text();
        console.log('Response body:', responseBody);
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

export const fetchAppointments = async (tenantName: string, startDate: string, endDate: string): Promise<any> => {
  const sessionCookie = await SecureStore.getItemAsync('sessionCookie');

  // console.log('loadAppointments');
  // console.log(tenantName);
  // console.log(startDate);
  // console.log(endDate);
  // console.log(API_BASE_URL);

  if (!sessionCookie) {
    console.error('Session cookie not found.');
    return null;
  }

  const headers: HeadersInit = {
    'x-tenant-name': tenantName,
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
  };

  // console.log(headers);

  try {
    const response = await fetch(`${API_BASE_URL}/server/v1/appointments?startDate=${startDate}&endDate=${endDate}`, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Appointments fetched successfully.');
      // console.log(API_BASE_URL);
      return data.appointments;
    } else {
      console.error('Failed to fetch appointments. Status:', response.status);
      const responseBody = await response.text();
      // console.error('Response body:', responseBody);
      return null;
    }
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return null;
  }
};


export const createAppointment = async (
  appointmentType: string,
  patientName: string,
  appointmentTitle: string,
  startTime: string,
  endTime: string,
  notes: string,
  tenantName: string
): Promise<{ success: boolean, appointmentId?: string }> => {
  const sessionCookie = await SecureStore.getItemAsync('sessionCookie');

  if (!sessionCookie) {
    console.error('Session cookie not found.');
    return { success: false };
  }

  const headers: HeadersInit = {
    'x-tenant-name': tenantName,
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
  };

  const body = JSON.stringify({
    external_source: 'resonately',
    data: [{
      external_reference_id: Date.now().toString(),
      appointment_type: appointmentType,
      patient_name: patientName,
      expected_appointment_start_time: startTime,
      expected_appointment_end_time: endTime,
      appointment_title: appointmentTitle,
      notes: notes
    }]});

  try {
    const response = await fetch(`${API_BASE_URL}/server/v1/appointment`, {
      method: 'POST',
      headers,
      body,
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('Appointment created successfully.');
      
      if (responseData.appointmentIds && responseData.appointmentIds.length > 0) {
        return { success: true, appointmentId: responseData.appointmentIds[0] };
      } else {
        console.error('No appointment IDs returned.');
        return { success: false };
      }
    } else {
      console.error('Failed to create appointment. Status:', response.status);
      const responseBody = await response.text();
      console.error('Response body:', responseBody);
      return { success: false };
    }
  } catch (error) {
    console.error('Error creating appointment:', error);
    return { success: false };
  }
};

interface RecordingInfo {
  folderPath: string;
  filePath: string;
  ageInSeconds: number;
}

export const deleteRecordingsByAge = async (recordings: RecordingInfo[], maxAgeInSeconds: number): Promise<void> => {
  console.log(`deleteRecordingsByAge`);
  try {
    for (const recording of recordings) {
      console.log(recording.ageInSeconds);
      console.log(maxAgeInSeconds);
      if (recording.ageInSeconds > maxAgeInSeconds) {
        await FileSystem.deleteAsync(recording.filePath);
        console.log(`Deleted file: ${recording.filePath}`);
      }
    }
    console.log('Old recordings deleted successfully.');
  } catch (error) {
    console.error('Error deleting old recordings:', error);
  }
};

export const listRecordingsAsJson = async (): Promise<RecordingInfo[]> => {
  const recordingsInfo: RecordingInfo[] = [];

  try {
    const recordingsDir = `${FileSystem.documentDirectory}recordings/`;
    const dirInfo = await FileSystem.getInfoAsync(recordingsDir);

    if (dirInfo.exists && dirInfo.isDirectory) {
      const dirs = await FileSystem.readDirectoryAsync(recordingsDir);

      const nowInSeconds = Math.floor(Date.now() / 1000);
      for (const dir of dirs) {
        const dirPath = `${recordingsDir}${dir}/`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);

        if (dirInfo.exists && dirInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(dirPath);
          for (const file of files) {
            const filePath = `${dirPath}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (fileInfo.exists && !fileInfo.isDirectory) {
              const fileModificationTimeInSeconds = Math.floor(fileInfo.modificationTime);
              const ageInSeconds = nowInSeconds - fileModificationTimeInSeconds;

              recordingsInfo.push({
                folderPath: dirPath,
                filePath: filePath,
                ageInSeconds: ageInSeconds,
              });
            }
          }
        }
      }
    } else {
      console.log('No recordings directory found.');
    }
  } catch (error) {
    console.error('Error listing recordings with ages:', error);
  }

  return recordingsInfo;
};

export const listRecordings = async (): Promise<void> => {
  try {
    const recordingsDir = `${FileSystem.documentDirectory}recordings/`;
    const dirInfo = await FileSystem.getInfoAsync(recordingsDir);

    if (dirInfo.exists && dirInfo.isDirectory) {
      const dirs = await FileSystem.readDirectoryAsync(recordingsDir);

      const now = new Date().getTime();
      for (const dir of dirs) {
        const dirPath = `${recordingsDir}${dir}/`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);

        if (dirInfo.exists && dirInfo.isDirectory) {
          console.log(`Folder: ${dir}`);

          const files = await FileSystem.readDirectoryAsync(dirPath);
          for (const file of files) {
            const filePath = `${dirPath}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            if (fileInfo.exists && !fileInfo.isDirectory) {
              const fileCreationTime = new Date(fileInfo.modificationTime).getTime();
              const age = Math.floor(Date.now() / 1000) -  Math.floor( fileInfo.modificationTime/ 1000);

              console.log(`  File: ${file}`);
              console.log(`    Age: ${Math.floor(age / (1000 * 60 * 60))} hours`);
            }
          }
        }
      }
    } else {
      console.log('No recordings directory found.');
    }
  } catch (error) {
    console.error('Error listing recordings with ages:', error);
  }
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
