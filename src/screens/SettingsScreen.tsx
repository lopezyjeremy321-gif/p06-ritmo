import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';
import { space, touch } from '../theme/tokens';
import { useThemePref, type ThemePref } from '../theme/ThemePref';
import { useData } from '../data/store';
import { addDays, toISODate } from '../data/stats';
import { SyncBanner } from '../components/ui';
import { Segmented } from '../components/Segmented';

export function SettingsScreen() {
  const t = useTheme<AppTheme>();
  const { pref, setPref } = useThemePref();
  const { user, signOut, deleteMyData, saveHabit, saveEntry, toggleLog, lastSyncAt, pending } = useData();
  const [dlg, setDlg] = useState<null | 'data' | 'logout'>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadDemo = () => {
    const today = toISODate(new Date());
    const ids = ['Beber 2 litros de agua', 'Caminar 20 minutos', 'Leer 10 páginas'].map((n, i) =>
      saveHabit({ name: n, icon: ['water-outline', 'walk', 'book-open-variant'][i], weekly_target: [7, 5, 4][i] }));
    [0, 1, 2, 4, 5, 6].forEach((d) => toggleLog(ids[0], addDays(today, -d)));
    [0, 1, 3, 5].forEach((d) => toggleLog(ids[1], addDays(today, -d)));
    [1, 2].forEach((d) => toggleLog(ids[2], addDays(today, -d)));
    const demo: [string, 'gasto' | 'ingreso', number, number][] = [
      ['Comida', 'gasto', 1850, 0], ['Transporte', 'gasto', 620, 0], ['Comida', 'gasto', 2475, 1], ['Ocio', 'gasto', 4200, 2],
      ['Sueldo', 'ingreso', 150000, 3], ['Hogar', 'gasto', 8900, 3], ['Comida', 'gasto', 1320, 4], ['Salud', 'gasto', 3500, 5], ['Transporte', 'gasto', 640, 6],
    ];
    demo.forEach(([category, kind, amount_cents, back]) => saveEntry({ kind, amount_cents, category, note: 'Dato de ejemplo', occurred_on: addDays(today, -back) }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <SyncBanner />
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.block}>
          <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Cuenta</Text>
          <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant }} selectable>{user?.email}</Text>
          <Text variant="bodySmall" style={{ color: t.colors.onSurfaceVariant }}>
            {pending ? `${pending} cambios esperan red.` : 'Todo está enviado.'} {lastSyncAt ? `Última sincronización: ${new Date(lastSyncAt).toLocaleTimeString('es')}.` : ''}
          </Text>
        </View>

        <View style={styles.block}>
          <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Apariencia</Text>
          <Segmented
            value={pref} onChange={setPref}
            options={[
              { value: 'system', label: 'Sistema', icon: 'cellphone' },
              { value: 'light', label: 'Claro', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Oscuro', icon: 'weather-night' },
            ]}
          />
        </View>

        <View style={styles.block}>
          <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Datos de ejemplo</Text>
          <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>Añade hábitos y movimientos ficticios para probar la app. Se pueden borrar abajo.</Text>
          <Button mode="outlined" icon="database-plus-outline" onPress={loadDemo} contentStyle={{ minHeight: touch.min }}>Cargar datos de ejemplo</Button>
        </View>

        <View style={styles.block}>
          <Button mode="contained-tonal" icon="logout" onPress={() => setDlg('logout')} contentStyle={{ minHeight: touch.min }}>Cerrar sesión</Button>
          <Button mode="outlined" icon="trash-can-outline" textColor={t.colors.error} onPress={() => setDlg('data')} contentStyle={{ minHeight: touch.min }}>Borrar mis datos</Button>
          {err ? <Text variant="bodyMedium" style={{ color: t.colors.error }} accessibilityRole="alert">{err}</Text> : null}
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={dlg === 'logout'} onDismiss={() => setDlg(null)}>
          <Dialog.Title>¿Cerrar sesión?</Dialog.Title>
          <Dialog.Content><Text variant="bodyLarge">{pending ? `Tienes ${pending} cambios sin enviar que se perderán en este teléfono.` : 'Se borran los datos guardados en este teléfono. Tu cuenta sigue en la nube.'}</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDlg(null)} contentStyle={{ minHeight: touch.min }}>Seguir aquí</Button>
            <Button onPress={() => { setDlg(null); void signOut(); }} contentStyle={{ minHeight: touch.min }}>Cerrar sesión</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={dlg === 'data'} onDismiss={() => setDlg(null)}>
          <Dialog.Title>¿Borrar todos tus datos?</Dialog.Title>
          <Dialog.Content><Text variant="bodyLarge">Se eliminan tus hábitos, registros y movimientos de la nube y de este teléfono. No se puede deshacer.</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDlg(null)} contentStyle={{ minHeight: touch.min }}>Conservar</Button>
            <Button textColor={t.colors.error} onPress={async () => { setDlg(null); setErr(await deleteMyData()); }} contentStyle={{ minHeight: touch.min }}>Borrar mis datos</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.xl },
  block: { gap: space.sm },
});
