import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';
import { radius, touch } from '../theme/tokens';
import { Icon, type IconName } from './ui';

export interface SegOption<T extends string> { value: T; label: string; icon: IconName; a11y?: string }

/**
 * Botones segmentados Material 3 con objetivo tactil de 48 dp (el de Paper mide 40 dp; medido con uiautomator).
 * El seleccionado lleva icono + relleno (no solo color).
 */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: SegOption<T>[] }) {
  const t = useTheme<AppTheme>();
  return (
    <View style={[styles.row, { borderColor: t.colors.outline }]} accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value} onPress={() => onChange(o.value)}
            accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.a11y ?? o.label}
            android_ripple={{ color: t.colors.surfaceVariant }}
            style={[styles.item, i > 0 && { borderLeftWidth: 1, borderLeftColor: t.colors.outline }, on && { backgroundColor: t.colors.secondaryContainer }]}
          >
            <Icon name={on ? 'check' : o.icon} color={on ? t.colors.onSecondaryContainer : t.colors.onSurface} />
            <Text variant="labelLarge" style={{ color: on ? t.colors.onSecondaryContainer : t.colors.onSurface }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, overflow: 'hidden' },
  item: { flex: 1, minHeight: touch.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
});
