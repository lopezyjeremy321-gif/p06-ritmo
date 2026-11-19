import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, type AppTheme } from './theme';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'ritmo-pref:theme'; // fuera del prefijo de datos: no se borra con el logout (es una preferencia del dispositivo)

const Ctx = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void; theme: AppTheme; isDark: boolean }>({
  pref: 'system', setPref: () => {}, theme: lightTheme, isDark: false,
});
export const useThemePref = () => useContext(Ctx);

export function ThemePrefProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); }).catch(() => {});
  }, []);
  const value = useMemo(() => {
    const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
    return {
      pref, isDark, theme: isDark ? darkTheme : lightTheme,
      setPref: (p: ThemePref) => { setPrefState(p); AsyncStorage.setItem(KEY, p).catch(() => {}); },
    };
  }, [pref, system]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
