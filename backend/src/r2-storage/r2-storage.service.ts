import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import * as path from 'path';

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
      console.log(`[R2] uploadVideo: streaming to ${key} with metadata:`, metadata);
      
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
      console.log(`[R2] Upload complete for ${key}`);
      this.logger.log(`Uploaded complete video for livestream ${livestreamId}`);
      
      // Return public URL (R2.dev subdomain)
      return `${this.publicUrl}/${key}`;
    } catch (error) {
      console.error(`[R2] uploadVideo ERROR for ${livestreamId}:`, error);
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
    const normalizedName = path.posix
      .basename(fileName.replace(/\\/g, '/'))
      .replace(/[\r\n]/g, '')
      .trim();
    const safeName = normalizedName || 'document';
    const key = `documents/${teacherId}/${safeName}`;

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
   * Delete document from R2 by full public URL
   */
  async deleteDocument(documentUrl: string): Promise<void> {
    try {
      const key = this.getDocumentKeyFromUrl(documentUrl);
      if (!key) {
        this.logger.warn(`Could not determine key from document URL: ${documentUrl}`);
        return;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.documentBucketName,
        Key: key,
      });

      await this.documentS3Client.send(command);
      this.logger.log(`Deleted document from R2: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentUrl}:`, error);
      throw error;
    }
  }

  private getKeyFromUrl(resourceUrl: string): string | null {
    try {
      const parsed = new URL(resourceUrl);
      const key = parsed.pathname.replace(/^\/+/, '');
      return key || null;
    } catch (error) {
      return null;
    }
  }

  private replaceExtension(key: string, extension: string): string {
    const parsed = path.posix.parse(key);
    const filename = `${parsed.name}.${extension}`;

    if (!parsed.dir || parsed.dir === '.') {
      return filename;
    }

    return `${parsed.dir}/${filename}`;
  }

  getRecordingKeyFromUrl(recordingUrl: string): string | null {
    return this.getKeyFromUrl(recordingUrl);
  }

  private getRecordingAudioKey(recordingId: string): string {
    return `audio/livestream/${recordingId}.mp3`;
  }

  getRecordingAudioKeyFromUrl(recordingUrl: string): string | null {
    const key = this.getRecordingKeyFromUrl(recordingUrl);
    if (!key) return null;
    return this.replaceExtension(key, 'mp3');
  }

  getRecordingAudioUrlFromUrl(recordingUrl: string): string | null {
    const audioKey = this.getRecordingAudioKeyFromUrl(recordingUrl);
    if (!audioKey) return null;
    return `${this.publicUrl}/${audioKey}`;
  }

  async recordingAudioExistsByUrl(recordingUrl: string): Promise<boolean> {
    const key = this.getRecordingAudioKeyFromUrl(recordingUrl);
    if (!key) return false;

    try {
      await this.videoS3Client.send(
        new HeadObjectCommand({
          Bucket: this.videoBucketName,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async uploadRecordingAudioByUrl(recordingUrl: string, audioBuffer: Buffer): Promise<string> {
    const key = this.getRecordingAudioKeyFromUrl(recordingUrl);
    if (!key) {
      throw new Error('Recording URL is not in the expected R2 path');
    }

    const command = new PutObjectCommand({
      Bucket: this.videoBucketName,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    });

    await this.videoS3Client.send(command);
    this.logger.log(`Uploaded recording audio for ${key}`);
    return `${this.publicUrl}/${key}`;
  }

  getDocumentKeyFromUrl(documentUrl: string): string | null {
    return this.getKeyFromUrl(documentUrl);
  }

  private getDocumentAudioKey(documentId: string): string {
    return `audio/document/${documentId}.mp3`;
  }

  getDocumentAudioKeyFromUrl(documentUrl: string): string | null {
    const key = this.getDocumentKeyFromUrl(documentUrl);
    if (!key) return null;

    return this.replaceExtension(key, 'mp3');
  }

  getDocumentAudioUrlFromUrl(documentUrl: string): string | null {
    const audioKey = this.getDocumentAudioKeyFromUrl(documentUrl);
    if (!audioKey) return null;

    return `${this.documentPublicUrl}/${audioKey}`;
  }

  async documentAudioExistsByUrl(documentUrl: string): Promise<boolean> {
    const audioKey = this.getDocumentAudioKeyFromUrl(documentUrl);
    if (!audioKey) return false;

    try {
      await this.documentS3Client.send(
        new HeadObjectCommand({
          Bucket: this.documentBucketName,
          Key: audioKey,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async uploadDocumentAudioByUrl(documentUrl: string, audioBuffer: Buffer): Promise<string> {
    const audioKey = this.getDocumentAudioKeyFromUrl(documentUrl);
    if (!audioKey) {
      throw new Error('Document URL is not in the expected R2 path');
    }

    const command = new PutObjectCommand({
      Bucket: this.documentBucketName,
      Key: audioKey,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    });

    await this.documentS3Client.send(command);
    this.logger.log(`Uploaded document audio for ${audioKey}`);
    return `${this.documentPublicUrl}/${audioKey}`;
  }

  /**
   * Upload chat image to R2 documents bucket (in chat-images folder)
   */
  async uploadChatImage(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const key = `chat-images/${Date.now()}-${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.documentBucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.documentS3Client.send(command);
      this.logger.log(`Uploaded chat image ${fileName}`);
      
      // Return public URL
      return `${this.documentPublicUrl}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload chat image ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Upload CV to R2 documents bucket (in resume/<user-id> folder)
   */
  async uploadCV(
    userId: string,
    fileName: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const key = `resume/${userId}/${Date.now()}-${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.documentBucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.documentS3Client.send(command);
      this.logger.log(`Uploaded CV for user ${userId}`);
      
      // Return public URL
      return `${this.documentPublicUrl}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload CV for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete chat image from R2 by URL
   */
  async deleteChatImage(imageUrl: string): Promise<void> {
    try {
      // Extract key from URL
      // URL format: https://pub-xxx.r2.dev/chat-images/timestamp-filename.jpg
      const key = imageUrl.replace(`${this.documentPublicUrl}/`, '');
      
      if (!key.startsWith('chat-images/')) {
        throw new Error('Invalid chat image URL');
      }

      const command = new DeleteObjectCommand({
        Bucket: this.documentBucketName,
        Key: key,
      });

      await this.documentS3Client.send(command);
      this.logger.log(`Deleted chat image: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete chat image ${imageUrl}:`, error);
      throw error;
    }
  }

  /**
   * Upload recording audio by recording ID
   * Saves to audio-export/{recordingId}.wav in video bucket
   */
  async uploadRecordingAudioById(
    recordingId: string,
    audioBuffer: Buffer,
  ): Promise<string> {
    const key = this.getRecordingAudioKey(recordingId);

    try {
      const command = new PutObjectCommand({
        Bucket: this.videoBucketName,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      });

      await this.videoS3Client.send(command);
      this.logger.log(`Uploaded recording audio for ${recordingId}`);
      return `${this.publicUrl}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload recording audio ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Check if recording audio exists by recording ID
   */
  async recordingAudioExistsById(recordingId: string): Promise<boolean> {
    const key = this.getRecordingAudioKey(recordingId);

    try {
      await this.videoS3Client.send(
        new HeadObjectCommand({
          Bucket: this.videoBucketName,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get recording audio URL by recording ID
   */
  getRecordingAudioUrlById(recordingId: string): string {
    return `${this.publicUrl}/${this.getRecordingAudioKey(recordingId)}`;
  }

  /**
   * Upload document audio by document ID
   * Saves to audio-export/{documentId}.wav in document bucket
   */
  async uploadDocumentAudioById(
    documentId: string,
    audioBuffer: Buffer,
  ): Promise<string> {
    const key = this.getDocumentAudioKey(documentId);

    try {
      const command = new PutObjectCommand({
        Bucket: this.documentBucketName,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
      });

      await this.documentS3Client.send(command);
      this.logger.log(`Uploaded document audio for ${documentId}`);
      return `${this.documentPublicUrl}/${key}`;
    } catch (error) {
      this.logger.error(`Failed to upload document audio ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Check if document audio exists by document ID
   */
  async documentAudioExistsById(documentId: string): Promise<boolean> {
    const key = this.getDocumentAudioKey(documentId);

    try {
      await this.documentS3Client.send(
        new HeadObjectCommand({
          Bucket: this.documentBucketName,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get document audio URL by document ID
   */
  getDocumentAudioUrlById(documentId: string): string {
    return `${this.documentPublicUrl}/${this.getDocumentAudioKey(documentId)}`;
  }
}
