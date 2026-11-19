import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AppTheme } from '../theme/theme';
import { component, iconSize, radius, space, touch } from '../theme/tokens';
import { useData } from '../data/store';
import type { SyncState } from '../data/types';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = iconSize.md, color, decorative = true }: { name: IconName; size?: number; color?: string; decorative?: boolean }) {
  const t = useTheme<AppTheme>();
  return (
    <MaterialCommunityIcons
      name={name} size={size} color={color ?? t.colors.onSurfaceVariant}
      accessible={!decorative} importantForAccessibility={decorative ? 'no' : 'yes'}
    />
  );
}

/** Indicador de sincronizacion persistente (siempre visible, con icono + texto, nunca solo color). */
export function SyncBanner() {
  const t = useTheme<AppTheme>();
  const { sync, pending, syncNow } = useData();
  const map: Record<SyncState, { icon: IconName; text: string; bg: string; fg: string }> = {
    synced: { icon: 'cloud-check-outline', text: pending ? `Sincronizado · ${pending} por enviar` : 'Sincronizado', bg: t.colors.surfaceVariant, fg: t.colors.onSurfaceVariant },
    syncing: { icon: 'cloud-sync-outline', text: 'Sincronizando…', bg: t.colors.secondaryContainer, fg: t.colors.onSecondaryContainer },
    offline: { icon: 'cloud-off-outline', text: pending ? `Sin conexión, se guardará luego (${pending})` : 'Sin conexión, se guardará luego', bg: t.colors.tertiaryContainer, fg: t.colors.onTertiaryContainer },
    error: { icon: 'cloud-alert-outline', text: 'No se pudo sincronizar', bg: t.colors.errorContainer, fg: t.colors.onErrorContainer },
    signed_out: { icon: 'cloud-off-outline', text: 'Sesión cerrada', bg: t.colors.surfaceVariant, fg: t.colors.onSurfaceVariant },
  };
  const s = map[sync];
  const retry = sync === 'error' || sync === 'offline';
  return (
    <View
      style={[styles.banner, { backgroundColor: s.bg }]}
      accessibilityRole="summary" accessibilityLiveRegion="polite"
      accessibilityLabel={`Estado de sincronización: ${s.text}`}
      testID="sync-banner"
    >
      {sync === 'syncing' ? <ActivityIndicator size="small" color={s.fg} /> : <MaterialCommunityIcons name={s.icon} size={iconSize.sm} color={s.fg} importantForAccessibility="no" />}
      <Text variant="labelMedium" style={{ color: s.fg, flex: 1 }}>{s.text}</Text>
      {retry ? <Button compact mode="text" textColor={s.fg} onPress={syncNow} style={{ minWidth: touch.min, minHeight: touch.min, justifyContent: 'center' }}>Reintentar</Button> : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, cta, onCta }: { icon: IconName; title: string; body: string; cta?: string; onCta?: () => void }) {
  const t = useTheme<AppTheme>();
  return (
    <View style={styles.empty} testID="empty-state">
      <View style={[styles.emptyIcon, { backgroundColor: t.colors.primaryContainer }]}>
        <MaterialCommunityIcons name={icon} size={iconSize.lg} color={t.colors.onPrimaryContainer} importantForAccessibility="no" />
      </View>
      <Text variant="titleLarge" style={{ color: t.colors.onSurface, textAlign: 'center' }}>{title}</Text>
      <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>{body}</Text>
      {cta && onCta ? <Button mode="contained" onPress={onCta} style={styles.emptyBtn} contentStyle={{ minHeight: touch.min }}>{cta}</Button> : null}
    </View>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  const t = useTheme<AppTheme>();
  return (
    <View style={styles.empty} accessibilityRole="alert" testID="error-state">
      <View style={[styles.emptyIcon, { backgroundColor: t.colors.errorContainer }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={iconSize.lg} color={t.colors.onErrorContainer} importantForAccessibility="no" />
      </View>
      <Text variant="titleLarge" style={{ color: t.colors.onSurface, textAlign: 'center' }}>{title}</Text>
      <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>{body}</Text>
      <Button mode="contained-tonal" onPress={onRetry} style={styles.emptyBtn} contentStyle={{ minHeight: touch.min }}>Reintentar sincronización</Button>
    </View>
  );
}

export function SkeletonRows({ n = 5 }: { n?: number }) {
  const t = useTheme<AppTheme>();
  return (
    <View accessibilityLabel="Cargando" accessibilityLiveRegion="polite" testID="skeleton">
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={styles.skelRow}>
          <View style={[styles.skelDot, { backgroundColor: t.colors.surfaceVariant }]} />
          <View style={{ flex: 1, gap: space.sm }}>
            <View style={[styles.skelLine, { backgroundColor: t.colors.surfaceVariant, width: '60%' }]} />
            <View style={[styles.skelLine, { backgroundColor: t.colors.surfaceVariant, width: '35%', height: 10 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Fila pulsable con ripple, altura minima 64dp y target >=48dp. */
export function Row({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  const t = useTheme<AppTheme>();
  return (
    <Pressable
      onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={{ color: t.colors.surfaceVariant }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.colors.surfaceVariant }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: component.syncBanner.minHeight, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  emptyBtn: { marginTop: space.sm },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: component.listRow.minHeight },
  skelDot: { width: 40, height: 40, borderRadius: radius.pill },
  skelLine: { height: 14, borderRadius: radius.sm },
  row: { minHeight: component.listRow.minHeight, paddingHorizontal: component.listRow.paddingH, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: component.listRow.gap },
});
