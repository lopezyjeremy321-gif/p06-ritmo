/**
 * Tokens en 3 capas. SOLO este archivo contiene valores crudos (hex).
 *   1. primitivos  -> la paleta de marca "Ritmo" (ambar + pizarra + verde/rojo semanticos)
 *   2. semanticos  -> roles Material 3 (claro y oscuro compuestos por separado)
 *   3. componente  -> medidas y roles por componente
 */

// ---------------------------------------------------------------- 1. primitivos
const palette = {
  amber: { 20: '#4A2800', 30: '#6A3B00', 40: '#8A4B00', 80: '#FFB95C', 90: '#FFDDB8', 95: '#FFEEDC' },
  slate: { 10: '#101417', 20: '#1B2024', 25: '#222A2E', 30: '#2E373C', 40: '#4A555B', 60: '#7F8B92', 80: '#C0C8CD', 90: '#DCE3E7', 95: '#EDF1F3', 98: '#F6F8F9' },
  teal: { 30: '#1F4F58', 40: '#2C6772', 80: '#9ED2DC', 90: '#C4EAF1' },
  green: { 30: '#0E5A33', 40: '#14703F', 80: '#7FDCA2', 90: '#BDF2D1' },
  red: { 30: '#8C1D18', 40: '#B3261E', 80: '#FFB4AB', 90: '#FFDAD6' },
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ---------------------------------------------------------------- 2. semanticos
export interface ColorRoles {
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  secondary: string; onSecondary: string; secondaryContainer: string; onSecondaryContainer: string;
  tertiary: string; onTertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  error: string; onError: string; errorContainer: string; onErrorContainer: string;
  background: string; onBackground: string; surface: string; onSurface: string;
  surfaceVariant: string; onSurfaceVariant: string; outline: string; outlineVariant: string;
  shadow: string; scrim: string; inverseSurface: string; inverseOnSurface: string; inversePrimary: string;
  surfaceDisabled: string; onSurfaceDisabled: string; backdrop: string;
  elevation: { level0: string; level1: string; level2: string; level3: string; level4: string; level5: string };
  // extensiones de marca (ingreso/gasto siempre con icono + signo, no solo color)
  income: string; onIncome: string; incomeContainer: string; onIncomeContainer: string;
  expense: string; onExpense: string; expenseContainer: string; onExpenseContainer: string;
  chartBar: string; chartBarAlt: string; chartGrid: string;
}

export const lightRoles: ColorRoles = {
  primary: palette.amber[40], onPrimary: palette.white, primaryContainer: palette.amber[90], onPrimaryContainer: palette.amber[20],
  secondary: palette.teal[40], onSecondary: palette.white, secondaryContainer: palette.teal[90], onSecondaryContainer: palette.teal[30],
  tertiary: palette.slate[40], onTertiary: palette.white, tertiaryContainer: palette.slate[90], onTertiaryContainer: palette.slate[10],
  error: palette.red[40], onError: palette.white, errorContainer: palette.red[90], onErrorContainer: palette.red[30],
  background: palette.slate[98], onBackground: palette.slate[10], surface: palette.slate[98], onSurface: palette.slate[10],
  surfaceVariant: palette.slate[90], onSurfaceVariant: palette.slate[40], outline: palette.slate[60], outlineVariant: palette.slate[80],
  shadow: palette.black, scrim: palette.black, inverseSurface: palette.slate[20], inverseOnSurface: palette.slate[95], inversePrimary: palette.amber[80],
  surfaceDisabled: 'rgba(16, 20, 23, 0.12)', onSurfaceDisabled: 'rgba(16, 20, 23, 0.38)', backdrop: 'rgba(46, 55, 60, 0.4)',
  elevation: { level0: 'transparent', level1: '#F0F3F5', level2: '#EAEEF1', level3: '#E4E9EC', level4: '#E2E7EA', level5: '#DEE4E7' },
  income: palette.green[40], onIncome: palette.white, incomeContainer: palette.green[90], onIncomeContainer: palette.green[30],
  expense: palette.red[40], onExpense: palette.white, expenseContainer: palette.red[90], onExpenseContainer: palette.red[30],
  chartBar: palette.amber[40], chartBarAlt: palette.teal[40], chartGrid: palette.slate[80],
};

export const darkRoles: ColorRoles = {
  primary: palette.amber[80], onPrimary: palette.amber[20], primaryContainer: palette.amber[30], onPrimaryContainer: palette.amber[90],
  secondary: palette.teal[80], onSecondary: palette.teal[30], secondaryContainer: palette.teal[30], onSecondaryContainer: palette.teal[90],
  tertiary: palette.slate[80], onTertiary: palette.slate[20], tertiaryContainer: palette.slate[30], onTertiaryContainer: palette.slate[90],
  error: palette.red[80], onError: palette.red[30], errorContainer: palette.red[30], onErrorContainer: palette.red[90],
  background: palette.slate[10], onBackground: palette.slate[90], surface: palette.slate[10], onSurface: palette.slate[90],
  surfaceVariant: palette.slate[30], onSurfaceVariant: palette.slate[80], outline: palette.slate[60], outlineVariant: palette.slate[40],
  shadow: palette.black, scrim: palette.black, inverseSurface: palette.slate[90], inverseOnSurface: palette.slate[20], inversePrimary: palette.amber[40],
  surfaceDisabled: 'rgba(220, 227, 231, 0.12)', onSurfaceDisabled: 'rgba(220, 227, 231, 0.38)', backdrop: 'rgba(0, 0, 0, 0.5)',
  elevation: { level0: 'transparent', level1: '#171C20', level2: '#1B2125', level3: '#1F262A', level4: '#212A2E', level5: '#242D32' },
  income: palette.green[80], onIncome: palette.green[30], incomeContainer: palette.green[30], onIncomeContainer: palette.green[90],
  expense: palette.red[80], onExpense: palette.red[30], expenseContainer: palette.red[30], onExpenseContainer: palette.red[90],
  chartBar: palette.amber[80], chartBarAlt: palette.teal[80], chartGrid: palette.slate[40],
};

// ---------------------------------------------------------------- 3. componente
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const; // multiplos de 4
export const radius = { sm: 8, md: 12, pill: 999 } as const;
export const iconSize = { sm: 20, md: 24, lg: 32 } as const;
export const touch = { min: 48 } as const; // dp, Material
export const component = {
  listRow: { minHeight: 64, paddingH: space.lg, gap: space.md },
  card: { radius: radius.md, padding: space.lg },
  fab: { size: 56 },
  chart: { height: 180, barRadius: 6, barGap: 10 },
  syncBanner: { minHeight: 40 },
} as const;
