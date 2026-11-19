/**
 * Config de Expo. Flags de build (solo en tu PC, nunca en el repo):
 *   RITMO_LOCAL_HTTP=1  -> APK de pruebas contra el Supabase local (permite HTTP SOLO a loopback/10.0.2.2).
 *   sin el flag         -> release: cleartext desactivado (HTTPS-only) y allowBackup=false.
 */
const localHttp = process.env.RITMO_LOCAL_HTTP === '1';

module.exports = {
  expo: {
    name: 'Ritmo',
    slug: 'ritmo',
    scheme: 'ritmo',
    version: '1.0.0',
    orientation: 'default',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    backgroundColor: '#101417',
    ios: {
      bundleIdentifier: 'dev.ritmo.app',
      supportsTablet: true,
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: 'dev.ritmo.app',
      allowBackup: false,
      adaptiveIcon: {
        backgroundImage: './assets/android-icon-background.png',
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: true,
      blockedPermissions: ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO'],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/favicon.png',
      name: 'Ritmo',
      shortName: 'Ritmo',
      backgroundColor: '#101417',
      themeColor: '#101417',
      description: 'Hábitos y gastos que funcionan sin conexión.',
    },
    plugins: [
      'expo-secure-store',
      'expo-font',
      ['expo-build-properties', { android: { usesCleartextTraffic: false, enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }],
      ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#101417', imageWidth: 160 }],
      ...(localHttp ? ['./plugins/with-local-http'] : []),
    ],
    experiments: { typedRoutes: false },
  },
};
