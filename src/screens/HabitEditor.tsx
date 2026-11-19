import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '../theme/theme';
import { space, touch } from '../theme/tokens';
import { useData } from '../data/store';
import { Icon, type IconName } from '../components/ui';
import { Pressable } from 'react-native';

const ICONS: { name: IconName; label: string }[] = [
  { name: 'water-outline', label: 'Agua' }, { name: 'walk', label: 'Caminar' }, { name: 'book-open-variant', label: 'Leer' },
  { name: 'meditation', label: 'Meditar' }, { name: 'dumbbell', label: 'Ejercicio' }, { name: 'sleep', label: 'Dormir' },
  { name: 'food-apple-outline', label: 'Comer bien' }, { name: 'check-circle', label: 'General' },
];

export function HabitEditor({ route, navigation }: { route: { params?: { id?: string } }; navigation: { goBack: () => void } }) {
  const t = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const { cache, saveHabit, deleteHabit } = useData();
  const existing = route.params?.id ? cache.p06_habits.find((h) => h.id === route.params!.id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<string>(existing?.icon ?? 'check-circle');
  const [target, setTarget] = useState(existing?.weekly_target ?? 7);
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const nameErr = touched && (name.trim().length < 1 ? 'Escribe un nombre para el hábito.' : name.trim().length > 60 ? 'Máximo 60 caracteres.' : '');

  const save = () => {
    setTouched(true);
    if (name.trim().length < 1 || name.trim().length > 60) return;
    saveHabit({ id: existing?.id, name, icon, weekly_target: target });
    navigation.goBack();
  };

  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
      <TextInput label="Nombre del hábito" mode="outlined" value={name} onChangeText={setName} onBlur={() => setTouched(true)} error={!!nameErr} maxLength={80} autoCapitalize="sentences" testID="habit-name" />
      <HelperText type="error" visible={!!nameErr} accessibilityLiveRegion="polite">{nameErr}</HelperText>

      <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Veces por semana</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Pressable key={n} onPress={() => setTarget(n)} accessibilityRole="radio" accessibilityState={{ selected: target === n }} accessibilityLabel={`${n} ${n === 1 ? 'vez' : 'veces'} por semana`}
            style={[styles.chip, { borderColor: target === n ? t.colors.primary : t.colors.outline, backgroundColor: target === n ? t.colors.primaryContainer : 'transparent' }]}>
            <Text variant="labelLarge" style={{ color: target === n ? t.colors.onPrimaryContainer : t.colors.onSurface }}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="titleMedium" style={{ color: t.colors.onSurface, marginTop: space.md }}>Icono</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {ICONS.map((i) => (
          <Pressable key={i.name} onPress={() => setIcon(i.name)} accessibilityRole="radio" accessibilityState={{ selected: icon === i.name }} accessibilityLabel={i.label}
            style={[styles.chip, { borderColor: icon === i.name ? t.colors.primary : t.colors.outline, backgroundColor: icon === i.name ? t.colors.primaryContainer : 'transparent' }]}>
            <Icon name={i.name} color={icon === i.name ? t.colors.onPrimaryContainer : t.colors.onSurfaceVariant} />
          </Pressable>
        ))}
      </View>

      <Button mode="contained" onPress={save} contentStyle={{ minHeight: touch.min }} style={{ marginTop: space.xl }} testID="habit-save">Guardar hábito</Button>
      {existing ? (
        <Button mode="outlined" textColor={t.colors.error} onPress={() => setConfirm(true)} contentStyle={{ minHeight: touch.min }} icon="trash-can-outline">Eliminar hábito</Button>
      ) : null}

      <Portal>
        <Dialog visible={confirm} onDismiss={() => setConfirm(false)}>
          <Dialog.Title>¿Eliminar este hábito?</Dialog.Title>
          <Dialog.Content><Text variant="bodyLarge">Se borran también sus registros. Podrás deshacerlo unos segundos.</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(false)} contentStyle={{ minHeight: touch.min }}>Conservar</Button>
            <Button textColor={t.colors.error} onPress={() => { setConfirm(false); if (existing) deleteHabit(existing.id); navigation.goBack(); }} contentStyle={{ minHeight: touch.min }}>Eliminar hábito</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minWidth: touch.min, height: touch.min, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
