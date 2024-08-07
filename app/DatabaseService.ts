import * as SQLite from 'expo-sqlite/next';
import { Chunk, Recording } from './types';


class DatabaseService {
  private static instance: DatabaseService;
  private db: any;

  private constructor() {
    
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private executeSql = (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        //@ts-ignore
      this.db?.transaction((tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_, { rows: { _array } }) => resolve(_array), 
          (_, error) => reject(error)
        );
      });
    });
  };

  // Initialize tables
  public initDb = async (): Promise<void> => {
    this.db = await SQLite.openDatabaseAsync('resonately');
    const createRecordingsTable = `
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY NOT NULL,
        startDate TEXT,
        appointmentId TEXT,
        endDate TEXT,
        status TEXT,
        chunkCounter INTEGER
      );
    `;

    const createChunksTable = `
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recordingId TEXT,
        position INTEGER,
        isLastChunk INTEGER,
        uri TEXT,
        startTime TEXT,
        endTime TEXT,
        status TEXT,
        FOREIGN KEY (recordingId) REFERENCES recordings(id)
      );
    `;

    await this.executeSql(createRecordingsTable);
    await this.executeSql(createChunksTable);
  };

  // CRUD operations for Recording
  public insertRecording = async (recording: Recording): Promise<void> => {
    const insertRecordingQuery = `
      INSERT INTO recordings (id, startDate, appointmentId, endDate, status, chunkCounter)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.executeSql(insertRecordingQuery, [
      recording.id,
      recording.startDate,
      recording.appointmentId,
      recording.endDate,
      recording.status,
      recording.chunkCounter,
    ]);

    for (const chunk of recording.chunks) {
        if(recording?.id){
            await this.insertChunk(recording?.id, chunk);
        }
    }
  };

  public getRecordings = async (): Promise<Recording[]> => {
    const selectRecordingsQuery = 'SELECT * FROM recordings';
    const recordings = await this.executeSql(selectRecordingsQuery);
    for (const recording of recordings) {
      recording.chunks = await this.getChunksByRecordingId(recording.id);
    }
    return recordings;
  };

  public getRecordingById = async (id: string): Promise<Recording> => {
    const selectRecordingQuery = 'SELECT * FROM recordings WHERE id = ?';
    const recordings = await this.executeSql(selectRecordingQuery, [id]);
    if (recordings.length > 0) {
      const recording = recordings[0];
      recording.chunks = await this.getChunksByRecordingId(recording.id);
      return recording;
    } else {
      throw new Error(`Recording with id ${id} not found`);
    }
  };

  public updateRecording = async (recording: Recording): Promise<void> => {
    const updateRecordingQuery = `
      UPDATE recordings SET startDate = ?, appointmentId = ?, endDate = ?, status = ?, chunkCounter = ?
      WHERE id = ?
    `;
    await this.executeSql(updateRecordingQuery, [
      recording.startDate,
      recording.appointmentId,
      recording.endDate,
      recording.status,
      recording.chunkCounter,
      recording.id,
    ]);

    await this.deleteChunksByRecordingId(recording.id);
        for (const chunk of recording.chunks) {
            if(recording.id) {
                await this.insertChunk(recording.id, chunk);
            }
        }
  };

  public deleteRecording = async (id: string): Promise<void> => {
    const deleteRecordingQuery = 'DELETE FROM recordings WHERE id = ?';
    await this.executeSql(deleteRecordingQuery, [id]);
    await this.deleteChunksByRecordingId(id);
  };

  // CRUD operations for Chunk
  private insertChunk = async (recordingId: string, chunk: Chunk): Promise<void> => {
    const insertChunkQuery = `
      INSERT INTO chunks (recordingId, position, isLastChunk, uri, startTime, endTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.executeSql(insertChunkQuery, [
      recordingId,
      chunk.position,
      chunk.isLastChunk ? 1 : 0,
      chunk.uri,
      chunk.startTime,
      chunk.endTime,
      chunk.status,
    ]);
  };

  private getChunksByRecordingId = async (recordingId: string): Promise<Chunk[]> => {
    const selectChunksQuery = 'SELECT * FROM chunks WHERE recordingId = ?';
    const chunks = await this.executeSql(selectChunksQuery, [recordingId]);
    return chunks.map(chunk => ({
      position: chunk.position,
      isLastChunk: chunk.isLastChunk === 1,
      uri: chunk.uri,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      status: chunk.status,
    }));
  };

  private deleteChunksByRecordingId = async (recordingId: string | undefined): Promise<void> => {
    const deleteChunksQuery = 'DELETE FROM chunks WHERE recordingId = ?';
    await this.executeSql(deleteChunksQuery, [recordingId]);
  };
}

export default DatabaseService;
