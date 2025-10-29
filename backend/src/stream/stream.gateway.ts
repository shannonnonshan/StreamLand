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

// Payload types
interface LivestreamInfo {
  title: string;
  description: string;
  category: string;
}

interface BroadcasterPayload {
  teacherID: string;
  livestreamID: string;
  info?: LivestreamInfo;
}

interface WatcherPayload {
  teacherID: string;
  livestreamID: string;
}

interface OfferPayload extends BroadcasterPayload {
  to: string;
  sdp: unknown;
}

interface AnswerPayload extends BroadcasterPayload {
  to: string;
  sdp: unknown;
}

interface CandidatePayload extends BroadcasterPayload {
  to: string;
  candidate: unknown;
}

interface Channel {
  broadcaster: string;
  watchers: Set<string>;
  info?: LivestreamInfo;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class StreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // key = `${teacherID}:${livestreamID}`
  private channels: Record<string, Channel> = {};

  private getKey(teacherID: string, livestreamID: string) {
    return `${teacherID}:${livestreamID}`;
  }

  handleConnection() {
    // Client connected
  }

  handleDisconnect(socket: Socket) {
    for (const key of Object.keys(this.channels)) {
      const channel = this.channels[key];

      if (channel.broadcaster === socket.id) {
        // Broadcaster đóng stream, notify watchers
        this.server.to([...channel.watchers]).emit('stream-ended', {
          teacherID: key.split(':')[0],
          livestreamID: key.split(':')[1],
        });
        delete this.channels[key];
        console.log('Broadcaster closed channel:', key);
      } else if (channel.watchers.has(socket.id)) {
        // Watcher rời, notify broadcaster
        channel.watchers.delete(socket.id);
        this.server.to(channel.broadcaster).emit('bye', socket.id);
        this.server
          .to(channel.broadcaster)
          .emit('viewerCount', channel.watchers.size);
      }
    }
  }

  @SubscribeMessage('broadcaster')
  handleBroadcaster(
    @MessageBody() data: BroadcasterPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    if (!this.channels[key]) {
      this.channels[key] = { 
        broadcaster: socket.id, 
        watchers: new Set(),
        info: data.info 
      };
    } else {
      this.channels[key].broadcaster = socket.id;
      if (data.info) {
        this.channels[key].info = data.info;
      }
    }

    // Notify all waiting watchers that broadcaster is online
    socket.broadcast.emit('broadcaster');
    console.log('Broadcaster started:', key);
  }

  @SubscribeMessage('watcher')
  handleWatcher(
    @MessageBody() data: WatcherPayload,
    @ConnectedSocket() socket: Socket,
  ) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];

    if (channel) {
      channel.watchers.add(socket.id);
      // Send watcher info to broadcaster with object format
      this.server.to(channel.broadcaster).emit('watcher', { id: socket.id });

      // Send livestream info to the watcher
      if (channel.info) {
        this.server.to(socket.id).emit('livestream-info', channel.info);
      }

      // emit số watcher hiện tại tới broadcaster
      this.server
        .to(channel.broadcaster)
        .emit('viewerCount', channel.watchers.size);

      console.log('Watcher joined channel:', socket.id, 'for', key);
      console.log('Current viewers:', channel.watchers.size);
    } else {
      console.log('No broadcaster found for channel:', key);
      // Notify the watcher that the stream is not available
      this.server.to(socket.id).emit('stream-not-found', {
        teacherID: data.teacherID,
        livestreamID: data.livestreamID,
      });
    }
  }
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
    this.server
      .to(data.to)
      .emit('candidate', { from: socket.id, candidate: data.candidate });
  }

  @SubscribeMessage('stream-ended')
  handleStreamEnded(@MessageBody() data: BroadcasterPayload) {
    const key = this.getKey(data.teacherID, data.livestreamID);
    const channel = this.channels[key];
    if (channel) {
      this.server.to([...channel.watchers]).emit('stream-ended', data);
      delete this.channels[key];
    }
  }
}
