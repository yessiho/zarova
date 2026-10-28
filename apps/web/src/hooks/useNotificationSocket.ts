'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth';

export interface LiveNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function useNotificationSocket(
  onNotification: (n: LiveNotification) => void,
) {
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) return;

    if (socketRef.current?.connected) return;

    const socket = io(`${API_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('notification', (data: LiveNotification) => {
      callbackRef.current(data);
    });

    socket.on('connect_error', () => {
      // Silent — backend may not have WS enabled yet
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
}
