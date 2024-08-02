import LiveAudioStream, { Options } from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';

class LiveAudioManager {
  private static instance: LiveAudioManager;
  private isStreaming: boolean = false;
  private currentChunk: Buffer = Buffer.alloc(0);
  private chunkStartTime: number = 0;
  private readonly CHUNK_DURATION: number = 30000; // 30 seconds in milliseconds

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

  private handleCompleteChunk(): void {
    console.log(`Completed 30-second chunk: ${this.currentChunk.length} bytes`);
    // Here you can process or send the completed chunk
    // For example, you might want to send it to a server or process it locally

    // Reset for the next chunk
    this.currentChunk = Buffer.alloc(0);
  }

  public startStreaming(): void {
    if (!this.isStreaming) {
      LiveAudioStream.start();
      this.isStreaming = true;
      this.currentChunk = Buffer.alloc(0);
      this.chunkStartTime = Date.now();
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