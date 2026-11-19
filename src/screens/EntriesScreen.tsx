import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';
import { space } from '../theme/tokens';
import { useData } from '../data/store';
import { formatMoney, toISODate, last7, shortDate } from '../data/stats';
import type { Entry } from '../data/types';
import { EmptyState, ErrorState, Icon, Row, SkeletonRows, SyncBanner } from '../components/ui';

export function EntriesScreen({ navigation }: { navigation: { navigate: (n: string, p?: object) => void } }) {
  const t = useTheme<AppTheme>();
  const { cache, ready, sync, lastSyncAt, syncNow } = useData();
  const entries = useMemo(
    () => [...cache.p06_entries].sort((a, b) => (b.occurred_on === a.occurred_on ? b.updated_at.localeCompare(a.updated_at) : b.occurred_on.localeCompare(a.occurred_on))),
    [cache.p06_entries],
  );
  const week = useMemo(() => {
    const days = new Set(last7(toISODate(new Date())));
    const inWeek = entries.filter((e) => days.has(e.occurred_on));
    const exp = inWeek.filter((e) => e.kind === 'gasto').reduce((s, e) => s + e.amount_cents, 0);
    const inc = inWeek.filter((e) => e.kind === 'ingreso').reduce((s, e) => s + e.amount_cents, 0);
    return { exp, inc };
  }, [entries]);
  const loading = !ready || (sync === 'syncing' && !lastSyncAt && entries.length === 0);
  const failed = sync === 'error' && entries.length === 0;

  const renderItem = ({ item }: { item: Entry }) => {
    const inc = item.kind === 'ingreso';
    const fg = inc ? t.colors.onIncomeContainer : t.colors.onExpenseContainer;
    return (
      <Row onPress={() => navigation.navigate('EntryEditor', { id: item.id })} label={`Editar ${item.kind}: ${item.category}, ${formatMoney(item.amount_cents)}`}>
        <View style={[styles.avatar, { backgroundColor: inc ? t.colors.incomeContainer : t.colors.expenseContainer }]}>
          <Icon name={inc ? 'arrow-bottom-left' : 'arrow-top-right'} color={fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleMedium" style={{ color: t.colors.onSurface }} numberOfLines={2}>{item.category}</Text>
          <Text variant="bodySmall" style={{ color: t.colors.onSurfaceVariant }} numberOfLines={2}>
            {shortDate(item.occurred_on)}{item.note ? ` · ${item.note}` : ''}
          </Text>
        </View>
        <Text variant="titleMedium" style={{ color: inc ? t.colors.income : t.colors.expense, fontVariant: ['tabular-nums'], flexShrink: 0 }} accessibilityLabel={`${inc ? 'Ingreso' : 'Gasto'} de ${formatMoney(item.amount_cents)}`}>
          {inc ? '+' : '−'} {formatMoney(item.amount_cents)}
        </Text>
      </Row>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <SyncBanner />
      {loading ? <SkeletonRows /> : failed ? (
        <ErrorState title="No pudimos traer tus movimientos" body="Revisa tu conexión. Lo que registres ahora se guarda en el teléfono y se enviará luego." onRetry={syncNow} />
      ) : entries.length === 0 ? (
        <EmptyState icon="wallet-outline" title="Aún no hay movimientos" body="Registra tu primer gasto o ingreso y verás aquí cuánto llevas en la semana." cta="Registrar movimiento" onCta={() => navigation.navigate('EntryEditor')} />
      ) : (
        <FlatList
          data={entries} keyExtractor={(e) => e.id} renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.head}>
              <Text variant="headlineSmall" style={{ color: t.colors.onBackground }}>Últimos 7 días</Text>
              <View style={styles.totals}>
                <View style={styles.total}>
                  <Icon name="arrow-top-right" color={t.colors.expense} />
                  <Text variant="bodyLarge" style={{ color: t.colors.onSurface }}>Gastos {formatMoney(week.exp)}</Text>
                </View>
                <View style={styles.total}>
                  <Icon name="arrow-bottom-left" color={t.colors.income} />
                  <Text variant="bodyLarge" style={{ color: t.colors.onSurface }}>Ingresos {formatMoney(week.inc)}</Text>
                </View>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}
      {entries.length > 0 ? <FAB icon="plus" label="Movimiento" style={styles.fab} onPress={() => navigation.navigate('EntryEditor')} accessibilityLabel="Registrar movimiento" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  totals: { gap: space.xs },
  total: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: space.lg, bottom: space.lg },
});
