import { Audio, AVPlaybackStatus } from 'expo-av';
// import { insertMedicalRecording, getMedicalRecordings, deleteMedicalRecording, deleteMedicalRecordings, updateMedicalRecordingStatus, insertChunk, getChunks, updateMedicalRecordingEndDateAndStatus, updateMedicalRecordingChunkCounter } from './dao/MedicalRecordingDAO';
import * as FileSystem from 'expo-file-system';
// import { moveFileToPermanentDirectory } from './utils/fileUtils';
import uuid from 'react-native-uuid';

// import { MedicalRecording, Chunk } from './models/MedicalRecording';

class AudioRecordingManager {
    private static instance: AudioRecordingManager;

    // // the recording object of the currently active recording
    // private recording: Audio.Recording | null = null;

    // // the medical recording object of the currently active recording

    // private activeMedicalRecording: MedicalRecording | null = null;

    // private activeChunk: Chunk | null = null;

    // // Private constructor to prevent direct instantiation
    private constructor() { }

    // // Get the singleton instance
    public static getInstance(): AudioRecordingManager {
        if (!AudioRecordingManager.instance) {
            AudioRecordingManager.instance = new AudioRecordingManager();
        }
        return AudioRecordingManager.instance;
    }

    // private async setAudioMode() {
    //     console.log('Setting audio mode...');
    //     await Audio.setAudioModeAsync({
    //         allowsRecordingIOS: true,
    //         playsInSilentModeIOS: true,
    //         interruptionModeIOS: 0,
    //         staysActiveInBackground: true,
    //         interruptionModeAndroid: 1,
    //         shouldDuckAndroid: true,
    //         playThroughEarpieceAndroid: true,
    //     });
    // }

    // private async requestPermissions() {
    //     console.log('Requesting permissions...');
    //     const permission = await Audio.requestPermissionsAsync();
    //     if (permission.status !== 'granted') {
    //         throw new Error('Permission to access microphone is required!');
    //     }
    // }

    // // Start recording
    // public async startRecording(): Promise<void> {
    //     try {
    //         // check if a recording is in progress, and if so, do nothing and return.
    //         this.checkIfRecordingOngoing();

    //         // request microphone permissions
    //         await this.requestPermissions();

    //         // configure Audio Mode 
    //         await this.setAudioMode();

    //         // Create a new recording instance
    //         await this.createNewAudioRecordingInstance();

    //     } catch (error) {
    //         console.error('Error starting recording:', error);
    //     }
    // }

    // private async checkIfRecordingOngoing() {
    //     if (this.recording) {
    //         console.warn('Recording is already in progress.');
    //         return;
    //     }
    // }

    // private async createNewAudioRecordingInstance() {
    //     this.recording = new Audio.Recording();
    //     await this.recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    //     await this.recording.startAsync();

    //     console.log('Recording started');
    // }

    // // Stop recording
    // public async stopRecording(): Promise<string | null> {
    //     try {
    //         if (!this.recording) {
    //             console.warn('No recording in progress.');
    //             return null;
    //         }

    //         await this.recording.stopAndUnloadAsync();
    //         const uri = this.recording.getURI();
    //         console.log('Recording stopped. File URI:', uri);

    //         // Clear the recording instance
    //         this.recording = null;

    //         return uri;
    //     } catch (error) {
    //         console.error('Error stopping recording:', error);
    //         return null;
    //     }
    // }

    // // Start recording
    // public async startMedicalRecording(recording: MedicalRecording): Promise<void> {

    //     console.log(`Recording: ${JSON.stringify(recording)}`);
    //     // insert a medical recording into the database with status created
    //     const recordingObj = await insertMedicalRecording(recording);

    //     if (!recordingObj || !recordingObj.id) {
    //         console.log(`Error inserting a new medical recording.`);
    //         return;
    //     }

    //     this.activeMedicalRecording = recordingObj;

    //     this.resetState();

