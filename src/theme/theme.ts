import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';
import { darkRoles, lightRoles, type ColorRoles } from './tokens';

export const FONT = { body: 'Manrope-Regular', label: 'Manrope-SemiBold', display: 'Bricolage-Bold' } as const;

// Escala Material 3 por roles. Tamanos en dp que Android escala con sp (font scale del sistema); piso de cuerpo = 16.
const fonts = configureFonts({
  config: {
    displayLarge: { fontFamily: FONT.display, fontWeight: '400' },
    displayMedium: { fontFamily: FONT.display, fontWeight: '400' },
    displaySmall: { fontFamily: FONT.display, fontWeight: '400' },
    headlineLarge: { fontFamily: FONT.display, fontWeight: '400' },
    headlineMedium: { fontFamily: FONT.display, fontWeight: '400' },
    headlineSmall: { fontFamily: FONT.display, fontWeight: '400' },
    titleLarge: { fontFamily: FONT.display, fontWeight: '400' },
    titleMedium: { fontFamily: FONT.label, fontWeight: '400' },
    titleSmall: { fontFamily: FONT.label, fontWeight: '400' },
    labelLarge: { fontFamily: FONT.label, fontWeight: '400', fontSize: 16, lineHeight: 22 },
    labelMedium: { fontFamily: FONT.label, fontWeight: '400', fontSize: 14, lineHeight: 20 },
    labelSmall: { fontFamily: FONT.label, fontWeight: '400', fontSize: 12, lineHeight: 16 },
    bodyLarge: { fontFamily: FONT.body, fontWeight: '400', fontSize: 16, lineHeight: 24 },
    bodyMedium: { fontFamily: FONT.body, fontWeight: '400', fontSize: 16, lineHeight: 22 },
    bodySmall: { fontFamily: FONT.body, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  },
});

export type AppTheme = MD3Theme & { colors: MD3Theme['colors'] & Pick<ColorRoles,
  'income' | 'onIncome' | 'incomeContainer' | 'onIncomeContainer' | 'expense' | 'onExpense' | 'expenseContainer' | 'onExpenseContainer' | 'chartBar' | 'chartBarAlt' | 'chartGrid'> };

const make = (base: MD3Theme, roles: ColorRoles, dark: boolean): AppTheme => ({
  ...base,
  dark,
  roundness: 3, // MD3 usa multiplos de 4: 12dp en contenedores
  fonts,
  colors: { ...base.colors, ...roles },
}) as AppTheme;

export const lightTheme = make(MD3LightTheme, lightRoles, false);
export const darkTheme = make(MD3DarkTheme, darkRoles, true);
