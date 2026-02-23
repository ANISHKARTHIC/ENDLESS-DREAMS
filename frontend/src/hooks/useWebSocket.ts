/* WebSocket hook for real-time trip updates */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket(tripId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>(undefined);

  const connect = useCallback(() => {
    if (!tripId) return;

    try {
      ws.current = new WebSocket(`${WS_URL}/trip/${tripId}/`);

      ws.current.onopen = () => {
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSMessage;
          setLastMessage(data);
        } catch {
          console.error('Failed to parse WS message');
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeout.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch {
      // WebSocket not available
    }
  }, [tripId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      ws.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, data: Record<string, unknown> = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  return { isConnected, lastMessage, sendMessage };
}
