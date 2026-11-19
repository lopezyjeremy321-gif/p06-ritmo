import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { FAB, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';
import { space, touch } from '../theme/tokens';
import { useData } from '../data/store';
import { streak, toISODate, weekCount } from '../data/stats';
import type { Habit } from '../data/types';
import { EmptyState, ErrorState, Icon, Row, SkeletonRows, SyncBanner, type IconName } from '../components/ui';

export function HabitsScreen({ navigation }: { navigation: { navigate: (n: string, p?: object) => void } }) {
  const t = useTheme<AppTheme>();
  const { cache, ready, sync, lastSyncAt, toggleLog, syncNow } = useData();
  const today = toISODate(new Date());
  const habits = useMemo(() => cache.p06_habits.filter((h) => !h.archived).sort((a, b) => a.name.localeCompare(b.name, 'es')), [cache.p06_habits]);
  const doneToday = habits.filter((h) => cache.p06_habit_logs.some((l) => l.habit_id === h.id && l.log_date === today)).length;
  const loading = !ready || (sync === 'syncing' && !lastSyncAt && habits.length === 0);
  const failed = sync === 'error' && habits.length === 0;

  const renderItem = ({ item }: { item: Habit }) => {
    const done = cache.p06_habit_logs.some((l) => l.habit_id === item.id && l.log_date === today);
    const week = weekCount(today, item.id, cache.p06_habit_logs);
    const s = streak(today, item.id, cache.p06_habit_logs);
    return (
      <Row onPress={() => navigation.navigate('HabitEditor', { id: item.id })} label={`Editar hábito ${item.name}`}>
        <View style={[styles.avatar, { backgroundColor: t.colors.primaryContainer }]}>
          <Icon name={item.icon as IconName} color={t.colors.onPrimaryContainer} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleMedium" style={{ color: t.colors.onSurface }} numberOfLines={2}>{item.name}</Text>
          <Text variant="bodySmall" style={{ color: t.colors.onSurfaceVariant }}>
            {week} de {item.weekly_target} esta semana{s > 1 ? ` · racha de ${s} días` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => toggleLog(item.id, today)}
          accessibilityRole="checkbox" accessibilityState={{ checked: done }}
          accessibilityLabel={`${item.name}: ${done ? 'hecho hoy' : 'marcar como hecho hoy'}`}
          android_ripple={{ color: t.colors.primaryContainer, radius: 28 }}
          style={styles.check} hitSlop={4} testID={`toggle-${item.id}`}
        >
          <Icon name={done ? 'check-circle' : 'circle-outline'} size={32} color={done ? t.colors.primary : t.colors.outline} decorative />
        </Pressable>
      </Row>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <SyncBanner />
      {loading ? <SkeletonRows /> : failed ? (
        <ErrorState title="No pudimos traer tus hábitos" body="Revisa tu conexión. Lo que crees ahora se guarda en el teléfono y se enviará luego." onRetry={syncNow} />
      ) : habits.length === 0 ? (
        <EmptyState icon="sprout-outline" title="Aún no hay hábitos" body="Crea el primero: algo pequeño que quieras repetir cada día, como beber agua o caminar 20 minutos." cta="Crear hábito" onCta={() => navigation.navigate('HabitEditor')} />
      ) : (
        <FlatList
          data={habits} keyExtractor={(h) => h.id} renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.head} accessibilityLiveRegion="polite">
              <Text variant="headlineSmall" style={{ color: t.colors.onBackground }}>Hoy</Text>
              <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant }}>{doneToday} de {habits.length} hábitos hechos</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}
      {habits.length > 0 ? <FAB icon="plus" label="Hábito" style={styles.fab} onPress={() => navigation.navigate('HabitEditor')} accessibilityLabel="Crear hábito" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  check: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  fab: { position: 'absolute', right: space.lg, bottom: space.lg },
});
