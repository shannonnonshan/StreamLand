import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ProcessingStepUpdatePayload } from './processing.types';

interface RoomPayload {
  entityId: string;
  entityType: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class ProcessingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server | undefined;

  private readonly logger = new Logger(ProcessingGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // FIX 4: Client join room for each entity
  // Client send: socket.emit('join-processing-room', { entityId, entityType })
  @SubscribeMessage('join-processing-room')
  handleJoinRoom(client: Socket, payload: RoomPayload) {
    const room = this.getRoomName(payload.entityType, payload.entityId);
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
  }

  @SubscribeMessage('leave-processing-room')
  handleLeaveRoom(client: Socket, payload: RoomPayload) {
    const room = this.getRoomName(payload.entityType, payload.entityId);
    void client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  emitProcessingStepUpdate(payload: ProcessingStepUpdatePayload) {
    if (!this.server) {
      this.logger.warn(`Socket server is not ready for ${payload.entityType}:${payload.entityId}`);
      return;
    }

    const room = this.getRoomName(payload.entityType, payload.entityId);
    this.logger.log(`Emit to room [${room}]: ${payload.step} → ${payload.status}`);
    this.server.to(room).emit('processing-step-update', payload);
  }

  private getRoomName(entityType: string, entityId: string): string {
    return `processing:${entityType.toUpperCase()}:${entityId}`;
  }
}