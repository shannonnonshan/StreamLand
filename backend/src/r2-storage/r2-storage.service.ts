import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private videoS3Client: S3Client;
  private documentS3Client: S3Client;
  private videoBucketName: string;
  private documentBucketName: string;

  private publicUrl: string;
  private documentPublicUrl: string;

  constructor(private configService: ConfigService) {
    this.videoBucketName = this.configService.get<string>('R2_BUCKET_NAME')!;
    this.documentBucketName = this.configService.get<string>('R2_DOCUMENT_BUCKET_NAME')!;
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL')!;
    this.documentPublicUrl = this.configService.get<string>('R2_DOCUMENT_PUBLIC_URL')!;
    
    const videoAccountId = 'b14364ed47172b12203d851d355a7a71';
    const documentAccountId = '4193b6b3b69cd503069712d14e7ab703';

    // S3 Client for video bucket
    // Using account-level endpoint with path-style access
    this.videoS3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${videoAccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get<string>('R2_VIDEO_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('R2_VIDEO_SECRET_ACCESS_KEY')!,
      },
      forcePathStyle: true,
    });

    // S3 Client for document bucket
    this.documentS3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${documentAccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get<string>('R2_DOCUMENT_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('R2_DOCUMENT_SECRET_ACCESS_KEY')!,
      },
      forcePathStyle: true,
    });

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
        client: this.videoS3Client,
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
      
      // Return public URL (R2.dev subdomain)
      return `${this.publicUrl}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload video for ${livestreamId}:`, error);
      throw error;
    }
  }

  /**
   * Get public URL for a video
   */
  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Delete video and its chunks from R2
   */
  async deleteVideo(livestreamId: string): Promise<void> {
    try {
      // List all objects with the prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.videoBucketName,
        Prefix: `livestreams/${livestreamId}/`,
      });

      const listResponse = await this.videoS3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        this.logger.log(`No chunks found for livestream ${livestreamId}`);
        return;
      }

      // Delete all objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.videoBucketName,
        Delete: {
          Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
          Quiet: true,
        },
      });

      await this.videoS3Client.send(deleteCommand);
      this.logger.log(`Deleted ${listResponse.Contents.length} chunks for livestream ${livestreamId}`);
    } catch (error) {
      this.logger.error(`Failed to delete chunks for livestream ${livestreamId}:`, error);
      throw error;
    }
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

      await this.documentS3Client.send(command);
      this.logger.log(`Uploaded document ${fileName} for teacher ${teacherId}`);
      
      // Return public URL
      return `${this.documentPublicUrl}/${key}`;
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
