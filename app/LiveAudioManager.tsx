import LiveAudioStream, { Options } from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import { Dispatch, SetStateAction } from 'react';
import { Chunk, CHUNK_STATUS, Recording, RECORDING_STATUS } from './types';
import DatabaseService from './DatabaseService';
import { uploadChunkToServer } from './RecordUtils';

const INTERRUPTION_PAUSE_INTERVAL: number = 5000; // 5 seconds
const MAX_DATA_WAIT_TIME: number = 5000; // 10 seconds
const CHUNK_DURATION: number = 30 * 1000; // 30 seconds in milliseconds

class LiveAudioManager {
  private static instance: LiveAudioManager;
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  private currentChunk: Buffer = Buffer.alloc(0);
  private chunkStartTime: string = '';
  private chunkCounter: number = 0;
  private lastDataReceivedTime: number = 0;
  private interruptionCheckTimer: NodeJS.Timeout | null = null;
  private pauseCallback: Dispatch<SetStateAction<boolean>> | null = null;
  private handleCompleteChunkInterval: NodeJS.Timeout | null = null;
  private appointmentId: string | undefined = undefined;
  private currentRecordingObj: Recording | null = null;
  private tenantName: string = '';

  private constructor(appointmentId?: string) {
    // this.initializeAudioStream(appointmentId);
  }

  public static getInstance(appointmentId?: string): LiveAudioManager {
    if (!LiveAudioManager.instance) {
      LiveAudioManager.instance = new LiveAudioManager(appointmentId);
    }
    return LiveAudioManager.instance;
  }

  public setPauseCallback(callback: Dispatch<SetStateAction<boolean>>) {
    this.pauseCallback = callback;
  }

  public setTenantName(tenantName: string) {
    this.tenantName = tenantName;
  }

  private async initializeAudioStream(appointmentId?: string): Promise<void> {

    if(!appointmentId) {
      throw new Error("Appointment Id missing");
    }
    const options: Options = {
      sampleRate: 32000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 4096,
      wavFile: ''
    };

    LiveAudioStream.init(options);

    if(!this.isPaused) {
      this.appointmentId = appointmentId;
      this.currentRecordingObj = {
        id: uuid.v4().toString(),
        appointmentId: appointmentId,
        startDate: new Date().toISOString(),
        endDate: null,
        status: RECORDING_STATUS.In_Progress,
        chunks: [],
        chunkCounter: 0,
      }
      await DatabaseService.getInstance().createRecording(this.currentRecordingObj);
    }

    LiveAudioStream.on('data', (data: string) => {
      if (this.isStreaming && !this.isPaused) {
        console.log("Recoding is ongoing...");
        const chunk = Buffer.from(data, 'base64');
        this.processAudioChunk(chunk);
        this.lastDataReceivedTime = Date.now();
      }
    });

    this.handleCompleteChunkInterval = setInterval(async () => {
      if (this.isStreaming && this.currentChunk.length > 0 && !this.isPaused) {
        await this.handleCompleteChunk();
      }
    }, CHUNK_DURATION);

    this.startInterruptionCheckTimer();

  }

  // checking for interruption
  private startInterruptionCheckTimer(): void {
    this.interruptionCheckTimer = setInterval(async () => {
      if (this.isStreaming && !this.isPaused) {
        const currentTime = Date.now();
        if (currentTime - this.lastDataReceivedTime > MAX_DATA_WAIT_TIME) {
          console.log('No data received for a while, pausing the recording');
          await this.pauseStreaming(true);
        }
      }
    }, INTERRUPTION_PAUSE_INTERVAL);
  }

  private stopInterruptionCheckTimer(): void {
    if (this.interruptionCheckTimer) {
      clearInterval(this.interruptionCheckTimer);
      this.interruptionCheckTimer = null;
    }
  }

  private processAudioChunk(chunk: Buffer): void {
    if (this.currentChunk.length === 0) {
      this.chunkStartTime = new Date().toISOString();
    }

    this.currentChunk = Buffer.concat([this.currentChunk, chunk]);
  }

