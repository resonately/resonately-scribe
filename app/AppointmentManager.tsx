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
    listRecordingsAsJson,
    deleteRecordingsByAge,
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
const MAX_RECORDINGS_AGE = 2 * 24 * 60 * 60; // 2 days

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
    private isRecordingPaused: boolean = false;
    private pauseCallback: (() => void) | null = null;
    private recordingInterruptionCheckTimeout: NodeJS.Timeout | null = null;

    private constructor() {
        // Register the background task
        this.registerBackgroundTask();
    }

    public setPauseCallback(callback: () => void) {
        this.pauseCallback = callback;
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
            // clear this timeout here because if recording is ongoing, then it is not interrupted
            if (this.recordingInterruptionCheckTimeout) {
                clearTimeout(this.recordingInterruptionCheckTimeout);
                this.recordingInterruptionCheckTimeout = null;
            }

        } else if (status.isDoneRecording) {
          console.log('Recording is done');
        } else if (status.mediaServicesDidReset) {
          console.log('>>>>>> Media services reset');
          if (this.recordingRef) {
            this.stopRecording();
          }
        } else if (!status?.isRecording && !status?.mediaServicesDidReset && status?.durationMillis === 0) {
            console.log('>>>>>>>> Recording stopped unexpectedly, checking for mic usage by another app...');
            
            //if rec interruption timeout is not set, then set it
            if(!this.recordingInterruptionCheckTimeout && !this.isRecordingPaused) {
                this.recordingInterruptionCheckTimeout = setTimeout(() => {
                    console.log('>>>>> Inside timeout for interruption check... calling pause callback now');
                    clearTimeout(this.recordingInterruptionCheckTimeout!);
                    this.recordingInterruptionCheckTimeout = null;
                    this.pauseCallback?.();
                }, 5000);
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

    private async pauseRecordingInInterruption () {
        if (this.pauseCallback) {
            this.stopAndUnloadRecording(this.recordingRef);
            this.pauseCallback();
            return;
        }
    }

    private async startAudioRecording() {


        // define the status callback here to get the latest values
        const handleRecordingStatusUpdate = async(status: Audio.RecordingStatus) => {
            if (status.isRecording) {
                console.log('Recording is ongoing...');
                // clear this timeout here because if recording is ongoing, then it is not interrupted
                if (this.recordingInterruptionCheckTimeout) {
                    clearTimeout(this.recordingInterruptionCheckTimeout);
                    this.recordingInterruptionCheckTimeout = null;
                }
    
            } else if (status.isDoneRecording) {
              console.log('Recording is done');
            } else if (status.mediaServicesDidReset) {
              console.log('>>>>>> Media services reset');
              if (this.recordingRef) {
                this.stopRecording();
              }
            } else if (!status?.isRecording && !status?.mediaServicesDidReset && status?.durationMillis === 0) {
                console.log('>>>>>>>> Recording stopped unexpectedly, checking for mic usage by another app...');
                
                // if rec interruption timeout is not set, then set it
                if(!this.recordingInterruptionCheckTimeout && !this.isRecordingPaused) {
                    this.recordingInterruptionCheckTimeout = setTimeout(() => {
                        console.log('>>>>> Inside timeout for interruption check... calling pause callback now');
                        clearTimeout(this.recordingInterruptionCheckTimeout!);
                        this.recordingInterruptionCheckTimeout = null;
                        this.pauseRecordingInInterruption();
                    }, 5000);
                }
    
            }
        };
    


        const currentRecodingStatus = await this.recordingRef?.getStatusAsync();
        console.log('>>>> Inside startAudioRecording: currentRecodingStatus', JSON.stringify(currentRecodingStatus));
        // try {
            const { recording, status } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                handleRecordingStatusUpdate
            );
            this.chunkStartTimeRef = new Date(); // Set the start time for the chunk
            this.isRecordingPaused = false;
            return {recording, status};
        // } catch (error) {
        //     console.log(">>>>> error in start audio recording: ", error);
        // }
        
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
        console.log(">>>>>> stop and unload the recording");
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
        console.log(">>>>> Saving chunk to async storage: ");
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
            
            const status = await this.recordingRef?.getStatusAsync();
            console.log(">>>>> Inside handle chunk creation: isLastChunk", isLastChunk, status);
            if(status && status.isRecording) {
                const unloadingStatus = await this.stopAndUnloadRecording(this.recordingRef);
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
            }

        } catch (error: any) {
            console.error(">>>>>>>>>>> Inside handle chunk creation", error.message);
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
            console.log(">>>> Inside start recording");
            await this.requestPermissions();
            const newRecordingId = uuid.v4().toString();
            this.updateRecordingId(newRecordingId); // Set the recordingId state
            await this.setAudioMode();
            const { recording, status } = await this.startAudioRecording();
            await this.addNewRecordingToList(newRecordingId, appointmentId);
            this.recordingRef = recording;


            // Log the event for starting recording
            analytics().logEvent('start_recording', {
                component: 'AppointmentManager',
                appointmentId: appointmentId,
                recordingId: newRecordingId,
                chunk_position: -1,  // -1 to indicate start of recording, not a chunk
                isLastchunk: false,
                status: 'started'
            });

            /**
             * TODO - IS this interval being set everytime this function runs? redundant?
             */
            // Interval ->  stop recording -> create chunk -> start recording again
            this.recordingIntervalRef = setInterval(async () => {
                try {
                    const currentRecordingStatus = await this.recordingRef?.getStatusAsync();
                    console.log(">>> Inside interval to stop and restart recording: currentRecordingStatus", JSON.stringify(currentRecordingStatus));
                    
                    // run this only when recording is in progress
                    if(currentRecordingStatus?.isRecording){
                        await this.handleChunkCreation();
                        const { recording, status } = await this.startAudioRecording();
                        this.recordingRef = recording;
                    }
                   
                } catch (error) {
                    console.error('Error running handleChunkCreation: ' + error);
                }
            }, MAX_CHUNK_DURATION_MS);
        } catch (err: any) {
            console.error('Failed to start recording', err);
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
            throw new Error(err?.message ?? 'Failed to start recording');
        }
    }

    public async pauseRecording() {
        if (this.recordingRef) {
            try {
                this.isRecordingPaused = true;
                // create the chunk just before pause is invoked to avoid any data loss
                this.handleChunkCreation();
                // upload the chunk created so far to the server
                this.uploadChunksPeriodically();
                // setTimeout(async () => {
                //     await this?.recordingRef?.pauseAsync();
                //     console.log('Recording paused');
                //     // Log the event for pausing recording
                //     analytics().logEvent('pause_recording', {
                //         component: 'AppointmentManager',
                //         appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                //         recordingId: this.recordingIdRef,
                //         chunk_position: -1,  // -1 to indicate pausing the recording, not a chunk
                //         isLastchunk: false,
                //         status: 'paused'
                //     });
                // }, 0);
                
            } catch (error: any) {
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
                throw new Error(error?.message ?? "Failed to pause recording");
            }
        }
    }

    public async resumeRecording() {
        if (this.recordingRef) {
            try {
                const currentRecodingStatus = await this.recordingRef.getStatusAsync();
                console.log(">>> Going to resume recording: ", currentRecodingStatus);
                // await this.recordingRef.startAsync();
                const { recording, status } = await this.startAudioRecording();
                this.recordingRef = recording;
                this.isRecordingPaused = false;

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
        // Log the event when recording stops
        analytics().logEvent('stop_recording', {
            component: 'AppointmentManager',
            appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
            recordingId: this.recordingIdRef,
            status: 'stopped'
        });

        try {

            // if recording is not going on, then return
            const currentRecodingStatus = await this.recordingRef?.getStatusAsync();
            console.log(">>>> Inside stop recording: currentRecodingStatus",JSON.stringify(currentRecodingStatus));
            if(!currentRecodingStatus?.isRecording){
                Alert.alert("Please resume the recording to end it");
                return false;
            }

            // Stop chunking.
            if (this.recordingIntervalRef) {
                clearInterval(this.recordingIntervalRef);
                this.recordingIntervalRef = null;
            }

            // set end date of the recording.
            const recording = this.recordingsRef.find(rec => rec.id === this.recordingIdRef);
            console.log(">>> Inside stop recording recording: ");
            const endDate = new Date().toISOString();
            if (recording) {
                recording.endDate = endDate;
                this.updateRecordingsState([...this.recordingsRef]);
                await saveRecordings(this.recordingsRef);
                await this.handleChunkCreation(true);
                this.recordingRef = null;
                return true;
            }

        } catch (error: any) {
            console.error(">>>> Inside stop recording error: ", error.message);
            // Log the event for failed stop recording
            analytics().logEvent('stop_recording_failed', {
                component: 'AppointmentManager',
                appointmentId: this.recordingsRef.find(rec => rec.id === this.recordingIdRef)?.appointmentId,
                recordingId: this.recordingIdRef,
                status: 'failed',
                error_message: error.message
            });
            this.recordingRef = null;
            throw new Error(error?.message ?? 'Failed to stop recording');
            
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
        // console.log('processChunks');
        for (const recording of this.recordingsRef) {
            let uploadSuccessful = false;
            if (recording.status !== 'Completed') {
                // Sort chunks by position in ascending order
                recording.chunks.sort((a, b) => a.position - b.position);

                for (const chunk of recording.chunks) {
                    if (chunk.status === 'created') {
                        // console.log(chunk);
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
                    console.log(">>> All the chunks of this recording has been uploaded and recording is complete now");
                    recording.status = 'Completed';
                    await this.saveUpdatedRecordingsState();
                }
            }
        }
    }
    
    private async deleteOldRecordings() {
        // console.log('Running deleteOldRecordings function...');
        const recordingsAsJson = await listRecordingsAsJson();
        await deleteRecordingsByAge(recordingsAsJson, MAX_RECORDINGS_AGE);
        // console.log(recordingsAsJson);

        // Fetch recordings from storage
        const savedRecordings = await loadRecordings();
        this.recordingsRef = savedRecordings;

        // Iterate over each recording
        for (const recording of this.recordingsRef) {
            const startTime = new Date(recording.startDate).getTime();
            const currentTime = Date.now();

            // Check if the recording is older than 5 seconds
            if (currentTime - startTime < MAX_RECORDINGS_AGE) {
                // console.log(`Recording ${recording.id} is still young. Ignoring.`);
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
            this.recordingsRef = this.recordingsRef.filter(rec => rec.id !== recording.id);
            console.log(`Recording ${recording.id} deleted from the list.`);
        }

        // Update the recordings storage
        await saveRecordings(this.recordingsRef);
        this.updateRecordingsState(this.recordingsRef);
        // console.log('Recordings storage updated.');
    };
    

    public async uploadChunksPeriodically() {
        if (!this.isProcessingRef) {
            this.isProcessingRef = true;
            // await this.deleteOldRecordings();
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