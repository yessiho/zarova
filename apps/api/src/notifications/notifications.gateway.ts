import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

export interface NotificationPayload {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      ...(process.env['FRONTEND_URL'] ? [process.env['FRONTEND_URL']] : []),
    ],
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Map userId → Set of socket ids currently authenticated for that user
  private readonly userSockets = new Map<number, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  // ============================================================
  // CONNECTION LIFECYCLE
  // ============================================================

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, unknown>)['token'] as string |
        undefined ??
        (client.handshake.headers['authorization'] as string | undefined)
          ?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        type: string;
      }>(token, { secret: process.env['JWT_SECRET'] ?? 'super-secret-key' });

      if (payload.type !== 'USER') {
        client.disconnect();
        return;
      }

      client.data = { userId: payload.sub };

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      // Place the socket in a room named after the userId
      await client.join(`user:${payload.sub}`);

      this.logger.log(`User ${payload.sub} connected (socket ${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: number }).userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      this.logger.log(`User ${userId} disconnected (socket ${client.id})`);
    }
  }

  // ============================================================
  // CLIENT-INITIATED EVENTS
  // ============================================================

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() _data: unknown,
  ) {
    return { event: 'pong', data: { socketId: client.id } };
  }

  // ============================================================
  // SERVER-EMITTED EVENTS (triggered by internal NestJS events)
  // ============================================================

  @OnEvent('notification.created')
  handleNotificationCreated(payload: {
    userId: number;
    notification: NotificationPayload;
  }) {
    this.server
      .to(`user:${payload.userId}`)
      .emit('notification', payload.notification);

    this.logger.log(
      `Pushed notification to user ${payload.userId}: ${payload.notification.title}`,
    );
  }
}
