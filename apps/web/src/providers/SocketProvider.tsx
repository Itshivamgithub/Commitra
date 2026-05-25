'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '../context/auth';
import { getAccessToken } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents } from '@commitra/types';
import { toast } from 'react-hot-toast'; // Assuming toast is available or I should add it

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: AppSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (user) {
      const accessToken = getAccessToken();
      if (accessToken) {
        const s = getSocket(accessToken);
        setSocket(s);

        s.on('connect', () => {
          setIsConnected(true);
          console.log('Socket connected');
        });

        s.on('disconnect', () => {
          setIsConnected(false);
          console.log('Socket disconnected');
        });

        s.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          setIsConnected(false);
        });

        // Global notification handler
        s.on('notification', (notif) => {
          if (notif.type === 'success') toast.success(notif.message);
          else if (notif.type === 'error') toast.error(notif.message);
          else if (notif.type === 'warning') toast(notif.message, { icon: '⚠️' });
          else toast(notif.message, { icon: 'ℹ️' });
        });

        return () => {
          disconnectSocket();
          setSocket(null);
          setIsConnected(false);
        };
      }
    } else {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
