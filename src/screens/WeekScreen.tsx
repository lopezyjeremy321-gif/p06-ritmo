import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';
import { radius, space } from '../theme/tokens';
import { useData } from '../data/store';
import { chartSummary, formatMoney, toISODate, weeklyStats } from '../data/stats';
import { BarChart, type Bar } from '../components/BarChart';
import { EmptyState, SyncBanner } from '../components/ui';
import { Segmented } from '../components/Segmented';

const compact = (cents: number) => {
  const u = cents / 100;
  if (cents === 0) return '0';
  if (u >= 1_000_000) return `${(u / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (u >= 1000) return `${(u / 1000).toFixed(1).replace('.', ',')}k`;
  return String(Math.round(u));
};

export function WeekScreen({ navigation }: { navigation: { navigate: (n: string) => void } }) {
  const t = useTheme<AppTheme>();
  const { cache } = useData();
  const [view, setView] = useState<'grafico' | 'tabla'>('grafico');
  const today = toISODate(new Date());
  const stats = useMemo(() => weeklyStats(today, cache.p06_entries, cache.p06_habit_logs, cache.p06_habits), [today, cache]);
  const empty = stats.every((d) => d.expenseCents === 0 && d.incomeCents === 0 && d.habitsDone === 0);
  const totalExp = stats.reduce((s, d) => s + d.expenseCents, 0);
  const totalInc = stats.reduce((s, d) => s + d.incomeCents, 0);
  const totalHabits = stats.reduce((s, d) => s + d.habitsDone, 0);

  const expenseBars: Bar[] = stats.map((d) => ({ key: d.date, label: d.label, value: d.expenseCents, shown: compact(d.expenseCents), isToday: d.date === today }));
  const habitBars: Bar[] = stats.map((d) => ({ key: d.date, label: d.label, value: d.habitsDone, shown: String(d.habitsDone), isToday: d.date === today }));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <SyncBanner />
      {empty ? (
        <EmptyState icon="chart-box-outline" title="Tu semana está en blanco" body="Marca un hábito o registra un gasto y aquí verás cómo va tu semana." cta="Registrar movimiento" onCta={() => navigation.navigate('EntryEditor')} />
      ) : (
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text variant="headlineSmall" style={{ color: t.colors.onBackground }} accessibilityRole="header">Resumen de 7 días</Text>
          <Segmented
            value={view} onChange={setView}
            options={[
              { value: 'grafico', label: 'Gráfico', icon: 'chart-bar', a11y: 'Ver como gráfico' },
              { value: 'tabla', label: 'Tabla', icon: 'table', a11y: 'Ver como tabla' },
            ]}
          />

          {view === 'grafico' ? (
            <>
              <View style={[styles.card, { backgroundColor: t.colors.elevation.level1 }]}>
                <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Gasto por día</Text>
                <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>Total {formatMoney(totalExp)} · ingresos {formatMoney(totalInc)}</Text>
                <BarChart bars={expenseBars} color={t.colors.chartBar} summary={chartSummary(stats)} />
              </View>
              <View style={[styles.card, { backgroundColor: t.colors.elevation.level1 }]}>
                <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Hábitos hechos por día</Text>
                <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>{totalHabits} marcas en 7 días</Text>
                <BarChart bars={habitBars} color={t.colors.chartBarAlt} summary={`${totalHabits} hábitos marcados en los últimos 7 días.`} />
              </View>
            </>
          ) : (
            <View style={[styles.card, { backgroundColor: t.colors.elevation.level1 }]} accessibilityRole="summary" testID="week-table">
              <View style={styles.tr}>
                <Text variant="labelMedium" style={[styles.cDay, { color: t.colors.onSurfaceVariant }]}>Día</Text>
                <Text variant="labelMedium" style={[styles.cNum, { color: t.colors.onSurfaceVariant }]}>Gastos</Text>
                <Text variant="labelMedium" style={[styles.cNum, { color: t.colors.onSurfaceVariant }]}>Ingresos</Text>
                <Text variant="labelMedium" style={[styles.cHab, { color: t.colors.onSurfaceVariant }]}>Hábitos</Text>
              </View>
              {stats.map((d) => (
                <View key={d.date} style={[styles.tr, { borderTopColor: t.colors.outlineVariant, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text variant="bodyMedium" style={[styles.cDay, { color: t.colors.onSurface }]}>{d.date === today ? 'hoy' : d.label}</Text>
                  <Text variant="bodyMedium" style={[styles.cNum, { color: t.colors.onSurface }]}>{formatMoney(d.expenseCents)}</Text>
                  <Text variant="bodyMedium" style={[styles.cNum, { color: t.colors.onSurface }]}>{formatMoney(d.incomeCents)}</Text>
                  <Text variant="bodyMedium" style={[styles.cHab, { color: t.colors.onSurface }]}>{d.habitsDone}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.lg },
  card: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  tr: { flexDirection: 'row', paddingVertical: space.sm, gap: space.xs, alignItems: 'center' },
  cDay: { width: 44 },
  cNum: { flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  cHab: { width: 56, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
