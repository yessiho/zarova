'use client';

import { useCallback, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotificationSocket, LiveNotification } from '@/hooks/useNotificationSocket';

interface Toast {
  id: number;
  notification: LiveNotification;
}

export default function LiveNotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleNotification = useCallback((notification: LiveNotification) => {
    const toast: Toast = { id: Date.now(), notification };
    setToasts((prev) => [...prev.slice(-4), toast]);
    // Auto-dismiss after 6 seconds
    setTimeout(() => dismiss(toast.id), 6000);
  }, [dismiss]);

  useNotificationSocket(handleNotification);

  if (toasts.length === 0) return null;

  return (
    <div className="live-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="live-toast">
          <div className="live-toast-icon">
            <Bell size={16} />
          </div>
          <div className="live-toast-content">
            <strong>{toast.notification.title}</strong>
            <span>{toast.notification.body}</span>
          </div>
          <button
            type="button"
            className="live-toast-close"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