    //     this.startRecording();
    //     // update the medical recording with status 'started'
    //     this.activeMedicalRecording.status = 'started';
    //     await updateMedicalRecordingStatus(recordingObj?.id, this.activeMedicalRecording.status);
    // }

    // resetState() {
    //     if (!this.activeMedicalRecording || !this.activeMedicalRecording.id) {
    //         return;
    //     }
    //     this.activeMedicalRecording.chunk_counter = 0;

    //     this.activeChunk = {
    //         position: 0,
    //         is_last_chunk: false,
    //         status: 'created',
    //         retry_count: 0,
    //         recording_id: this.activeMedicalRecording.id,
    //         uri: '',
    //         start_time: new Date().toISOString(),
    //         end_time: null
    //     }
    // }

    // public async endMedicalRecording(): Promise<void> {

    //     this.createAndInsertChunk(true);

    //     if (this.activeMedicalRecording?.id) {
    //         updateMedicalRecordingEndDateAndStatus(this.activeMedicalRecording?.id, new Date().toISOString(), 'stopped');
    //     }

    //     const medicalRecordings = await getMedicalRecordings();
    //     console.log(`Medical Recordings: ${JSON.stringify(medicalRecordings)}`);

    //     const chunks = await getChunks();
    //     console.log(`Chunks: ${JSON.stringify(chunks)}`);

    //     await deleteMedicalRecordings();
    // }

    // private async createAndInsertChunk(isLastChunk: boolean = false) {
    //     // Stop and unload the last chunk
    //     const cachedAudioFilePath = await this.stopRecording();

    //     if (!this.activeMedicalRecording || !this.activeMedicalRecording.id || !this.activeMedicalRecording.chunk_counter) {
    //         console.log(`No medical recording found in the class.`);
    //         return;
    //     }

    //     if (!cachedAudioFilePath) {
    //         console.log(`No audio file path found.`);
    //         return;
    //     }

    //     if (!this.activeChunk) {
    //         console.log(`No active chunk found.`);
    //         return;
    //     }

    //     const fileName = 'recordings/' + uuid.v4() + '.m4a';

    //     const audioFilePath = await moveFileToPermanentDirectory(cachedAudioFilePath, fileName);

    //     // set all key variables
    //     this.activeChunk.position = this.activeMedicalRecording.chunk_counter
    //     this.activeChunk.is_last_chunk = isLastChunk;
    //     this.activeChunk.end_time = new Date().toISOString();
    //     this.activeChunk.uri = audioFilePath;
    //     this.activeChunk.status = 'created';

    //     try {
    //         // Insert the new chunk
    //         const insertedChunk = await insertChunk(this.activeChunk);
    //         console.log(`Inserted Chunk: ${JSON.stringify(insertedChunk)}`);
    //     } catch (error: any) {
    //         console.error('Error inserting chunk:', error.message, error);
    //         return;
    //     }
    // }

    // private async chunkRecording(): Promise<void> {
    //     try {
    //         console.log('Chunking the current recording...');

    //         if (!this.activeMedicalRecording || !this.activeMedicalRecording.id) {
    //             console.log(`No active medical recording found`);
    //             return;
    //         }

    //         // Step 1: Stop the current recording and create a chunk
    //         await this.createAndInsertChunk(false);

    //         // increment the chunk counter of the medical recording
    //         const chunkCounter = this.activeMedicalRecording.chunk_counter + 1;

    //         this.activeChunk = {
    //             position: chunkCounter,
    //             is_last_chunk: false,
    //             status: 'created',
    //             retry_count: 0,
    //             recording_id: this.activeMedicalRecording.id,
    //             uri: '',
    //             start_time: new Date().toISOString(),
    //             end_time: null
    //         }

    //         // start new recording
    //         this.startRecording();
            
    //         // update the medical recording with status 'started'
    //         await updateMedicalRecordingChunkCounter(this.activeMedicalRecording.id, this.activeMedicalRecording.chunk_counter);

    //     } catch (error) {
    //         console.error('Error during chunking recording:', error);
    //         throw error;
    //     }
    // };

}

export default AudioRecordingManager.getInstance();