  private createChunk({ chunkCounter, isLastChunk = false, uri, startTime }: {chunkCounter: number, isLastChunk: boolean, uri: string, startTime: string}): Chunk{
    return {
      position: chunkCounter,
      isLastChunk,
      uri, 
      startTime: startTime ?? new Date(new Date().getTime() - CHUNK_DURATION).toISOString(),
      endTime: new Date().toISOString(),
      status: CHUNK_STATUS.Created,
    }
  }

  private updateCurrentRecording(chunk: Chunk, currentChunkPosition: number, isLastChunk: boolean) {
    console.log(">>>> Inside updatecurrentrecording: ", isLastChunk, chunk);
    if(this.currentRecordingObj) {
      this.currentRecordingObj = {
        ...this.currentRecordingObj,
        endDate: isLastChunk ? new Date().toISOString() : null,
        chunkCounter: currentChunkPosition + 1,
        chunks: [...this.currentRecordingObj?.chunks, chunk],
      }
    }
  }

  private async updateLocalDB(chunk: Chunk, currentChunkPosition: number, isLastChunk: boolean) {
    if(this.currentRecordingObj) {
      await DatabaseService.getInstance().updateRecordingChunkCounter(this.currentRecordingObj, currentChunkPosition);
      await DatabaseService.getInstance().insertChunk(this.currentRecordingObj.id!, chunk);

      if(isLastChunk) {
        await DatabaseService.getInstance().updateRecordingendDate(this.currentRecordingObj, new Date().toISOString());
      }
    }
  }


