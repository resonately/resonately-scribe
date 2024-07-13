import { Audio } from "expo-av";

export interface Chunk {
    position: number;
    isLastChunk: boolean;
    uri: string;
    startTime: string;
    endTime: string;
    status: string;
    retryCount: number;
}

export interface Recording {
    id: string;
    startDate: string;
    appointmentId: string;
    endDate: string | null;
    status: string;
    sound: Audio.Sound | null;
    chunks: Chunk[];
    chunkCounter: number;
}