/**
 * Almacen de la sesion de Auth. Nativo: expo-secure-store (Keystore/Keychain), troceado porque
 * SecureStore limita ~2 KB por valor. Web/PWA: no existe almacen seguro; se usa localStorage (limite declarado).
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;
const META = '.n';
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

export interface AsyncKV {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}

async function removeNative(key: string) {
  const k = safe(key);
  const n = Number((await SecureStore.getItemAsync(k + META, opts)) ?? 0);
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
  await SecureStore.deleteItemAsync(k + META, opts);
}

export const secureStorage: AsyncKV = {
  async getItem(key) {
    if (Platform.OS === 'web') return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    const k = safe(key);
    const n = await SecureStore.getItemAsync(k + META, opts);
    if (!n) return null;
    let out = '';
    for (let i = 0; i < Number(n); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, opts);
      if (part === null) return null;
      out += part;
    }
    return out;
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    const k = safe(key);
    await removeNative(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${k}.${i}`, parts[i], opts);
    await SecureStore.setItemAsync(k + META, String(parts.length), opts);
  },
  async removeItem(key) {
    if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); return; }
    await removeNative(key);
  },
};
