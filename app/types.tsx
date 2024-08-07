import { Audio } from "expo-av";

export enum CHUNK_STATUS {
    Created = 'created',
    Uploaded = 'uploaded'
}
export enum RECORDING_STATUS {
    In_Progress = 'In progress',
    Completed = 'Completed'
} 
export interface Chunk {
    position: number;
    isLastChunk: boolean;
    uri: string;
    startTime: string;
    endTime: string;
    status: CHUNK_STATUS;
    retryCount?: number;
}

export interface Recording {
    id: string | undefined;
    startDate: string;
    appointmentId: string;
    endDate: string | null;
    status: RECORDING_STATUS;
    sound?: Audio.Sound | null;
    chunks: Chunk[];
    chunkCounter: number;
}