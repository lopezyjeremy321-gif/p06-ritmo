import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { config } from './env';
import { secureStorage } from './secureStorage';

// Sin config valida el cliente apunta a un host inexistente: la app muestra la pantalla de configuracion antes de usarlo.
export const supabase = createClient(config?.url ?? 'http://invalid.local', config?.anonKey ?? 'sin-config', {
  auth: {
    storage: secureStorage,      // tokens en SecureStore (Keystore), nunca en claro
    flowType: 'pkce',            // deep links con PKCE
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // los callbacks se validan a mano (state) en src/auth/deeplink.ts
  },
  realtime: { params: { eventsPerSecond: 10 } },
});
