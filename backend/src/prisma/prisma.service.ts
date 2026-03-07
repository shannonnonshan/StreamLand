import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as MongoClient } from '@prisma/mongodb-client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // PostgreSQL client
  public postgres: PrismaClient;

  // MongoDB client
  public mongo: MongoClient;

  constructor() {
    // Initialize PostgreSQL client with increased timeout and connection settings
    this.postgres = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL + '&connection_limit=20&pool_timeout=30',
        },
      },
      log: ['error', 'warn'],
    });

    // Initialize MongoDB client
    this.mongo = new MongoClient({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    // Connect to both databases with retry logic
    try {
      await this.postgres.$connect();
      this.logger.log('PostgreSQL connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to connect to PostgreSQL:', errorMessage);
      this.logger.warn('Retrying PostgreSQL connection in 2 seconds...');
      
      // Retry after 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      try {
        await this.postgres.$connect();
        this.logger.log('PostgreSQL connected successfully on retry');
      } catch (retryError) {
        const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError);
        console.error('Failed to connect to PostgreSQL on retry:', retryErrorMessage);
        throw retryError;
      }
    }

    try {
      await this.mongo.$connect();
      this.logger.log('MongoDB connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to connect to MongoDB:', errorMessage);
      throw error;
    }
  }

  async onModuleDestroy() {
    // Disconnect from both databases
    try {
      await this.postgres.$disconnect();
      this.logger.log('PostgreSQL disconnected');
    } catch (error) {
      console.error('Error disconnecting PostgreSQL:', error);
    }

    try {
      await this.mongo.$disconnect();
      this.logger.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting MongoDB:', error);
    }
  }
}
