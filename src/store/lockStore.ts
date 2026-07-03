import { create } from 'zustand';
import {
  isEncryptionEnabled,
  hasMasterPassword,
  setMasterPassword,
  unlockWithPassword,
  clearMasterPassword,
  lock,
  isUnlocked,
} from '@/services/crypto';

interface LockState {
  /** 是否启用了加密（设过主密码） */
  enabled: boolean;
  /** 当前会话是否已解锁（内存里有 key） */
  unlocked: boolean;
  /** 之前是否已经初始化过 */
  initialized: boolean;
  refresh: () => void;
  setPassword: (p: string) => Promise<void>;
  unlock: (p: string) => Promise<boolean>;
  remove: () => void;
  lockNow: () => void;
}

export const useLockStore = create<LockState>((set) => ({
  enabled: isEncryptionEnabled(),
  unlocked: isUnlocked(),
  initialized: false,
  refresh: () => set({ enabled: isEncryptionEnabled(), unlocked: isUnlocked() }),
  setPassword: async (p: string) => {
    await setMasterPassword(p);
    set({ enabled: true, unlocked: true });
  },
  unlock: async (p: string) => {
    const ok = await unlockWithPassword(p);
    set({ unlocked: ok });
    return ok;
  },
  remove: () => {
    clearMasterPassword();
    set({ enabled: false, unlocked: true });
  },
  lockNow: () => {
    lock();
    set({ unlocked: isUnlocked() });
  },
}));