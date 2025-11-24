import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private s3Client: S3Client;
  private videoBucketName: string;
  private documentBucketName: string;
  private accountId: string;

  constructor(private configService: ConfigService) {
    this.accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    this.videoBucketName = this.configService.get<string>('R2_BUCKET_NAME');
    this.documentBucketName = this.configService.get<string>('R2_DOCUMENT_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('R2_SECRET_ACCESS_KEY'),
      },
    });

    this.logger.log('R2 Storage Service initialized');
    this.logger.log(`Video bucket: ${this.videoBucketName}`);
    this.logger.log(`Document bucket: ${this.documentBucketName}`);
  }

  /**
   * Upload video chunk to R2
   */
  async uploadChunk(
    livestreamId: string,
    chunkIndex: number,
    data: Buffer,
  ): Promise<string> {
    const key = `livestreams/${livestreamId}/chunks/chunk-${chunkIndex}.webm`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.videoBucketName,
        Key: key,
        Body: data,
        ContentType: 'video/webm',
      });

      await this.s3Client.send(command);
      this.logger.log(`Uploaded chunk ${chunkIndex} for livestream ${livestreamId}`);
      return key;
    } catch (error) {
      this.logger.error(`Failed to upload chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  /**
   * Upload complete video file to R2
   */
  async uploadVideo(
    livestreamId: string,
    videoStream: Readable,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const key = `livestreams/${livestreamId}/recording.webm`;

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.videoBucketName,
          Key: key,
          Body: videoStream,
          ContentType: 'video/webm',
          Metadata: metadata,
        },
      });

      await upload.done();
      this.logger.log(`Uploaded complete video for livestream ${livestreamId}`);
      
      // Return public URL
      return `https://pub-${this.accountId}.r2.dev/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload video for ${livestreamId}:`, error);
      throw error;
    }
  }

  /**
   * Get public URL for a video
   */
  getPublicUrl(key: string): string {
    return `https://pub-${this.accountId}.r2.dev/${key}`;
  }

  /**
   * Delete video and its chunks
   */
  deleteVideo(livestreamId: string): void {
    // Implementation for deleting objects
    // You can add batch delete logic here if needed
    this.logger.log(`Delete requested for livestream ${livestreamId}`);
  }

  /**
   * Upload document file to R2 documents bucket
   */
  async uploadDocument(
    teacherId: string,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const key = `documents/${teacherId}/${Date.now()}-${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.documentBucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.log(`Uploaded document ${fileName} for teacher ${teacherId}`);
      
      // Return public URL
      return `https://pub-${this.accountId}.r2.dev/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload document ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Delete document from R2
   */
  deleteDocument(key: string): void {
    // Implementation for deleting document
    this.logger.log(`Delete requested for document ${key}`);
  }
}
