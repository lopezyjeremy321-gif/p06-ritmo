import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '../theme/theme';
import { space, touch } from '../theme/tokens';
import { useData } from '../data/store';
import { addDays, formatMoney, parseAmountToCents, toISODate } from '../data/stats';
import type { EntryKind } from '../data/types';
import { Segmented } from '../components/Segmented';

const CATS: Record<EntryKind, string[]> = {
  gasto: ['Comida', 'Transporte', 'Hogar', 'Ocio', 'Salud', 'Otros'],
  ingreso: ['Sueldo', 'Venta', 'Regalo', 'Otros'],
};

export function EntryEditor({ route, navigation }: { route: { params?: { id?: string } }; navigation: { goBack: () => void } }) {
  const t = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const { cache, saveEntry, deleteEntry } = useData();
  const existing = route.params?.id ? cache.p06_entries.find((e) => e.id === route.params!.id) : undefined;
  const today = toISODate(new Date());
  const [kind, setKind] = useState<EntryKind>(existing?.kind ?? 'gasto');
  const [amount, setAmount] = useState(existing ? (existing.amount_cents / 100).toFixed(2).replace('.', ',') : '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [date, setDate] = useState(existing?.occurred_on ?? today);
  const [touched, setTouched] = useState({ amount: false, category: false, date: false });
  const [confirm, setConfirm] = useState(false);

  const cents = parseAmountToCents(amount);
  const amountErr = touched.amount && cents === null ? 'Escribe un importe mayor que 0, por ejemplo 12,50.' : '';
  const catErr = touched.category && category.trim().length < 1 ? 'Elige o escribe una categoría.' : '';
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && toISODate(new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))) === date;
  const dateErr = touched.date && !dateOk ? 'Usa el formato AAAA-MM-DD, por ejemplo 2026-11-18.' : '';

  const save = () => {
    setTouched({ amount: true, category: true, date: true });
    if (cents === null || category.trim().length < 1 || category.trim().length > 40 || !dateOk) return;
    saveEntry({ id: existing?.id, kind, amount_cents: cents, category, note, occurred_on: date });
    navigation.goBack();
  };

  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
      <Segmented
        value={kind} onChange={(v) => { setKind(v); setCategory(''); }}
        options={[
          { value: 'gasto', label: 'Gasto', icon: 'arrow-top-right', a11y: 'Es un gasto' },
          { value: 'ingreso', label: 'Ingreso', icon: 'arrow-bottom-left', a11y: 'Es un ingreso' },
        ]}
      />
      <TextInput label="Importe" mode="outlined" value={amount} onChangeText={setAmount} onBlur={() => setTouched((s) => ({ ...s, amount: true }))}
        inputMode="decimal" keyboardType="decimal-pad" left={<TextInput.Affix text="$" />} error={!!amountErr} testID="entry-amount" />
      <HelperText type={amountErr ? 'error' : 'info'} visible accessibilityLiveRegion="polite">
        {amountErr || (cents ? `Se guardará ${formatMoney(cents)}` : 'Usa coma o punto para los centavos.')}
      </HelperText>

      <Text variant="titleMedium" style={{ color: t.colors.onSurface }}>Categoría</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {CATS[kind].map((c) => (
          <Pressable key={c} onPress={() => { setCategory(c); setTouched((s) => ({ ...s, category: true })); }} accessibilityRole="radio" accessibilityState={{ selected: category === c }}
            style={[styles.chip, { borderColor: category === c ? t.colors.primary : t.colors.outline, backgroundColor: category === c ? t.colors.primaryContainer : 'transparent' }]}>
            <Text variant="labelLarge" style={{ color: category === c ? t.colors.onPrimaryContainer : t.colors.onSurface }}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput label="Otra categoría" mode="outlined" value={CATS[kind].includes(category) ? '' : category} onChangeText={setCategory} onBlur={() => setTouched((s) => ({ ...s, category: true }))} error={!!catErr} maxLength={40} />
      <HelperText type="error" visible={!!catErr} accessibilityLiveRegion="polite">{catErr}</HelperText>

      <TextInput label="Nota (opcional)" mode="outlined" value={note} onChangeText={setNote} maxLength={200} />

      <Text variant="titleMedium" style={{ color: t.colors.onSurface, marginTop: space.md }}>Fecha</Text>
      <View style={styles.chips}>
        {[['Hoy', today], ['Ayer', addDays(today, -1)], ['Anteayer', addDays(today, -2)]].map(([l, d]) => (
          <Pressable key={l} onPress={() => setDate(d)} accessibilityRole="radio" accessibilityState={{ selected: date === d }}
            style={[styles.chip, { borderColor: date === d ? t.colors.primary : t.colors.outline, backgroundColor: date === d ? t.colors.primaryContainer : 'transparent' }]}>
            <Text variant="labelLarge" style={{ color: date === d ? t.colors.onPrimaryContainer : t.colors.onSurface }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput label="Fecha (AAAA-MM-DD)" mode="outlined" value={date} onChangeText={setDate} onBlur={() => setTouched((s) => ({ ...s, date: true }))} inputMode="numeric" error={!!dateErr} maxLength={10} />
      <HelperText type="error" visible={!!dateErr} accessibilityLiveRegion="polite">{dateErr}</HelperText>

      <Button mode="contained" onPress={save} contentStyle={{ minHeight: touch.min }} style={{ marginTop: space.lg }} testID="entry-save">Guardar movimiento</Button>
      {existing ? <Button mode="outlined" textColor={t.colors.error} onPress={() => setConfirm(true)} contentStyle={{ minHeight: touch.min }} icon="trash-can-outline">Eliminar movimiento</Button> : null}

      <Portal>
        <Dialog visible={confirm} onDismiss={() => setConfirm(false)}>
          <Dialog.Title>¿Eliminar este movimiento?</Dialog.Title>
          <Dialog.Content><Text variant="bodyLarge">{existing ? `${existing.category}, ${formatMoney(existing.amount_cents)}.` : ''} Podrás deshacerlo unos segundos.</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(false)} contentStyle={{ minHeight: touch.min }}>Conservar</Button>
            <Button textColor={t.colors.error} onPress={() => { setConfirm(false); if (existing) deleteEntry(existing.id); navigation.goBack(); }} contentStyle={{ minHeight: touch.min }}>Eliminar movimiento</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: touch.min, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
});
