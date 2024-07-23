import ChunkDAO from '../dao/ChunkDAO';
import { downloadFileFromS3, uploadFileToS3 } from '../utils/s3Utils';
import { removeSilenceAndConvert } from '../utils/ffmpegUtils';
import { transcribeAudio } from '../utils/openAIUtils';
import path from 'path';
import Chunk from '../models/Chunk';
import { ChunkCreationAttributes } from '../interfaces/ChunkInterfaces';

class ChunkService {
  public async trimChunk(logicalId: number): Promise<void> {
    try {
      const chunk = await ChunkDAO.getChunkByLogicalId(logicalId);
      if (!chunk) {
        throw new Error('Chunk not found');
      }

      // Get the file path from the chunk
      const filePath = chunk.file_path;

      // Extract bucket and key from file path
      const { bucket, key } = this.extractBucketAndKey(filePath);

      // Download the file from S3
      const fileBuffer = await downloadFileFromS3(bucket, key);

      // Process the file to remove silence
      const { buffer: processedBuffer, format: convertedFormat } = await removeSilenceAndConvert(fileBuffer);

      // Upload the processed file back to S3
      const processedKey = this.getProcessedFileKey(key, convertedFormat);
      await uploadFileToS3(bucket, processedKey, processedBuffer);

      // Construct the full S3 URL
      const fullS3Url = this.getFullS3Url(bucket, processedKey);
      // Update the chunk records in the database
      await this.updateChunkRecords(chunk, fullS3Url);

      console.log(`Processed file uploaded to ${processedKey}`);
    } catch (error) {
      console.error('Error in trimChunk:', error);
      throw error;
    }
  }

  public async transcribeChunk(logicalId: number): Promise<void> {
    try {
      const chunk = await ChunkDAO.getChunkByLogicalIdAndStatus(logicalId, 'trimmed');
      if (!chunk) {
        throw new Error('Trimmed chunk not found');
      }

      // Download the file from S3
      const { bucket, key } = this.extractBucketAndKey(chunk.file_path);
      const fileBuffer = await downloadFileFromS3(bucket, key);

      // Transcribe the audio
      const transcription = await transcribeAudio(fileBuffer);

      // Update the chunk records in the database
      await this.storeTranscribedChunk(chunk, transcription);

      console.log('Transcription stored successfully');
    } catch (error) {
      console.error('Error in transcribeChunk:', error);
      throw error;
    }
  }

  private extractBucketAndKey(s3Path: string): { bucket: string; key: string } {
    let bucket: string;
    let key: string;

    if (s3Path.startsWith('s3://')) {
      // Handle s3://bucket/key format
      const url = new URL(s3Path);
      bucket = url.hostname;
      key = url.pathname.slice(1);
    } else {
      // Handle https://bucket.s3.region.amazonaws.com/key format
      const url = new URL(s3Path);
      const hostnameParts = url.hostname.split('.');
      bucket = hostnameParts[0];
      key = url.pathname.slice(1);
    }

    return { bucket, key };
  }

  private getProcessedFileKey(originalKey: string, format: string): string {
    const { dir, name } = path.parse(originalKey);
    return path.join(dir, `${name}_processed.${format}`);
  }

  private getFullS3Url(bucket: string, key: string): string {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  private async updateChunkRecords(originalChunk: Chunk, processedFilePath: string): Promise<void> {
    const transaction = await ChunkDAO.startTransaction();
    try {
      // Set is_current of the previous chunk to false
      await ChunkDAO.updateChunkIsCurrent(originalChunk.id, false, transaction);

      // Create a new chunk with the same logical_id and status as trimmed
      const newChunkData: ChunkCreationAttributes = {
        recording_id: originalChunk.recording_id,
        start_time: originalChunk.start_time,
        end_time: originalChunk.end_time || undefined,
        file_path: processedFilePath,
        status: 'trimmed',
        tenant_name: originalChunk.tenant_name,
        created_by: originalChunk.created_by,
        created_at: new Date(),
        text: originalChunk.text || undefined,
        position: originalChunk.position || undefined,
        chunk_type: originalChunk.chunk_type || undefined,
        logical_id: originalChunk.logical_id || undefined,
        is_current: true,
      };

      console.log('Creating new chunk with data:', newChunkData);

      await ChunkDAO.createChunk(newChunkData, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error updating chunk records:', error);
      throw error;
    }
  }

  private async storeTranscribedChunk(originalChunk: Chunk, transcription: string): Promise<void> {
    const transaction = await ChunkDAO.startTransaction();
    try {
      // Set is_current of the previous chunk to false
      await ChunkDAO.updateChunkIsCurrent(originalChunk.id, false, transaction);

      // Create a new chunk with the same logical_id and status as transcribed
      const newChunkData: ChunkCreationAttributes = {
        recording_id: originalChunk.recording_id,
        start_time: originalChunk.start_time,
        end_time: originalChunk.end_time,
        file_path: originalChunk.file_path,
        status: 'transcribed',
        tenant_name: originalChunk.tenant_name,
        created_by: originalChunk.created_by,
        created_at: new Date(),
        text: transcription,
        position: originalChunk.position,
        chunk_type: originalChunk.chunk_type,
        logical_id: originalChunk.logical_id,
        is_current: true,
      };

      console.log('Storing transcribed chunk with data:', newChunkData);

      await ChunkDAO.createChunk(newChunkData, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('Error storing transcribed chunk:', error);
      throw error;
    }
  }
}

export default new ChunkService();
