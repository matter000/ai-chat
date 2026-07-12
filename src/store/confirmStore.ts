import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
}

interface ConfirmActions {
  /** 私有：当前 pending 的回调（不进 state，避免序列化/外部读到 pending 函数） */
  resolve: ((ok: boolean) => void) | null;
  confirm: (opts: {
    title?: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}

const initial: ConfirmState = {
  open: false,
  title: '确认',
  message: '',
  confirmLabel: '确认',
  danger: false,
};

export const useConfirmStore = create<ConfirmState & ConfirmActions>((set, get) => ({
  ...initial,
  resolve: null,
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
    set({ ...initial, resolve: null });
  },
  onCancel: () => {
    get().resolve?.(false);
    set({ ...initial, resolve: null });
  },
}));

/** 便捷调用（不需要 hook subscribe 时也能用） */
export async function confirmDialog(opts: {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return useConfirmStore.getState().confirm(opts);
}
