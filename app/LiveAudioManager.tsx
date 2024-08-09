import LiveAudioStream, { Options } from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import { Dispatch, SetStateAction } from 'react';
import { Chunk, CHUNK_STATUS, Recording, RECORDING_STATUS } from './types';
import DatabaseService from './DatabaseService';
import { uploadChunkToServer } from './RecordUtils';

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
        console.log(">>> Inside Interval, calling handle complete chunk.....");
        await this.handleCompleteChunk();
      }
    }, 20000);

    this.startDataCheckTimer();

  }

  // checking for interruption
  private startDataCheckTimer(): void {
    this.dataCheckTimer = setInterval(async () => {
      console.log(">>> Inside interruption check interval", this.isPaused, this.isStreaming);
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

  private async updateLocalDB(chunk: Chunk, currentChunkPosition: number, isLastChunk: boolean) {
    if(this.currentRecordingObj) {
      await DatabaseService.getInstance().updateRecordingChunkCounter(this.currentRecordingObj, currentChunkPosition);
      await DatabaseService.getInstance().insertChunk(this.currentRecordingObj.id!, chunk);

      if(isLastChunk) {
        await DatabaseService.getInstance().updateRecordingendDate(this.currentRecordingObj, new Date().toISOString());
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

      const fileDetails = await FileSystem.getInfoAsync(chunkFilePath);
      if(fileDetails.exists){
        if(fileDetails.size > 0) {

          // Reset for the next chunk
          this.currentChunk = Buffer.alloc(0);
          const newChunkObj = this.createChunk({ chunkCounter: this.chunkCounter, isLastChunk , startTime: this.chunkStartTime, uri: chunkFilePath });
          this.updateCurrentRecording(newChunkObj, this.chunkCounter, isLastChunk);
          // create a new chunk and increment chunk counter and update this.currentRecordingObj
          await this.updateLocalDB(newChunkObj, this.chunkCounter, isLastChunk);
          this.chunkCounter++;

        }
      }

    } catch (error) {
      console.error('Error saving audio chunk to local file:', error);
    }
  }


  public startStreaming(appointmentId: string): void {
    try{
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

      if (this.isStreaming && !this.isPaused) {
        LiveAudioStream.stop();
        this.stopDataCheckTimer();
        clearInterval(this.handleCompleteChunkInterval as NodeJS.Timeout);
      
        if(isComingFromPause) {
          // just pausing the recording, clear intervals and save the chunk
          await this.handleCompleteChunk();
          console.log(">>> Printing the recording object 1: ", this.currentRecordingObj);
          return false;
        } else {
          // actually stop the recording, create the chunk, insert chunk in localDB, updateChunkCounter
          await this.handleCompleteChunk({ isLastChunk: true }); 
          this.appointmentId = undefined;
          console.log(">>> Printing the final recording object: ", this.currentRecordingObj);
          this.currentRecordingObj = null;
          this.isStreaming = false;
          this.isPaused = false;
          this.tenantName = '';
          console.log('>>>Audio streaming stopped, uploading chunks now');
          return true;
          // await this.listAllFiles();
          // await this.deleteAllFiles();
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

  public async uploadChunksToServer(tenantName: string) {

	try {
		// get all the recordings from sqlite DB
		const allRecordingsInLocalDB = await DatabaseService.getInstance().getRecordings();

		console.log(">>> all recordings in local db: ", allRecordingsInLocalDB);
    if(!allRecordingsInLocalDB || allRecordingsInLocalDB.length === 0 || this.isStreaming) {
      return;
    }
	
		// loop through all recording and call RecordUtils.uploadRecording(chunk, recordingId, tenantName) for each recording
		for (const recording of allRecordingsInLocalDB) {
			console.log(">>> recording object before chunks are uploaded: ", recording);
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
			console.log(">>> recording object after chunks are uploaded: ", recording);
			let isAllChunksUploaded = recording.chunks.every((chunk) => chunk.status === CHUNK_STATUS.Uploaded);
			console.log(">>> isAllChunksUploaded: ", isAllChunksUploaded);
			if(isAllChunksUploaded) {
				// delete the recording 
				await DatabaseService.getInstance().deleteRecording(recording.id!); // delete recording from sqlite
				this.deleteAllChunksOfARecording(recording.appointmentId); // delete files from local filesystem
			}
		}
		
	} catch (error) {
		console.error('Error uploading chunks to server:', error);
	}
  }

}

export default LiveAudioManager;