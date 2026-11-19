import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '../theme/theme';
import { space, touch } from '../theme/tokens';
import { useData } from '../data/store';
import { Icon } from '../components/ui';

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function LoginScreen() {
  const t = useTheme<AppTheme>();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resetPassword } = useData();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ email: false, pw: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const pwRef = useRef<{ focus: () => void } | null>(null);

  const emailErr = touched.email && !emailOk(email) ? 'Escribe un correo válido, por ejemplo ana@correo.com.' : '';
  const pwErr = touched.pw && (mode === 'up' ? !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw) : pw.length < 1)
    ? (mode === 'up' ? 'Usa 8+ caracteres con mayúscula, minúscula y número.' : 'Escribe tu contraseña.') : '';

  const submit = async () => {
    setTouched({ email: true, pw: true });
    if (!emailOk(email) || emailErr || pwErr || !pw) return;
    setBusy(true); setMsg(null);
    const err = mode === 'in' ? await signIn(email, pw) : await signUp(email, pw);
    setBusy(false);
    if (err) setMsg({ text: err, ok: err.startsWith('Te enviamos') });
  };
  const forgot = async () => {
    setTouched((s) => ({ ...s, email: true }));
    if (!emailOk(email)) return;
    setBusy(true);
    const err = await resetPassword(email);
    setBusy(false);
    setMsg(err ? { text: err, ok: false } : { text: 'Si el correo existe, te enviamos un enlace para cambiar la contraseña.', ok: true });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.mark, { backgroundColor: t.colors.primaryContainer }]}>
          <Icon name="pulse" size={32} color={t.colors.onPrimaryContainer} />
        </View>
        <Text variant="headlineMedium" style={{ color: t.colors.onBackground }} accessibilityRole="header">Ritmo</Text>
        <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant }}>
          Hábitos y gastos en un solo lugar. Funciona sin conexión y se sincroniza cuando vuelve la red.
        </Text>

        <View style={styles.form}>
          <TextInput
            label="Correo" mode="outlined" value={email} onChangeText={setEmail}
            onBlur={() => setTouched((s) => ({ ...s, email: true }))}
            inputMode="email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} error={!!emailErr}
          />
          <HelperText type="error" visible={!!emailErr} accessibilityLiveRegion="polite">{emailErr}</HelperText>
          <TextInput
            ref={pwRef as never} label="Contraseña" mode="outlined" value={pw} onChangeText={setPw}
            onBlur={() => setTouched((s) => ({ ...s, pw: true }))}
            secureTextEntry={!show} autoCapitalize="none" autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            textContentType={mode === 'in' ? 'password' : 'newPassword'} returnKeyType="done" onSubmitEditing={submit} error={!!pwErr}
            right={<TextInput.Icon icon={show ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShow((v) => !v)} accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} />}
          />
          <HelperText type="error" visible={!!pwErr} accessibilityLiveRegion="polite">{pwErr}</HelperText>

          {msg ? (
            <View style={[styles.msg, { backgroundColor: msg.ok ? t.colors.secondaryContainer : t.colors.errorContainer }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Icon name={msg.ok ? 'email-check-outline' : 'alert-circle-outline'} color={msg.ok ? t.colors.onSecondaryContainer : t.colors.onErrorContainer} />
              <Text variant="bodyMedium" style={{ flex: 1, color: msg.ok ? t.colors.onSecondaryContainer : t.colors.onErrorContainer }}>{msg.text}</Text>
            </View>
          ) : null}

          <Button mode="contained" onPress={submit} loading={busy} disabled={busy} contentStyle={{ minHeight: touch.min }} testID="login-submit">
            {mode === 'in' ? 'Iniciar sesión' : 'Crear cuenta'}
          </Button>
          <Button mode="text" onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }} contentStyle={{ minHeight: touch.min }}>
            {mode === 'in' ? 'No tengo cuenta: crear una' : 'Ya tengo cuenta: iniciar sesión'}
          </Button>
          {mode === 'in' ? <Button mode="text" onPress={forgot} disabled={busy} contentStyle={{ minHeight: touch.min }}>Olvidé mi contraseña</Button> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  mark: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  form: { marginTop: space.lg, gap: space.xs },
  msg: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: 12, alignItems: 'center', marginBottom: space.sm },
});
