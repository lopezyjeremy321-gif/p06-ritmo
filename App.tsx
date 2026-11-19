import React, { useEffect } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Appbar, BottomNavigation, PaperProvider, Snackbar, Text, ActivityIndicator } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, CommonActions, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemePrefProvider, useThemePref } from './src/theme/ThemePref';
import { DataProvider, useData } from './src/data/store';
import { configError } from './src/lib/env';
import { space } from './src/theme/tokens';
import { Icon } from './src/components/ui';
import { LoginScreen } from './src/screens/LoginScreen';
import { HabitsScreen } from './src/screens/HabitsScreen';
import { EntriesScreen } from './src/screens/EntriesScreen';
import { WeekScreen } from './src/screens/WeekScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HabitEditor } from './src/screens/HabitEditor';
import { EntryEditor } from './src/screens/EntryEditor';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type TabIcon = { on: React.ComponentProps<typeof MaterialCommunityIcons>['name']; off: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };
const TAB_ICONS: Record<string, TabIcon> = {
  Habitos: { on: 'check-circle', off: 'check-circle-outline' },
  Gastos: { on: 'wallet', off: 'wallet-outline' },
  Semana: { on: 'chart-box', off: 'chart-box-outline' },
  Ajustes: { on: 'cog', off: 'cog-outline' },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        header: ({ options }) => (
          <Appbar.Header mode="small" elevated={false}>
            <Appbar.Content title={String(options.title ?? '')} accessibilityRole="header" />
          </Appbar.Header>
        ),
      }}
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state} safeAreaInsets={insets}
          onTabPress={({ route, preventDefault }) => {
            const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (ev.defaultPrevented) preventDefault();
            else navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });
          }}
          renderIcon={({ route, focused, color }) => <MaterialCommunityIcons name={focused ? TAB_ICONS[route.name].on : TAB_ICONS[route.name].off} size={24} color={color} />}
          getLabelText={({ route }) => String(descriptors[route.key].options.tabBarLabel ?? descriptors[route.key].options.title)}
          getAccessibilityLabel={({ route }) => `Ir a ${descriptors[route.key].options.title}`}
        />
      )}
    >
      <Tab.Screen name="Habitos" component={HabitsScreen as never} options={{ title: 'Hábitos' }} />
      <Tab.Screen name="Gastos" component={EntriesScreen as never} options={{ title: 'Gastos' }} />
      <Tab.Screen name="Semana" component={WeekScreen as never} options={{ title: 'Semana' }} />
      <Tab.Screen name="Ajustes" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

function Shell() {
  const { user, ready, notice, dismissNotice, handleLink } = useData();
  const { theme, isDark } = useThemePref();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => { void handleLink(url); });
    void Linking.getInitialURL().then((u) => { if (u) void handleLink(u); });
    return () => sub.remove();
  }, [handleLink]);

  const navTheme = { ...(isDark ? DarkTheme : DefaultTheme), colors: { ...(isDark ? DarkTheme : DefaultTheme).colors, background: theme.colors.background, card: theme.colors.surface, text: theme.colors.onSurface, primary: theme.colors.primary, border: theme.colors.outlineVariant } };

  if (!ready) {
    return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator size="large" accessibilityLabel="Cargando" /></View>;
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles.column}>
      {!user ? <LoginScreen /> : (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              header: ({ options, navigation, back }) => (
                <Appbar.Header mode="small" elevated={false}>
                  {back ? <Appbar.BackAction onPress={navigation.goBack} accessibilityLabel="Volver" /> : null}
                  <Appbar.Content title={String(options.title ?? '')} accessibilityRole="header" />
                </Appbar.Header>
              ),
            }}
          >
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="HabitEditor" component={HabitEditor as never} options={({ route }) => ({ title: (route.params as { id?: string } | undefined)?.id ? 'Editar hábito' : 'Nuevo hábito' })} />
            <Stack.Screen name="EntryEditor" component={EntryEditor as never} options={({ route }) => ({ title: (route.params as { id?: string } | undefined)?.id ? 'Editar movimiento' : 'Nuevo movimiento' })} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
      </View>
      <Snackbar
        visible={!!notice} onDismiss={dismissNotice} duration={6000}
        style={{ marginBottom: user ? insets.bottom + 72 : insets.bottom }}
        action={notice?.undo ? { label: 'Deshacer', onPress: () => { notice.undo?.(); } } : { label: 'Cerrar', onPress: dismissNotice }}
      >
        {notice?.text ?? ''}
      </Snackbar>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

function ConfigMissing({ message }: { message: string }) {
  const { theme } = useThemePref();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background, padding: space.xl, gap: space.md }]} accessibilityRole="alert">
      <Icon name="cog-off-outline" size={32} color={theme.colors.error} decorative={false} />
      <Text variant="titleLarge" style={{ color: theme.colors.onBackground, textAlign: 'center' }}>Falta configurar Supabase</Text>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>{message}. Copia .env.example a .env, completa la URL y la clave pública y vuelve a compilar.</Text>
    </View>
  );
}

function Root() {
  const { theme } = useThemePref();
  const [fontsLoaded] = useFonts({
    'Manrope-Regular': require('./assets/fonts/Manrope-Regular.ttf'),
    'Manrope-SemiBold': require('./assets/fonts/Manrope-SemiBold.ttf'),
    'Bricolage-Bold': require('./assets/fonts/Bricolage-Bold.ttf'),
    ...MaterialCommunityIcons.font,
  });
  const cfgErr = configError();
  if (!fontsLoaded) return null;
  return (
    <PaperProvider theme={theme}>
      {cfgErr ? <ConfigMissing message={cfgErr} /> : <DataProvider><Shell /></DataProvider>}
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemePrefProvider><Root /></ThemePrefProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ column: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
void Platform;
