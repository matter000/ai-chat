import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
}

const initial: ConfirmState = {
  open: false,
  title: '确认',
  message: '',
  confirmLabel: '确认',
  danger: false,
  resolve: null,
};

interface ConfirmActions {
  confirm: (opts: {
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const useConfirmStore = create<ConfirmState & ConfirmActions>((set, get) => ({
  ...initial,
  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      set({
        open: true,
        title: opts.title ?? '确认',
        message: opts.message,
        confirmLabel: opts.confirmLabel ?? '确认',
        danger: opts.danger ?? false,
        resolve,
      });
    }),
  onConfirm: () => {
    get().resolve?.(true);
    set({ ...initial });
  },
  onCancel: () => {
    get().resolve?.(false);
    set({ ...initial });
  },
}));
