export const VitalisColors = {
  canvas: '#F8F6F0',
  background: '#F8F6F0',
  canvasDeep: '#F2EFE7',
  ink: '#141413',
  text: '#141413',
  bodyStrong: '#252523',
  muted: '#5F5B54',
  mutedSoft: '#6E6961',
  surface: '#FFFDF8',
  surfaceRaised: '#FFFEFA',
  surfaceSoft: '#F1EEE6',
  surfaceAlt: '#F1EEE6',
  surfaceCard: '#EBE6DC',
  surfaceDark: '#11191F',
  surfaceDarkElevated: '#17252D',
  surfaceDarkSoft: '#20313B',
  onDark: '#F8F6F0',
  onDarkMuted: '#C4CDD2',
  border: '#E3DDD2',
  borderStrong: '#D4CCB8',
  borderDark: '#2A414E',
  primary: '#1565D8',
  primaryStrong: '#0D4FB0',
  primaryHover: '#125BC4',
  primaryPressed: '#0D4A9F',
  primaryText: '#0D4FB0',
  primarySoft: '#D9E9FF',
  primaryMist: '#EEF5FF',
  success: '#1F9D67',
  successSoft: '#DFF5EA',
  warning: '#FFF3D6',
  warningStrong: '#B26A00',
  warningBorder: '#EBCB88',
  warningText: '#7A4700',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  shadow: 'rgba(17, 25, 31, 0.12)',
  shadowSoft: 'rgba(17, 25, 31, 0.07)',
  focusRing: 'rgba(21, 101, 216, 0.16)',
  frame: '#11191F',
  borderSubtle: '#E3DDD2',
  borderStrongSemantic: '#C9C0AE',
  textPrimary: '#141413',
  textSecondary: '#5F5B54',
  textMuted: '#6E6961',
  surfaceElevated: '#FFFEFA',
  surfaceInverse: '#11191F',
} as const;

export const VitalisFonts = {
  display: 'CormorantGaramond_600SemiBold',
  displayMedium: 'CormorantGaramond_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  logo: 'Sora_700Bold',
} as const;

export const VitalisSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
  display: 40,
  xxl: 48,
  xxxl: 64,
} as const;

export const VitalisRadius = {
  sm: 8,
  md: 12,
  lg: 18,
  card: 18,
  xl: 24,
  xxl: 24,
  pill: 999,
} as const;

export const VitalisMotion = {
  quick: 140,
  standard: 220,
  deliberate: 320,
} as const;

export const VitalisType = {
  display: { fontFamily: VitalisFonts.display, fontSize: 40, lineHeight: 43 },
  screenTitle: { fontFamily: VitalisFonts.display, fontSize: 36, lineHeight: 40 },
  sectionTitle: { fontFamily: VitalisFonts.bodySemiBold, fontSize: 20, lineHeight: 26 },
  cardTitle: { fontFamily: VitalisFonts.bodySemiBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: VitalisFonts.body, fontSize: 16, lineHeight: 24 },
  bodyCompact: { fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: VitalisFonts.bodySemiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  metric: { fontFamily: VitalisFonts.bodyBold, fontVariant: ['tabular-nums'] as const },
} as const;

export const VitalisElevation = {
  control: '0 1px 3px rgba(17,25,31,0.08)',
  subtle: '0 3px 14px rgba(17,25,31,0.06)',
  floating: '0 16px 38px rgba(17,25,31,0.12)',
  focus: '0 0 0 4px rgba(21,101,216,0.14)',
} as const;

export const MedicationColors = {
  blue: { solid: '#1565D8', soft: '#D9E9FF' },
  mint: { solid: '#1F9D67', soft: '#DFF5EA' },
  amber: { solid: '#B26A00', soft: '#FFF3D6' },
  coral: { solid: '#C4513F', soft: '#FBE4DE' },
  violet: { solid: '#7656B7', soft: '#ECE5FA' },
} as const;

export type MedicationColorToken = keyof typeof MedicationColors;
