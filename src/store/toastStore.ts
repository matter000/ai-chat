import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, ttl?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;
const DEFAULT_TTL = 3500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, message, ttl = DEFAULT_TTL) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    window.setTimeout(() => {
      const cur = get().toasts;
      if (cur.some((t) => t.id === id)) get().dismiss(id);
    }, ttl);
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 便捷调用 */
export const toast = {
  info: (msg: string, ttl?: number) => useToastStore.getState().push('info', msg, ttl),
  success: (msg: string, ttl?: number) => useToastStore.getState().push('success', msg, ttl),
  error: (msg: string, ttl?: number) => useToastStore.getState().push('error', msg, ttl ?? 5000),
};
