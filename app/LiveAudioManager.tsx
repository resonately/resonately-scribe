import LiveAudioStream, { Options } from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { Dispatch, SetStateAction } from 'react';

const DATA_CHECK_INTERVAL: number = 5000; // 5 seconds
const MAX_DATA_WAIT_TIME: number = 5000; // 10 seconds
const CHUNK_DURATION: number = 30000; // 30 seconds in milliseconds


class LiveAudioManager {
  private static instance: LiveAudioManager;
  private isStreaming: boolean = false;
  private isPaused: boolean = false;
  private currentChunk: Buffer = Buffer.alloc(0);
  private chunkStartTime: number = 0;
  private chunkCounter: number = 0;
  private lastDataReceivedTime: number = 0;
  private dataCheckTimer: NodeJS.Timeout | null = null;
  private pauseCallback: Dispatch<SetStateAction<boolean>> | null = null;
  private handleCompleteChunkInterval: NodeJS.Timeout | null = null;
  private appointmentId: string = '';

  private constructor() {
    this.initializeAudioStream();
  }

  public static getInstance(): LiveAudioManager {
    if (!LiveAudioManager.instance) {
      LiveAudioManager.instance = new LiveAudioManager();
    }
    return LiveAudioManager.instance;
  }

  public setPauseCallback(callback: Dispatch<SetStateAction<boolean>>) {
    this.pauseCallback = callback;
}

  private initializeAudioStream(): void {
    const options: Options = {
      sampleRate: 32000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 4096,
      wavFile: ''
    };

    LiveAudioStream.init(options);

    LiveAudioStream.on('data', (data: string) => {
      if (this.isStreaming && !this.isPaused) {
        console.log("Recoding is ongoing...");
        const chunk = Buffer.from(data, 'base64');
        this.processAudioChunk(chunk);
        this.lastDataReceivedTime = Date.now();
      }
    });

    this.handleCompleteChunkInterval = setInterval(() => {
      if (this.isStreaming && this.currentChunk.length > 0) {
        console.log("***** calling handle complete chunk.....");
        this.handleCompleteChunk();
      }
    }, 20000);

    this.startDataCheckTimer();

  }

  // checking for interruption
  private startDataCheckTimer(): void {
    this.dataCheckTimer = setInterval(() => {
      console.log("Inside data check interval", this.isPaused, this.isStreaming);
      if (this.isStreaming && !this.isPaused) {
        const currentTime = Date.now();
        if (currentTime - this.lastDataReceivedTime > MAX_DATA_WAIT_TIME) {
          console.log('No data received for a while, pausing the recording');
          this.pauseStreaming(true);
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
      this.chunkStartTime = Date.now();
    }

    this.currentChunk = Buffer.concat([this.currentChunk, chunk]);
  }

  private async handleCompleteChunk(): Promise<void> {
    const chunkFileName = `audio_chunk_${this.chunkCounter}.raw`;
    const chunkFilePath = `${FileSystem.cacheDirectory}${chunkFileName}`;

    try {
      await FileSystem.writeAsStringAsync(chunkFilePath, this.currentChunk.toString('base64'), { encoding: FileSystem.EncodingType.Base64 });
      console.log(`Completed 30-second chunk: ${this.currentChunk.length} bytes`);
      console.log(`Saved to: ${chunkFilePath}`);

      // Process the saved chunk file
      await this.processChunkFile(chunkFilePath);

      // Reset for the next chunk
      this.currentChunk = Buffer.alloc(0);
      this.chunkCounter++;
      this.chunkStartTime = Date.now(); 
    } catch (error) {
      console.error('Error saving audio chunk:', error);
    }
  }

  private async processChunkFile(filePath: string): Promise<void> {
    console.log(`Processing chunk file: ${filePath}`);
    try {
      const contents = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
      console.log(contents);
      
      // Here you can add more processing logic
      // For example, you might want to send this file to a server
      // await this.sendChunkToServer(filePath);
    } catch (error) {
      console.error('Error processing chunk file:', error);
    }
  }

  // Example method to send chunk to a server (not implemented)
  // private async sendChunkToServer(filePath: string): Promise<void> {
  //   // Implementation depends on your server setup and requirements
  // }

  public startStreaming(appointmentId: string): void {
    if (!this.isStreaming) {
      LiveAudioStream.start();
      this.isStreaming = true;
      this.isPaused = false;
      this.currentChunk = Buffer.alloc(0);
      this.chunkStartTime = Date.now();
      this.chunkCounter = 0;
      this.lastDataReceivedTime = Date.now();
      if(appointmentId) {
        console.log('Fresh Audio streaming started', appointmentId);
        this.appointmentId = appointmentId;
      } else {
        console.log('Audio recording resumed');
      }
    } else {
      console.log('Audio streaming is already active');
    }
  }

  public stopStreaming(): void {
    if (this.isStreaming) {
      LiveAudioStream.stop();
      this.isStreaming = false;
      this.isPaused = false;
      this.stopDataCheckTimer();
      clearInterval(this.handleCompleteChunkInterval as NodeJS.Timeout);
      if (this.currentChunk.length > 0) {
        this.handleCompleteChunk(); // Handle any remaining audio data
      }
      this.appointmentId = '';
      console.log('Audio streaming stopped');
    } else {
      console.log('Audio streaming is not active');
    }
  }

  public pauseStreaming(internal: boolean = false): void {
    console.log(">>>> Inside pause streaming");
    if (this.isStreaming && !this.isPaused) {
      this.isPaused = true;
      console.log(">>>> Inside pause streaming 2", this.pauseCallback);
      if(internal && this.pauseCallback) {
        this.pauseCallback(true);
        clearInterval(this.handleCompleteChunkInterval as NodeJS.Timeout);
        
      }
      this.stopStreaming();
      console.log('Audio streaming paused');
    } else if (!this.isStreaming) {
      console.log('Cannot pause, audio streaming is not active');
    } else if (this.isPaused) {
      console.log('Audio streaming is already paused');
    }
  }

  public resumeStreaming(): void {
    if (this.isStreaming && this.isPaused) {
      this.isPaused = false;
      this.chunkStartTime = Date.now(); // Reset the chunk start time
      this.lastDataReceivedTime = Date.now();
      this.startStreaming('');
      console.log('Audio streaming resumed');
    } else if (!this.isStreaming) {
      console.log('Cannot resume, audio streaming is not active');
    } else if (!this.isPaused) {
      console.log('Audio streaming is not paused');
    }
  }
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