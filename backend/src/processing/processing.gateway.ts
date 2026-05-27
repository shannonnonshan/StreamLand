import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ProcessingStepUpdatePayload } from './processing.types';

@WebSocketGateway({ cors: { origin: '*' } })
export class ProcessingGateway {
  @WebSocketServer()
  server: Server | undefined;

  private readonly logger = new Logger(ProcessingGateway.name);

  emitProcessingStepUpdate(payload: ProcessingStepUpdatePayload) {
    if (!this.server) {
      this.logger.warn(`Socket server is not ready for ${payload.entityType}:${payload.entityId}`);
      return;
    }

    this.logger.log(`Emit processing-step-update ${payload.entityType}:${payload.entityId} ${payload.step} ${payload.status}`);
    this.server.emit('processing-step-update', payload);
  }
}