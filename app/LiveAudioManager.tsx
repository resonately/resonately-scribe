import LiveAudioStream, { Options } from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';

class LiveAudioManager {
  private static instance: LiveAudioManager;
  private isStreaming: boolean = false;
  private currentChunk: Buffer = Buffer.alloc(0);
  private chunkStartTime: number = 0;
  private readonly CHUNK_DURATION: number = 30000; // 30 seconds in milliseconds
  private chunkCounter: number = 0;

  private constructor() {
    this.initializeAudioStream();
  }

  public static getInstance(): LiveAudioManager {
    if (!LiveAudioManager.instance) {
      LiveAudioManager.instance = new LiveAudioManager();
    }
    return LiveAudioManager.instance;
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
      const chunk = Buffer.from(data, 'base64');
      this.processAudioChunk(chunk);
    });
  }

  private processAudioChunk(chunk: Buffer): void {
    if (this.currentChunk.length === 0) {
      this.chunkStartTime = Date.now();
    }

    this.currentChunk = Buffer.concat([this.currentChunk, chunk]);

    if (Date.now() - this.chunkStartTime >= this.CHUNK_DURATION) {
      this.handleCompleteChunk();
    }
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
    } catch (error) {
      console.error('Error saving audio chunk:', error);
    }
  }

  private async processChunkFile(filePath: string): Promise<void> {
    console.log(`Processing chunk file: ${filePath}`);
    try {
      const contents = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.Base64 });
      
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

  public startStreaming(): void {
    if (!this.isStreaming) {
      LiveAudioStream.start();
      this.isStreaming = true;
      this.currentChunk = Buffer.alloc(0);
      this.chunkStartTime = Date.now();
      this.chunkCounter = 0;
      console.log('Audio streaming started');
    } else {
      console.log('Audio streaming is already active');
    }
  }

  public stopStreaming(): void {
    if (this.isStreaming) {
      LiveAudioStream.stop();
      this.isStreaming = false;
      if (this.currentChunk.length > 0) {
        this.handleCompleteChunk(); // Handle any remaining audio data
      }
      console.log('Audio streaming stopped');
    } else {
      console.log('Audio streaming is not active');
    }
  }

  public isStreamingActive(): boolean {
    return this.isStreaming;
  }
}

export default LiveAudioManager;