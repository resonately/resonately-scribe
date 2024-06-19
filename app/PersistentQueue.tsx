import * as FileSystem from 'expo-file-system';

type QueueItem = any; // You can replace 'any' with a more specific type if needed

class PersistentQueue {
  private directory: string;
  private fileName: string;
  private filePath: string;
  private queue: QueueItem[];

  constructor(directory: string, fileName: string) {
    this.directory = `${FileSystem.documentDirectory}${directory}/`;
    this.fileName = fileName;
    this.filePath = `${this.directory}${fileName}`;
    this.queue = [];
  }

  public async initialize() {
    // Ensure the parent directory exists
    const dirInfo = await FileSystem.getInfoAsync(this.directory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.directory, { intermediates: true });
    }

    // Ensure the file exists
    const fileInfo = await FileSystem.getInfoAsync(this.filePath);
    if (!fileInfo.exists) {
      await FileSystem.writeAsStringAsync(this.filePath, JSON.stringify(this.queue));
    } else {
      // Load existing queue from file
      await this.loadQueue();
    }
  }

  private async loadQueue() {
    const fileInfo = await FileSystem.getInfoAsync(this.filePath);
    if (fileInfo.exists) {
      const fileContent = await FileSystem.readAsStringAsync(this.filePath);
      this.queue = JSON.parse(fileContent);
      // console.log('Loaded queue:', this.queue); // Debug log
    }
  }

  public async enqueue(item: QueueItem) {
    await this.loadQueue();
    this.queue.push(item);
    await this.saveQueue();
    await this.verifyQueue();
  }

  public async dequeue(): Promise<QueueItem | null> {
    await this.loadQueue();
    if (this.queue.length === 0) {
      return null;
    }
    const item = this.queue.shift();
    await this.saveQueue();
    await this.verifyQueue();
    return item;
  }

  public async peek(): Promise<QueueItem | null> {
    await this.loadQueue();
    if (this.queue.length === 0) {
      return null;
    }
    return this.queue[0];
  }

  public async size(): Promise<number> {
    await this.loadQueue();
    return this.queue.length;
  }

  public async clear() {
    await this.loadQueue();
    this.queue = [];
    await this.saveQueue();
    await this.verifyQueue();
  }

  private async saveQueue() {
    await FileSystem.writeAsStringAsync(this.filePath, JSON.stringify(this.queue));
  }

  private async verifyQueue() {
    const fileContent = await FileSystem.readAsStringAsync(this.filePath);
    console.log('Queue file contents:', fileContent);
  }
}

export default PersistentQueue;
