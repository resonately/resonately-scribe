import * as SQLite from 'expo-sqlite/next';
import { Chunk, Recording } from './types';


class DatabaseService {
  private static instance: DatabaseService;
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {
    
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Initialize tables
  public initDb = async (): Promise<void> => {
    try {
      this.db = await SQLite.openDatabaseAsync('mySQLite.db');
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
  
      await this.db.execAsync(createRecordingsTable);
      await this.db.execAsync(createChunksTable);
    } catch (err) {
      console.error("Error initializing database:", err);
    }
   
  };

  // CRUD operations for Recording
  public insertRecording = async (recording: Recording): Promise<void> => {
    const insertRecordingQuery = `
      INSERT INTO recordings (id, startDate, appointmentId, endDate, status, chunkCounter)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {

      await this.db?.runAsync(insertRecordingQuery, [
        recording?.id!,
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
      
    } catch (err) {
      console.error("Error inserting recording:", err);
    }
    
  };

  public getRecordings = async (): Promise<Recording[]> => {
    const selectRecordingsQuery = 'SELECT * FROM recordings';
    const recordings = await this.db?.getAllAsync<Recording>(selectRecordingsQuery);
    if(recordings) {
      for (const recording of recordings) {
        if(recording.id) {
          recording.chunks = await this.getChunksByRecordingId(recording.id);
        }
      }
      return recordings;
    } else return [];
  };

  public getRecordingById = async (id: string): Promise<Recording> => {
    const selectRecordingQuery = 'SELECT * FROM recordings WHERE id = ?';
    const recordings = await this.db?.getAllAsync<Recording>(selectRecordingQuery, [id]);
    if (recordings && recordings.length > 0) {
      const recording = recordings[0];
      if(recording.id) {
        recording.chunks = await this.getChunksByRecordingId(recording.id);
        return recording;
      } else {
        return {} as Recording;
      }
    } else {
      throw new Error(`Recording with id ${id} not found`);
    }
  };

  public updateRecording = async (recording: Recording): Promise<void> => {
    const updateRecordingQuery = `
      UPDATE recordings SET startDate = ?, appointmentId = ?, endDate = ?, status = ?, chunkCounter = ?
      WHERE id = ?
    `;
    await this.db?.runAsync(updateRecordingQuery, [
      recording.startDate,
      recording.appointmentId,
      recording.endDate,
      recording.status,
      recording.chunkCounter,
      recording.id!,
    ]);

    await this.deleteChunksByRecordingId(recording.id);
        for (const chunk of recording.chunks) {
            if(recording.id) {
                await this.insertChunk(recording.id, chunk);
            }
        }
  };

  public deleteRecording = async (id: string): Promise<void> => {
    try {
      const deleteRecordingQuery = 'DELETE FROM recordings WHERE id = ?';
      await this.db?.runAsync(deleteRecordingQuery, [id]);
      await this.deleteChunksByRecordingId(id);
    } catch (err) {
      console.error("Error deleting recording:", err);
    }
  };

  // CRUD operations for Chunk
  private insertChunk = async (recordingId: string, chunk: Chunk): Promise<void> => {
    const insertChunkQuery = `
      INSERT INTO chunks (recordingId, position, isLastChunk, uri, startTime, endTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.db?.runAsync(insertChunkQuery, [
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
    const chunks = await this.db?.getAllAsync<Chunk>(selectChunksQuery, [recordingId]);
    if(chunks){
      return chunks.map(chunk => ({
        position: chunk.position,
        isLastChunk: Number(chunk.isLastChunk) === 1,
        uri: chunk.uri,
        startTime: chunk.startTime,
        endTime: chunk.endTime,
        status: chunk.status,
      }));
    } else return [];
    
  };

  public updateChunk = async (chunk: Chunk, recordingId: string): Promise<void> => {
    const updateChunkQuery = `
      UPDATE chunks SET status = ?
      WHERE id = ?
    `;
    await this.db?.runAsync(updateChunkQuery, [
      chunk.status,
      recordingId,
    ]);
  };

  private deleteChunksByRecordingId = async (recordingId: string | undefined): Promise<void> => {
    const deleteChunksQuery = 'DELETE FROM chunks WHERE recordingId = ?';
    if(recordingId){
      await this.db?.runAsync(deleteChunksQuery, [recordingId]);

    }
  };
}

export default DatabaseService;