  /**
   * This will run every CHUNK_DURATION duration and will do these steps:
   * 1. Create chunk path and save the current chunk to the file system
   * 2. Restart variables for next chunk 
   * 3. Update the recording object in DB and insert chunk in DB
   * 4. Upload the chunks to server
   */
  private async handleCompleteChunk({isLastChunk}: { isLastChunk: boolean } = {isLastChunk: false}): Promise<void> {
    console.log(">>> Inside handlecomplete chunk appointmentId is:", this.appointmentId, isLastChunk);
    const chunkFileName = `audio_chunk_${this.chunkCounter}.raw`;
    const chunkFilePath = `${FileSystem.documentDirectory}recordings/${this.appointmentId}/${chunkFileName}`;

    try {
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}recordings/${this.appointmentId}`, { intermediates: true });
      await FileSystem.writeAsStringAsync(chunkFilePath, this.currentChunk.toString('base64'), { encoding: FileSystem.EncodingType.Base64 });

      const fileDetails = await FileSystem.getInfoAsync(chunkFilePath);
      if(fileDetails.exists){
        if(fileDetails.size > 0) {

          this.currentChunk = Buffer.alloc(0);
          const newChunkObj = this.createChunk({ chunkCounter: this.chunkCounter, isLastChunk , startTime: this.chunkStartTime, uri: chunkFilePath });
          this.updateCurrentRecording(newChunkObj, this.chunkCounter, isLastChunk);
          await this.updateLocalDB(newChunkObj, this.chunkCounter, isLastChunk);
          this.chunkCounter++;
          if(!isLastChunk) {
            await this.uploadChunksToServer(this.tenantName, false);
          }

        }
      }

    } catch (error) {
      console.error('Error saving audio chunk to local file:', error);
    }
  }


  public startStreaming(appointmentId: string): void {
    try{
      console.log(">>> Inside start streaming appointmentId: ", appointmentId);
      this.initializeAudioStream(appointmentId);
      LiveAudioStream.start();
      this.isStreaming = true;
      this.isPaused = false;
      this.currentChunk = Buffer.alloc(0);
      this.chunkStartTime = new Date().toISOString();
      this.lastDataReceivedTime = Date.now();
      this.appointmentId = appointmentId;
    } catch (err) {
      console.error("Error in start streaming: ", err);
    }
  }

  public async stopStreaming(isComingFromPause: boolean = false): Promise<boolean> {
    try{
      console.log(">>> Inside stop Streaming isComingFromPause: ", isComingFromPause, this.isPaused, this.isStreaming);
      if (this.isStreaming && !this.isPaused) {
        LiveAudioStream.stop();
        this.stopInterruptionCheckTimer();
        clearInterval(this.handleCompleteChunkInterval as NodeJS.Timeout);
      
        if(isComingFromPause) {
          await this.handleCompleteChunk();
          return false;
        } else {
          await this.handleCompleteChunk({ isLastChunk: true }); 
          this.chunkCounter=0;
          this.appointmentId = undefined;
          this.currentRecordingObj = null;
          this.isStreaming = false;
          this.isPaused = false;
          this.tenantName = '';
          return true;
        }
      } else {
        console.error('>>>Audio streaming is not active');
        return false;
      }
    } catch (err) {
      console.error("Error in stop streaming: ", err);

      return false;
    }
  }

  public async pauseStreaming(internal: boolean = false) {
    console.log(">>>> Inside pause streaming internal", internal);
    if (this.isStreaming && !this.isPaused) { 
      if(internal && this.pauseCallback) {
        this.pauseCallback(true);
        clearInterval(this.handleCompleteChunkInterval as NodeJS.Timeout);
      }
      await this.stopStreaming(true);
      this.isPaused = true;
      console.log('>>>Audio streaming paused');
    } else if (!this.isStreaming) {
      console.log('>>>Cannot pause, audio streaming is not active');
    } else if (this.isPaused) {
      console.log('>>>Audio streaming is already paused');
    }
  }

  public resumeStreaming(): void {
    console.log('>>>Audio streaming resumed', this.isPaused, this.isStreaming);
    if (this.isStreaming && this.isPaused) {
      this.chunkStartTime = new Date().toISOString(); // Reset the chunk start time
      this.lastDataReceivedTime = Date.now();
      this.startStreaming(this.appointmentId ?? '');
    } else if (!this.isStreaming) {
      console.log('>>>Cannot resume, audio streaming is not active');
    } else if (!this.isPaused) {
      console.log('>>>Audio streaming is not paused');
    }
  }

  public async listAllFiles() {
    try {
      const directoryPath = `${FileSystem.documentDirectory}recordings/`;
      const appointmentDirectories = await FileSystem.readDirectoryAsync(directoryPath);
  
      for (const appointmentId of appointmentDirectories) {
        const appointmentDirectoryPath = `${directoryPath}${appointmentId}/`;
        const files = await FileSystem.readDirectoryAsync(appointmentDirectoryPath);
  
        console.log(`>>> Files in ${appointmentDirectoryPath}:`);
        files?.forEach((file) => {
          console.log(">>>>", file);
        });
      }
      console.log(">>>> listed all the files present");
    } catch (error) {
      console.error('Error reading files:', error);
    }
  };

  public async deleteAllFiles() {
    try {
      const directoryPath = `${FileSystem.documentDirectory}recordings/`;
      const recordingsDirectoryExists = await FileSystem.getInfoAsync(directoryPath);
      if (!recordingsDirectoryExists.exists) {
        console.log('No recordings directory found.');
        return;
      }
      const appointmentDirectories = await FileSystem.readDirectoryAsync(directoryPath);
  
      for (const appointmentId of appointmentDirectories) {
        const appointmentDirectoryPath = `${directoryPath}${appointmentId}/`;
        const files = await FileSystem.readDirectoryAsync(appointmentDirectoryPath);
  
        for (const file of files) {
          const filePath = `${appointmentDirectoryPath}${file}`;
          const fileExists = await FileSystem.getInfoAsync(filePath);
          if (fileExists.exists) {
            await FileSystem.deleteAsync(filePath);
            console.log(`Deleted file: ${filePath}`);
          } else {
            console.log(`File not found: ${filePath}`);
          }
        }
  
        // Optionally, you can also delete the appointment directory itself if you want
        // Check again before deleting the directory itself
        const updatedAppointmentDirectoryExists = await FileSystem.getInfoAsync(appointmentDirectoryPath);
        if (updatedAppointmentDirectoryExists.exists) {
          await FileSystem.deleteAsync(appointmentDirectoryPath, { idempotent: true });
          console.log(`Deleted directory: ${appointmentDirectoryPath}`);
        } else {
          console.log(`Directory already deleted or not found: ${appointmentDirectoryPath}`);
        }
      }
      console.log('All files and directories deleted.');
    } catch (error) {
      console.error('Error deleting files:', error);
    }
  };

  private async deleteAllChunksOfARecording(appointmentId: string) {
	try {
		const directoryPath = `${FileSystem.documentDirectory}recordings/`;
		const appointmentDirectoryPath = `${directoryPath}${appointmentId}/`;
		const files = await FileSystem.readDirectoryAsync(appointmentDirectoryPath);
  
        for (const file of files) {
          const filePath = `${appointmentDirectoryPath}${file}`;
          await FileSystem.deleteAsync(filePath);
          console.log(`>>>> Deleted file: ${filePath}`);
        }
  
        // Optionally, you can also delete the appointment directory itself if you want
        await FileSystem.deleteAsync(appointmentDirectoryPath, { idempotent: true });
        console.log(`>>>> Deleted directory: ${appointmentDirectoryPath}`);

    } catch (error) {
      console.error('Error deleting files:', error);
    }
  };

  /**
   * 1. This functions check for recordings present in local DB and upload their chunks to server
   * 2. It also checks if all chunks of a rec are uploaded and rec is not going on, then clear the DB and local files
   * 3. This gets called at multiple places:
   *    a. When the recording is going on It runs on every CHUNK_DURATION
   *    b. When the app is in background, it runs every 15 minutes as a background task
   *    c. When the app is foreground and rec is not going on, it runs every 5 minutes
   *    d. When the user clicks on end recording
   */
  public async uploadChunksToServer(tenantName: string, cleanup: boolean) {
    try {
      // get all the recordings from sqlite DB
      const allRecordingsInLocalDB = await DatabaseService.getInstance().getRecordings();

      console.log(">>> Inside uploadChunksToServer recordings in local db: ", allRecordingsInLocalDB);
      if(!allRecordingsInLocalDB || allRecordingsInLocalDB.length === 0) {
        return;
      }
    
      // loop through all recording and call RecordUtils.uploadRecording(chunk, recordingId, tenantName) for each recording
      for (const recording of allRecordingsInLocalDB) {
        for (const chunk of recording.chunks) {
          if(chunk.status === CHUNK_STATUS.Created) {
              // upload the chunk
              const success = await uploadChunkToServer(chunk, recording, tenantName);
              if(success) {
                chunk.status = CHUNK_STATUS.Uploaded;
                // update the local sqlite db here as well, since we are not deleting the chunk as of now.
                await DatabaseService.getInstance().updateChunkStatus(chunk, recording.id!);
              }
          }
        }
        if(cleanup && !this.isStreaming) {
          let isAllChunksUploaded = recording.chunks.every((chunk) => chunk.status === CHUNK_STATUS.Uploaded);
          const isLastChunkPresent = recording.chunks.some((chunk) => chunk.isLastChunk);
          console.log(">>> isAllChunksUploaded: ", isAllChunksUploaded);
          if(isAllChunksUploaded && isLastChunkPresent) {
            // delete the recording 
            await DatabaseService.getInstance().deleteRecording(recording.id!); // delete recording from sqlite
            this.deleteAllChunksOfARecording(recording.appointmentId); // delete files from local filesystem
          }
        }
      }
      
    } catch (error) {
      console.error('Error uploading chunks to server:', error);
    }
  }


  public async handleStaleRecordings(tenantName: string) {
    try {
        // Get all recordings from SQLite DB
        const allRecordingsInLocalDB = await DatabaseService.getInstance().getRecordings();

        console.log(">>> Handling stale recordings. All recordings in local DB: ", allRecordingsInLocalDB);
        if (!allRecordingsInLocalDB || allRecordingsInLocalDB.length === 0) {
            return;
        }

        // Loop through all recordings
        for (const recording of allRecordingsInLocalDB) {
            const { chunks } = recording;
            if (chunks.length === 0) continue;

            // Check if the last chunk is present
            const lastChunkIndex = chunks.length - 1;
            const isLastChunkPresent = chunks.some(chunk => chunk.isLastChunk);

            if (!isLastChunkPresent) {
                console.log(">>> Last chunk is missing for recording: ", recording.id);
                // Set isLastChunk to true for the last chunk
                chunks[lastChunkIndex].isLastChunk = true;

                // Update the chunk in the local SQLite DB
                await DatabaseService.getInstance().updateChunkStatus(chunks[lastChunkIndex], recording.id!);
            }
        }

        // Call uploadChunksToServer with cleanup set to true
        await this.uploadChunksToServer(tenantName, true);

    } catch (error) {
        console.error('Error handling stale recordings:', error);
    }
}


}

export default LiveAudioManager;