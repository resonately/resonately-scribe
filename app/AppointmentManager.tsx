import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';
import { AppState, Alert, Animated } from 'react-native';
import analytics from '@react-native-firebase/analytics';
import uuid from 'react-native-uuid';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { RecordingStatus } from 'expo-av/build/Audio';
import {
    getRecordingUri,
    storeRecordingLocally,
    uploadChunkToServer,
    deleteRecordingFolder,
} from './RecordUtils';
import { saveRecordings, loadRecordings } from './AsyncStorageUtils';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.rsn8ly.xyz';

export interface Chunk {
    position: number;
    isLastChunk: boolean;
    uri: string;
    startTime: string;
    endTime: string;
    status: string;
    retryCount: number;
}

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

const MAX_CHUNK_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const CHUNK_UPLOAD_FREQUENCY = 10 * 1000; // 10 seconds
const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_UPLOAD_TASK';

class AppointmentManager {
    private static instance: AppointmentManager;
    private tenantName: string | undefined;
    private recordingRef: Audio.Recording | null = null;
    private recordingIdRef: string | null = null;
    private chunkStartTimeRef: Date | null = null;
    private recordingIntervalRef: NodeJS.Timeout | null = null;
    private recordingsRef: Recording[] = [];
    private uploadIntervalRef: NodeJS.Timeout | null = null;
    private isProcessingRef: boolean = false;

    private constructor() {
        // Register the background task
        this.registerBackgroundTask();
    }

    public static getInstance(): AppointmentManager {
        if (!AppointmentManager.instance) {
            AppointmentManager.instance = new AppointmentManager();
        }
        return AppointmentManager.instance;
    }

    public setTenantName(tenantName: string) {
        this.tenantName = tenantName;
    }

