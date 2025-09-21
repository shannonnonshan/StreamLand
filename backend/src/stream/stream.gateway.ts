import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Define payload types
interface OfferPayload {
  to: string;
  sdp: unknown; // dùng unknown thay vì any
}

interface AnswerPayload {
  to: string;
  sdp: unknown;
}

interface CandidatePayload {
  to: string;
  candidate: unknown;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private broadcaster: string | null = null;

  handleConnection(socket: Socket) {
    console.log('Client connected:', socket.id);
  }

  handleDisconnect(socket: Socket) {
    console.log('Client disconnected:', socket.id);

    if (socket.id === this.broadcaster) {
      this.broadcaster = null;
      this.server.emit('broadcaster_closed'); // notify watchers
    }

    this.server.emit('bye', socket.id);
  }

  @SubscribeMessage('broadcaster')
  handleBroadcaster(@ConnectedSocket() socket: Socket) {
    this.broadcaster = socket.id;
    socket.broadcast.emit('broadcaster'); // notify watchers
    console.log('Broadcaster set:', socket.id);
  }

  @SubscribeMessage('watcher')
  handleWatcher(@ConnectedSocket() socket: Socket) {
    if (this.broadcaster) {
      this.server.to(this.broadcaster).emit('watcher', socket.id);
      console.log('Watcher -> broadcaster:', socket.id);
    }
  }

  // sender -> target
  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: OfferPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.to(data.to).emit('offer', { from: socket.id, sdp: data.sdp });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: AnswerPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.to(data.to).emit('answer', { from: socket.id, sdp: data.sdp });
  }

  @SubscribeMessage('candidate')
  handleCandidate(
    @MessageBody() data: CandidatePayload,
    @ConnectedSocket() socket: Socket,
  ) {
    this.server.to(data.to).emit('candidate', {
      from: socket.id,
      candidate: data.candidate,
    });
  }
}
