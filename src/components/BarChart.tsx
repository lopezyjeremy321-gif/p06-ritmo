import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';
import { component, space } from '../theme/tokens';

export interface Bar { key: string; label: string; value: number; shown: string; isToday?: boolean }

/**
 * Grafico de barras con etiquetas directas (valor sobre cada barra) hecho con Views y Text de RN,
 * asi el texto escala con sp y no depende del color. El resumen/tabla alternativa la da quien lo usa.
 */
export function BarChart({ bars, color, summary }: { bars: Bar[]; color: string; summary: string }) {
  const t = useTheme<AppTheme>();
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} testID="bar-chart">
      <View style={styles.row}>
        {bars.map((b) => {
          const h = b.value > 0 ? Math.max(6, Math.round((b.value / max) * component.chart.height)) : 2;
          return (
            <View key={b.key} style={styles.col} importantForAccessibility="no-hide-descendants">
              <Text variant="labelSmall" style={{ color: t.colors.onSurface }} numberOfLines={1}>{b.shown}</Text>
              <View style={[styles.track, { height: component.chart.height }]}>
                <View style={{ height: h, backgroundColor: b.value > 0 ? color : t.colors.chartGrid, borderTopLeftRadius: component.chart.barRadius, borderTopRightRadius: component.chart.barRadius }} />
              </View>
              <Text variant="labelSmall" style={{ color: b.isToday ? t.colors.onSurface : t.colors.onSurfaceVariant, textDecorationLine: b.isToday ? 'underline' : 'none' }}>
                {b.isToday ? 'hoy' : b.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: component.chart.barGap / 2 },
  col: { flex: 1, alignItems: 'center', gap: space.xs },
  track: { width: '70%', justifyContent: 'flex-end' },
});
