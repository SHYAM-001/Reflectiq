import { useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = {
    success: (message: string, options?: { duration?: number; description?: string }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast: Toast = {
        id,
        message,
        type: 'success',
        duration: options?.duration || 3000,
      };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    },
    error: (message: string, options?: { duration?: number }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast: Toast = {
        id,
        message,
        type: 'error',
        duration: options?.duration || 3000,
      };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    },
    info: (message: string, options?: { duration?: number }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const newToast: Toast = {
        id,
        message,
        type: 'info',
        duration: options?.duration || 3000,
      };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    },
  };

  return { toast, toasts };
};

// Simple toast function for compatibility
export const toast = {
  success: (message: string, options?: { duration?: number; description?: string }) => {
    console.log('Toast Success:', message, options?.description);
  },
  error: (message: string, options?: { duration?: number }) => {
    console.log('Toast Error:', message);
  },
  info: (message: string, options?: { duration?: number }) => {
    console.log('Toast Info:', message);
  },
};
