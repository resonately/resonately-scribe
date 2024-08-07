import LiveAudioStream, { Options } from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import { Dispatch, SetStateAction } from 'react';
import { Chunk, CHUNK_STATUS, Recording, RECORDING_STATUS } from './types';

const DATA_CHECK_INTERVAL: number = 5000; // 5 seconds
const MAX_DATA_WAIT_TIME: number = 5000; // 10 seconds
const CHUNK_DURATION: number = 30000; // 30 seconds in milliseconds

class LiveAudioManager {
  private static instance: LiveAudioManager;
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  private currentChunk: Buffer = Buffer.alloc(0);
  private chunkStartTime: string = '';
  private chunkCounter: number = 0;
  private lastDataReceivedTime: number = 0;
  private dataCheckTimer: NodeJS.Timeout | null = null;
  private pauseCallback: Dispatch<SetStateAction<boolean>> | null = null;
  private handleCompleteChunkInterval: NodeJS.Timeout | null = null;
  private appointmentId: string | undefined = undefined;
  private currentRecordingObj: Recording | null = null;

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

  private initializeAudioStream(appointmentId?: string): void {

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
        console.log(">>> calling handle complete chunk..... last recording object", this.currentRecordingObj);
        await this.handleCompleteChunk();
      }
    }, 20000);

    this.startDataCheckTimer();

  }

  // checking for interruption
  private startDataCheckTimer(): void {
    this.dataCheckTimer = setInterval(async () => {
      console.log("Inside data check interval", this.isPaused, this.isStreaming);
      if (this.isStreaming && !this.isPaused) {
        const currentTime = Date.now();
        if (currentTime - this.lastDataReceivedTime > MAX_DATA_WAIT_TIME) {
          console.log('No data received for a while, pausing the recording');
          await this.pauseStreaming(true);
        }
      }
    }, DATA_CHECK_INTERVAL);
  }

  private stopDataCheckTimer(): void {
    if (this.dataCheckTimer) {
      clearInterval(this.dataCheckTimer);
      this.dataCheckTimer = null;
    }
  }

  private processAudioChunk(chunk: Buffer): void {
    if (this.currentChunk.length === 0) {
      console.log(">>>> Updating this.chunkStartTime ");
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

  private async handleCompleteChunk({isLastChunk}: { isLastChunk: boolean } = {isLastChunk: false}): Promise<void> {
    console.log(">>> Inside handlecomplete chunk appointmentId is:", this.appointmentId, isLastChunk);
    const chunkFileName = `audio_chunk_${this.chunkCounter}.raw`;
    const chunkFilePath = `${FileSystem.documentDirectory}recordings/${this.appointmentId}/${chunkFileName}`;

    try {
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}recordings/${this.appointmentId}`, { intermediates: true });
      await FileSystem.writeAsStringAsync(chunkFilePath, this.currentChunk.toString('base64'), { encoding: FileSystem.EncodingType.Base64 });

      // Reset for the next chunk
      this.currentChunk = Buffer.alloc(0);
      const newChunkObj = this.createChunk({ chunkCounter: this.chunkCounter, isLastChunk , startTime: this.chunkStartTime, uri: chunkFilePath });
      console.log(">>>> newChunkObject: ", newChunkObj);
      this.updateCurrentRecording(newChunkObj, this.chunkCounter, isLastChunk);
      this.chunkCounter++;

      // create a new chunk and increment chunk counter and update this.currentRecordingObj

    } catch (error) {
      console.error('Error saving audio chunk to local file:', error);
    }
  }


  public startStreaming(appointmentId: string): void {
    // if (!this.isStreaming) {
    try{
      this.initializeAudioStream(appointmentId);
      LiveAudioStream.start();
      this.isStreaming = true;
      this.isPaused = false;
      this.currentChunk = Buffer.alloc(0);
      this.chunkStartTime = new Date().toISOString();
      this.chunkCounter = 0;
      this.lastDataReceivedTime = Date.now();
      this.appointmentId = appointmentId;
      // if(appointmentId) {
      //   console.log('>>> Fresh Audio streaming started', appointmentId);
      //   this.appointmentId = appointmentId;
      // } else {
      //   console.log('>>>Audio recording resumed');
      // }
    } catch (err) {
      console.error("Error in start streaming: ", err);
    }
      
    // } else {
      // console.log('>>>Audio streaming is already active');
    // }
  }

  public async stopStreaming(isComingFromPause: boolean = false) {
    if (this.isStreaming && !this.isPaused) {
      LiveAudioStream.stop();
      this.stopDataCheckTimer();
      clearInterval(this.handleCompleteChunkInterval as NodeJS.Timeout);

      if(isComingFromPause) {
        // just pausing the recording, clear intervals and save the chunk
        await this.handleCompleteChunk();
        console.log(">>> Printing the recording object 1: ", this.currentRecordingObj);
      } else {
        // actually stop the recording as well
        await this.handleCompleteChunk({ isLastChunk: true }); // Handle any remaining audio data
        this.appointmentId = undefined;
        console.log(">>> Printing the final recording object: ", this.currentRecordingObj);
        this.currentRecordingObj = null;
        this.isStreaming = false;
        this.isPaused = false;
        await this.listAllFiles();
        await this.deleteAllFiles();
        console.log('>>>Audio streaming stopped');
      }
    } else {
      console.log('>>>Audio streaming is not active');
    }
  }

  public async pauseStreaming(internal: boolean = false) {
    console.log(">>>> Inside pause streaming");
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
    if (this.isStreaming && this.isPaused) {
      this.chunkStartTime = new Date().toISOString(); // Reset the chunk start time
      this.lastDataReceivedTime = Date.now();
      this.startStreaming(this.appointmentId ?? '');
      console.log('>>>Audio streaming resumed');
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
        files.forEach((file) => {
          console.log(">>>>", file);
        });
      }
    } catch (error) {
      console.error('Error reading files:', error);
    }
  };

  private async deleteAllFiles() {
    try {
      const directoryPath = `${FileSystem.documentDirectory}recordings/`;
      const appointmentDirectories = await FileSystem.readDirectoryAsync(directoryPath);
  
      for (const appointmentId of appointmentDirectories) {
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
      }
  
      console.log('All files and directories deleted.');
    } catch (error) {
      console.error('Error deleting files:', error);
    }
  };

}

export default LiveAudioManager;




/**
 * 1. we have the recording chunk created in local system, all chunks of a particular recording will be saved in that rec directory
 * 
 * 2. We have to store this file path against that recordingId/AppointmentId in the sqlite db
 * 
 * 3. The data would look something like this
 *  
 * {
 *  "recordingId": "894c63d1-aafe-4081-8f4f-db502acfdd7e",
 *  "appointmentId": 23390,
 *  "recordingStartDate": "2024-08-03T14:11:53.520Z",
 *  "recordingEndDate": "2024-08-03T14:11:59.249Z", // same as last chunk end time
 *  "status": "In Progress", // it can be one of "Completed", "In Progress"
 *  "chunks": [
 *   {
       "position": 0, // position of the chunk, ends with total chunks-1
       "isLastChunk": true,
       "uri": "file:///var/mobile/Containers/Data/Application/5062D4E2-6AC9-48BC-BC72-81BA166BC7CA/Documents/recordings/rec_894c63d1-aafe-4081-8f4f-db502acfdd7e/894c63d1-aafe-4081-8f4f-db502acfdd7e_1722694319275.m4a",
       "startTime": "2024-08-03T14:11:53.520Z",
       "endTime": "2024-08-03T14:11:59.277Z",
       "status": "created", // can be one of "uploaded" or "created"
     }
    ],
    "chunkCounter": 1, // chunk.length
}
 * 
 * 4. Once this is in SQLITE DB, we would find appropriate places to upload these chunks to the server
 * 
 * 5. Make sure every recording has a endTime and isLastChunk property present in the chunk data
 * 
 * 6. Once for a recording, all the chunks are uploaded to the server, we would delete the recording
 *
 * */