    private async registerBackgroundTask() {
        TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
            try {
                console.log('Background task is running...');
                await this.processChunks();
                return BackgroundFetch.BackgroundFetchResult.NewData;
            } catch (error) {
                console.error('Error in background task:', error);
                return BackgroundFetch.BackgroundFetchResult.Failed;
            }
        });

        const status = await BackgroundFetch.getStatusAsync();
        if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
            await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
                minimumInterval: 15 * 60, // 15 minutes
                stopOnTerminate: false,
                startOnBoot: true,
            });
        }
    }

    private updateRecordingsState(newRecordings: Recording[]) {
        this.recordingsRef = newRecordings;
    }

    private updateRecordingId(newRecordingId: string | null) {
        this.recordingIdRef = newRecordingId;
    }

    private async requestPermissions() {
        console.log('Requesting permissions...');
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
            throw new Error('Permission to access microphone is required!');
        }
    }

    private async handleRecordingStatusUpdate (status: Audio.RecordingStatus) {
        if (status.isRecording) {
          console.log('Recording is ongoing...');
        } else if (status.isDoneRecording) {
          console.log('Recording is done');
        } else if (status.mediaServicesDidReset) {
          console.log('Media services reset, possibly due to microphone access loss');
          if (this.recordingRef) {
            this.stopRecording();
          }
        }
    };

    private async setAudioMode() {
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
    }

    private async startAudioRecording() {
        console.log('Starting recording...');
        const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY,
            this.handleRecordingStatusUpdate
        );
        this.chunkStartTimeRef = new Date(); // Set the start time for the chunk
        return recording;
    }

    private async addNewRecordingToList(newRecordingId: string, appointmentId: string) {
        const newRecording: Recording = {
            id: newRecordingId,
            appointmentId: appointmentId,
            startDate: new Date().toISOString(),
            endDate: null,
            status: 'In Progress',
            sound: null,
            chunks: [],
            chunkCounter: 0,
        };

        const updatedRecordings = [newRecording, ...this.recordingsRef];
        await saveRecordings(updatedRecordings); // Save updated recordings
        this.updateRecordingsState(updatedRecordings);

        return newRecording;
    }

    private async stopAndUnloadRecording(recording: Audio.Recording | null) {
        await recording?.stopAndUnloadAsync();
    }

    private async handleRecordingUri(recording: Audio.Recording | null) {
        if (recording) {
            const recordingUri = await getRecordingUri(recording);
            if (recordingUri && this.recordingIdRef) {
                return storeRecordingLocally(recordingUri, this.recordingIdRef);
            } else {
                throw new Error('Recording URI not found');
            }
        } else {
            console.log('No recording found.');
        }
    }

    private createChunk(localFileUri: string, chunkStartTime: Date, chunkEndTime: Date, isLastChunk: boolean): Chunk {
        const recording = this.recordingsRef.find((rec) => rec.id === this.recordingIdRef);
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
    }

    private async addChunkToAsyncStorage(chunk: Chunk) {
        const updatedRecordings = this.recordingsRef.map((rec) => {
            if (rec.id === this.recordingIdRef) {
                if (!rec.chunks) {
                    rec.chunks = [];
                }
                rec.chunks.push(chunk);
            }
            return rec;
        });
        await saveRecordings(updatedRecordings); // Save updated recordings
        this.updateRecordingsState(updatedRecordings);
    }

    private incrementChunkCounter() {
        const updatedRecordings = this.recordingsRef.map((rec) => {
            if (rec.id === this.recordingIdRef) {
                rec.chunkCounter = (rec.chunkCounter ?? 0) + 1;
            }
            return rec;
        });
        saveRecordings(updatedRecordings); // Save updated recordings
        this.updateRecordingsState(updatedRecordings);
    }

    public async handleChunkCreation(isLastChunk: boolean = false) {
        try {
            await this.stopAndUnloadRecording(this.recordingRef);
            const localFileUri = await this.handleRecordingUri(this.recordingRef);

            if (localFileUri) {
                const chunk = this.createChunk(localFileUri, this.chunkStartTimeRef!, new Date(), isLastChunk);
                await this.addChunkToAsyncStorage(chunk); // Add chunk to async storage
                this.incrementChunkCounter();

                // Log the event for chunk creation
                analytics().logEvent('chunk_created', {
                    component: 'AppointmentManager',
                    appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                    recordingId: this.recordingIdRef,
                    chunk_position: chunk.position,
                    isLastchunk: chunk.isLastChunk,
                    status: chunk.status
                });
            }

        } catch (error: any) {
            console.error(error.message);
            // Log the event for chunk creation failure
            analytics().logEvent('chunk_creation_failed', {
                component: 'AppointmentManager',
                appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                recordingId: this.recordingIdRef,
                chunk_position: -1,  // -1 to indicate failure to create chunk
                isLastchunk: isLastChunk,
                status: 'failed',
                error_message: error.message
            });
        }
    }

    public async startRecording(appointmentId: string) {
        try {
            await this.requestPermissions();
            const newRecordingId = uuid.v4().toString();
            this.updateRecordingId(newRecordingId); // Set the recordingId state
            await this.setAudioMode();
            const newRecording = await this.startAudioRecording();
            await this.addNewRecordingToList(newRecordingId, appointmentId);
            this.recordingRef = newRecording;

            // Log the event for starting recording
            analytics().logEvent('start_recording', {
                component: 'AppointmentManager',
                appointmentId: appointmentId,
                recordingId: newRecordingId,
                chunk_position: -1,  // -1 to indicate start of recording, not a chunk
                isLastchunk: false,
                status: 'started'
            });

            // Set up interval to stop and restart the recording every minute
            this.recordingIntervalRef = setInterval(async () => {
                try {
                    await this.handleChunkCreation();
                    const newRecording = await this.startAudioRecording();
                    this.recordingRef = newRecording;
                } catch (error) {
                    console.error('Error running handleChunkCreation: ' + error);
                }
            }, MAX_CHUNK_DURATION_MS);
        } catch (err: any) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', err.message);
            // Log the event for failed start recording
            analytics().logEvent('start_recording_failed', {
                component: 'AppointmentManager',
                appointmentId: appointmentId,
                recordingId: null,
                chunk_position: -1,
                isLastchunk: false,
                status: 'failed',
                error_message: err.message
            });
        }
    }

    public async pauseRecording() {
        if (this.recordingRef) {
            console.log(`Recording Paused.`);
            try {
                await this.recordingRef.pauseAsync();
                console.log('Recording paused');

                // Log the event for pausing recording
                analytics().logEvent('pause_recording', {
                    component: 'AppointmentManager',
                    appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                    recordingId: this.recordingIdRef,
                    chunk_position: -1,  // -1 to indicate pausing the recording, not a chunk
                    isLastchunk: false,
                    status: 'paused'
                });
            } catch (error) {
                console.error('Failed to pause recording:', error);
                // Log the event for failed pause recording
                analytics().logEvent('pause_recording_failed', {
                    component: 'AppointmentManager',
                    appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                    recordingId: this.recordingIdRef,
                    chunk_position: -1,  // -1 to indicate pausing the recording, not a chunk
                    isLastchunk: false,
                    status: 'failed',
                    error_message: JSON.stringify(error)
                });
            }
        }
    }

    public async resumeRecording() {
        if (this.recordingRef) {
            console.log(`Recording Resumed.`);
            try {
                await this.recordingRef.startAsync();
                console.log('Recording resumed');

                // Log the event for resuming recording
                analytics().logEvent('resume_recording', {
                    component: 'AppointmentManager',
                    appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                    recordingId: this.recordingIdRef,
                    status: 'resumed'
                });
            } catch (error) {
                console.error('Failed to resume recording:', error);
                // Log the event for failed resume recording
                analytics().logEvent('resume_recording_failed', {
                    component: 'AppointmentManager',
                    appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                    recordingId: this.recordingIdRef,
                    status: 'failed',
                    error_message: JSON.stringify(error)
                });
            }
        }
    }

    public async stopRecording() {
        console.log('stopRecording');
        // Log the event when recording stops
        analytics().logEvent('stop_recording', {
            component: 'AppointmentManager',
            appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
            recordingId: this.recordingIdRef,
            status: 'stopped'
        });

        try {
            // Stop chunking.
            if (this.recordingIntervalRef) {
                clearInterval(this.recordingIntervalRef);
                this.recordingIntervalRef = null;
            }

            // set end date of the recording.
            const recording = this.recordingsRef.find(rec => rec.id === this.recordingIdRef);
            const endDate = new Date().toISOString();
            if (recording) {
                recording.endDate = endDate;
                this.updateRecordingsState([...this.recordingsRef]);
                await saveRecordings(this.recordingsRef);
            }

            await this.handleChunkCreation(true);

        } catch (error: any) {
            console.error(error.message);
            // Log the event for failed stop recording
            analytics().logEvent('stop_recording_failed', {
                component: 'AppointmentManager',
                appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                recordingId: this.recordingIdRef,
                status: 'failed',
                error_message: error.message
            });
        } finally {
            this.recordingRef = null;
        }
    }

    private async uploadChunk(chunk: Chunk, recording: Recording, tenantName: string) {
        const success = await uploadChunkToServer(chunk, recording, tenantName);
        if (success) {
            chunk.status = 'uploaded';
            await this.saveUpdatedRecordingsState();

            // Log the event for successful chunk upload
            analytics().logEvent('chunk_upload_success', {
                component: 'AppointmentManager',
                appointmentId: recording.appointmentId,
                recordingId: recording.id,
                chunk_position: chunk.position,
                isLastchunk: chunk.isLastChunk,
                status: chunk.status
            });

            return true;
        } else {
            // Log the event for unsuccessful chunk upload
            analytics().logEvent('chunk_upload_failed', {
                component: 'AppointmentManager',
                appointmentId: recording.appointmentId,
                recordingId: recording.id,
                chunk_position: chunk.position,
                isLastchunk: chunk.isLastChunk,
                status: 'failed',
                error_message: 'Failed to upload chunk'
            });

            return false;
        }
    }

    private async saveUpdatedRecordingsState() {
        await saveRecordings(this.recordingsRef);
        this.updateRecordingsState(this.recordingsRef);
    }

    private async processChunks() {
        console.log('processChunks');
        for (const recording of this.recordingsRef) {
            let uploadSuccessful = false;
            if (recording.status !== 'Completed') {
                // Sort chunks by position in ascending order
                recording.chunks.sort((a, b) => a.position - b.position);

                for (const chunk of recording.chunks) {
                    if (chunk.status === 'created') {
                        console.log(chunk);
                        await this.saveUpdatedRecordingsState();
                        const uploadSuccess = await this.uploadChunk(chunk, recording, this.tenantName!);
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
                    recording.status = 'Completed';
                    await this.saveUpdatedRecordingsState();
                }
            }
        }
    }

    public async uploadChunksPeriodically() {
        if (!this.isProcessingRef) {
            this.isProcessingRef = true;
            await this.loadAndProcessChunks();
            this.isProcessingRef = false;
        }
    }

    private async loadAndProcessChunks() {
        const savedRecordings = await loadRecordings();
        this.updateRecordingsState(savedRecordings);
        try {
            await this.processChunks();
        } catch (err) {
            console.log('Error processing chunks');
            // Log the event for chunk processing failure
            analytics().logEvent('process_chunks_failed', {
                component: 'AppointmentManager',
                appointmentId: null,
                recordingId: null,
                chunk_position: -1,
                isLastchunk: false,
                status: 'failed',
                error_message: JSON.stringify(err)
            });
        }
    }
}

export default AppointmentManager.getInstance();
