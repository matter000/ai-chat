// 用户 Profile 数据（存 IndexedDB）
export interface UserProfile {
  id: string;           // nanoid
  name: string;
  email: string;        // 用于登录的标识
  avatarEmoji: string;  // 单字 emoji 或两个字母缩写
  passwordHash: string; // "pbkdf2:salt_base64:hash_base64"
  recoveryHint: string; // 忘记密码时的提示
  createdAt: number;
}

// localStorage 小标记：当前是否 logged in + 用户 id
export const AUTH_KEY = 'ai-chat-auth';
export interface AuthState {
  loggedIn: boolean;
  userId: string | null;
}

export function getAuthState(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : { loggedIn: false, userId: null };
  } catch {
    return { loggedIn: false, userId: null };
  }
}

export function setAuthState(state: AuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

export function clearAuthState() {
  localStorage.removeItem(AUTH_KEY);
}