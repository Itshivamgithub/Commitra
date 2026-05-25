'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X, ExternalLink, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useSocket } from '@/providers/SocketProvider';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import useSWR from 'swr';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { socket } = useSocket();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { data, mutate } = useSWR('/api/notifications', (url) => 
    api.get(url).then(res => res.data.data)
  );

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = () => {
      mutate(); // Refetch all notifications
    };

    socket.on('notification', handleNewNotification);
    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket, mutate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/api/notifications/read-all');
      mutate();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      mutate();
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const clearAll = async () => {
    try {
      await api.delete('/api/notifications');
      mutate();
    } catch (err) {
      console.error('Failed to clear notifications', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 px-4 py-3">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</h3>
            <div className="flex gap-2">
              <button 
                onClick={markAllRead}
                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="h-10 w-10 text-slate-200 dark:text-slate-800 mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n: any) => (
                <div 
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`group relative flex items-start gap-3 border-b border-slate-100 dark:border-slate-900/50 px-4 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40 ${!n.read ? 'bg-indigo-500/5' : ''}`}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{n.title}</p>
                      <span className="text-[10px] text-slate-500">{formatDistanceToNow(new Date(n.timestamp))} ago</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{n.message}</p>
                    {n.actionUrl && (
                      <Link 
                        href={n.actionUrl}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                        }}
                      >
                        View details <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                  {!n.read && (
                    <div className="absolute right-4 bottom-4 h-2 w-2 rounded-full bg-indigo-500" />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-900 p-2">
            <button
              onClick={clearAll}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-red-600 dark:hover:text-red-400 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConnectionStatus() {
  const { isConnected } = useSocket();

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50">
      <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {isConnected ? 'Live' : 'Reconnecting...'}
      </span>
    </div>
  );
}
