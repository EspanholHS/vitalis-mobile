import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type PressableProps,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  MedicationColors,
  type MedicationColorToken,
  VitalisColors,
  VitalisElevation,
  VitalisFonts,
  VitalisMotion,
  VitalisRadius,
  VitalisSpacing,
} from '@/constants/vitalis-theme';

type ScreenContainerProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  atmosphere?: 'brand' | 'calm' | 'hub';
  size?: 'compact' | 'standard' | 'wide';
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'secondary' | 'danger' | 'dark' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  accessibilityHint?: string;
};

type InputFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helper?: string;
};

type CardTone = 'paper' | 'soft' | 'dark' | 'blue' | 'success' | 'warning';

type MotionScope = {
  isFocused: boolean;
  nextDelay: () => number;
};

const MotionScopeContext = createContext<MotionScope>({ isFocused: true, nextDelay: () => 0 });

let reducedMotionSnapshot = false;
let reducedMotionSubscription: { remove: () => void } | null = null;
const reducedMotionListeners = new Set<() => void>();

function notifyReducedMotionListeners() {
  reducedMotionListeners.forEach((listener) => listener());
}

function ensureReducedMotionSubscription() {
  if (reducedMotionSubscription) return;
  void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    if (reducedMotionSnapshot === enabled) return;
    reducedMotionSnapshot = enabled;
    notifyReducedMotionListeners();
  });
  reducedMotionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    reducedMotionSnapshot = enabled;
    notifyReducedMotionListeners();
  });
}

function subscribeReducedMotion(listener: () => void) {
  ensureReducedMotionSubscription();
  reducedMotionListeners.add(listener);
  return () => reducedMotionListeners.delete(listener);
}

export function FocusPressable({
  focusTone = 'light',
  onBlur,
  onFocus,
  style,
  ...props
}: PressableProps & { focusTone?: 'light' | 'dark' }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...props}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        focused && (focusTone === 'dark' ? styles.focusVisibleDark : styles.focusVisible),
      ]}
    />
  );
}

export function ScreenContainer({
  children,
  contentContainerStyle,
  scroll = false,
  refreshing = false,
  onRefresh,
  keyboard = false,
  atmosphere = 'calm',
  size = 'standard',
}: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const motionIndex = useRef(0);
  const nextMotionDelay = useCallback(() => {
    const delay = Math.min(motionIndex.current * 38, 228);
    motionIndex.current += 1;
    return delay;
  }, []);
  const motionScope = useMemo(() => ({ isFocused, nextDelay: nextMotionDelay }), [isFocused, nextMotionDelay]);
  const backgroundColors = atmosphere === 'hub'
    ? ['#FAF8F2', '#EEF3F0', '#F5F2E9'] as const
    : atmosphere === 'brand'
      ? ['#FBF9F3', '#F1F5F1', '#F7F2E9'] as const
      : ['#FAF8F2', '#F5F4EE', '#F2F0E9'] as const;
  const horizontalGutter = width < 390 ? 16 : width < 600 ? 20 : width < 900 ? 28 : 40;
  const maxWidths = { compact: 600, standard: 900, wide: 1120 } as const;
  const maxWidth = maxWidths[size];
  const shell = (
    <View
      style={[
        styles.shell,
        { maxWidth, paddingHorizontal: horizontalGutter },
        scroll && styles.scrollShell,
        scroll && width >= 1024 && styles.scrollShellWide,
        contentContainerStyle,
      ]}>
      <MotionScopeContext.Provider value={motionScope}>{children}</MotionScopeContext.Provider>
    </View>
  );
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollOuter}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            colors={[VitalisColors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={VitalisColors.primary}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}>
      {shell}
    </ScrollView>
  ) : (
    shell
  );

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.background}>
        <LinearGradient
          colors={backgroundColors}
          end={{ x: 0.78, y: 1 }}
          start={{ x: 0.15, y: 0 }}
          style={styles.backgroundGradient}
        />
        <View style={[styles.aura, styles.auraBlue, atmosphere === 'calm' && styles.auraQuiet, atmosphere === 'hub' && styles.auraHubBlue]} />
        <View style={[styles.aura, styles.auraGreen, atmosphere === 'calm' && styles.auraQuiet, atmosphere === 'hub' && styles.auraHubGreen]} />
        {atmosphere === 'hub' ? <View style={styles.hubAtmosphere} /> : null}
        {keyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={8}
            style={styles.flex}>
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </View>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  return (
    <MotionReveal distance={6} style={styles.headerRow}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={[styles.screenTitle, width < 360 && styles.screenTitleSmall]}>
          {title}
        </Text>
        {description ? <Text style={styles.screenDescription}>{description}</Text> : null}
      </View>
      {action}
    </MotionReveal>
  );
}

export function ScreenLabel({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'green' | 'neutral' }) {
  const palette = tone === 'green' ? styles.labelGreen : tone === 'neutral' ? styles.labelNeutral : styles.labelBlue;
  return (
    <MotionReveal distance={4} style={[styles.labelPill, palette]}>
      <Text style={styles.labelText}>{children}</Text>
    </MotionReveal>
  );
}

export function MotionReveal({
  children,
  delay = 0,
  distance = 8,
  style,
  ...props
}: ViewProps & { delay?: number; distance?: number }) {
  const reducedMotion = useReducedMotionPreference();
  const motionScope = useContext(MotionScopeContext);
  const [staggerDelay] = useState(() => motionScope.nextDelay());
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    reveal.stopAnimation();
    if (!motionScope.isFocused || reducedMotion) {
      reveal.setValue(motionScope.isFocused ? 1 : 0);
      return;
    }
    reveal.setValue(0);
    Animated.timing(reveal, {
      delay: delay + staggerDelay,
      duration: VitalisMotion.standard,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [delay, motionScope.isFocused, reducedMotion, reveal, staggerDelay]);

  useEffect(() => () => reveal.stopAnimation(), [reveal]);

  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: reveal,
          transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[VitalisColors.primary, '#0D78D9', VitalisColors.success]}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[styles.logoText, { fontSize: size * 0.36 }]}>V</Text>
      <View style={[styles.logoOrbit, { borderRadius: size, height: size * 0.58, width: size * 0.58 }]} />
    </LinearGradient>
  );
}

export function SectionCard({
  children,
  style,
  tone = 'paper',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: CardTone;
}) {
  const reducedMotion = useReducedMotionPreference();
  const motionScope = useContext(MotionScopeContext);
  const [staggerDelay] = useState(() => motionScope.nextDelay());
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    reveal.stopAnimation();
    if (!motionScope.isFocused || reducedMotion) {
      reveal.setValue(motionScope.isFocused ? 1 : 0);
      return;
    }
    reveal.setValue(0);
    Animated.timing(reveal, {
      delay: 45 + staggerDelay,
      duration: VitalisMotion.standard,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [motionScope.isFocused, reducedMotion, reveal, staggerDelay]);

  useEffect(() => () => reveal.stopAnimation(), [reveal]);

  return (
    <Animated.View
      style={[
        styles.card,
        cardTones[tone],
        style,
        {
          opacity: reveal,
          transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
        },
      ]}>
      <LinearGradient
        colors={cardGradients[tone]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.cardGradient}
      />
      {children}
    </Animated.View>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <MotionReveal distance={6} style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
      </View>
      {action}
    </MotionReveal>
  );
}

export function PrimaryButton({
  label,
  onPress,
  tone = 'primary',
  style,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = buttonTones[tone];
  const textTone = buttonTextTones[tone];
  const spinnerColor = tone === 'secondary' || tone === 'ghost' ? VitalisColors.primary : VitalisColors.surface;

  return (
    <FocusPressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      focusTone={tone === 'dark' ? 'dark' : 'light'}
      style={({ hovered, pressed }) => [
        styles.button,
        palette,
        style,
        hovered && !isDisabled && styles.buttonHovered,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}>
      <MotionReveal distance={4} style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator color={spinnerColor} size="small" />
        ) : (
          <>
            {icon ? <MaterialIcons color={isDisabled ? VitalisColors.muted : textTone.color} name={icon} size={20} /> : null}
            <Text style={[styles.buttonText, textTone, isDisabled && styles.buttonTextDisabled]}>{label}</Text>
          </>
        )}
      </MotionReveal>
    </FocusPressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'paper',
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'paper' | 'dark';
}) {
  return (
    <FocusPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      focusTone={tone === 'dark' ? 'dark' : 'light'}
      style={({ hovered, pressed }) => [
        styles.iconButton,
        tone === 'dark' && styles.iconButtonDark,
        hovered && styles.iconButtonHovered,
        pressed && styles.pressed,
      ]}>
      <MotionReveal distance={3}>
        <MaterialIcons
          color={tone === 'dark' ? VitalisColors.onDark : VitalisColors.ink}
          name={icon}
          size={23}
        />
      </MotionReveal>
    </FocusPressable>
  );
}

export function InputField({ label, style, multiline, error, helper, onFocus, onBlur, ...props }: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <MotionReveal distance={5} style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={VitalisColors.mutedSoft}
        selectionColor={VitalisColors.primary}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : helper ? <Text style={styles.fieldHelper}>{helper}</Text> : null}
    </MotionReveal>
  );
}

export function StatusPill({
  label,
  tone = 'neutral',
  icon,
  compact = false,
}: {
  label: string;
  tone?: 'neutral' | 'blue' | 'success' | 'warning' | 'danger' | 'dark';
  icon?: keyof typeof MaterialIcons.glyphMap;
  compact?: boolean;
}) {
  const palette = statusTones[tone];
  return (
    <MotionReveal accessibilityLabel={label} distance={4} style={[styles.statusPill, compact && styles.statusPillCompact, palette.container]}>
      {icon ? <MaterialIcons color={palette.text.color} name={icon} size={15} /> : null}
      {!compact ? <Text style={[styles.statusText, palette.text]}>{label}</Text> : null}
    </MotionReveal>
  );
}

export function MedicationMark({ colorToken = 'blue', size = 46 }: { colorToken?: string; size?: number }) {
  const color = MedicationColors[colorToken as MedicationColorToken] ?? MedicationColors.blue;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.medicationMark, { backgroundColor: color.soft, height: size, width: size }]}>
      <View style={[styles.capsule, { backgroundColor: color.solid, height: size * 0.5, width: size * 0.24 }]}>
        <View style={[styles.capsuleHalf, { backgroundColor: VitalisColors.surface }]} />
      </View>
    </View>
  );
}

export function useReducedMotionPreference() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionSnapshot,
    () => false,
  );
}

export function LoadingState({ label = 'Carregando sua rotina…' }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0.48)).current;
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.72);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: VitalisMotion.deliberate * 2.4,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.82,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          duration: VitalisMotion.deliberate * 2.4,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.48,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <View accessibilityLiveRegion="polite" style={styles.stateBox}>
      <View style={styles.loadingHeader}>
        <ActivityIndicator color={VitalisColors.primary} size="small" />
        <Text style={styles.stateTitle}>{label}</Text>
      </View>
      <Animated.View style={[styles.skeletonStack, { opacity: pulse }]}>
        <View style={[styles.skeletonBlock, styles.skeletonHero]} />
        <View style={styles.skeletonRow}>
          <View style={[styles.skeletonBlock, styles.skeletonMetric]} />
          <View style={[styles.skeletonBlock, styles.skeletonMetric]} />
          <View style={[styles.skeletonBlock, styles.skeletonMetric]} />
        </View>
        <View style={[styles.skeletonBlock, styles.skeletonLine]} />
        <View style={[styles.skeletonBlock, styles.skeletonLineShort]} />
      </Animated.View>
    </View>
  );
}

export function InlineNotice({
  title,
  description,
  tone = 'info',
}: {
  title: string;
  description: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
}) {
  const palettes = {
    info: { container: styles.noticeInfo, icon: 'info-outline' as const, color: VitalisColors.primaryStrong },
    success: { container: styles.noticeSuccess, icon: 'check-circle-outline' as const, color: VitalisColors.success },
    warning: { container: styles.noticeWarning, icon: 'schedule' as const, color: VitalisColors.warningStrong },
    danger: { container: styles.noticeDanger, icon: 'error-outline' as const, color: VitalisColors.danger },
  };
  const palette = palettes[tone];

  return (
    <MotionReveal accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'} distance={6} style={[styles.notice, palette.container]}>
      <View style={styles.noticeIcon}>
        <MaterialIcons color={palette.color} name={palette.icon} size={21} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={styles.noticeTitle}>{title}</Text>
        <Text style={styles.noticeDescription}>{description}</Text>
      </View>
    </MotionReveal>
  );
}

export function EmptyState({
  icon = 'medication',
  title,
  description,
  action,
}: {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <SectionCard style={styles.emptyCard} tone="soft">
      <View style={styles.emptyIcon}>
        <MaterialIcons color={VitalisColors.primary} name={icon} size={26} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </SectionCard>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <SectionCard style={styles.errorCard} tone="warning">
      <MaterialIcons color={VitalisColors.danger} name="error-outline" size={24} />
      <View style={styles.errorCopy}>
        <Text accessibilityLiveRegion="assertive" style={styles.errorTitle}>
          Não foi possível carregar
        </Text>
        <Text style={styles.errorDescription}>{message}</Text>
      </View>
      {onRetry ? <PrimaryButton label="Tentar novamente" onPress={onRetry} style={styles.retryButton} tone="secondary" /> : null}
    </SectionCard>
  );
}

export function SmallMuted({ children }: { children: ReactNode }) {
  return <Text style={styles.smallMuted}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <FocusPressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ hovered, pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              hovered && !selected && styles.segmentHovered,
              pressed && styles.pressed,
            ]}>
            {selected ? <View style={styles.segmentIndicator} /> : null}
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </FocusPressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'success',
}: {
  value: number;
  label: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const normalized = Math.min(100, Math.max(0, value));
  const reducedMotion = useReducedMotionPreference();
  const motionScope = useContext(MotionScopeContext);
  const [staggerDelay] = useState(() => motionScope.nextDelay());
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (!motionScope.isFocused || reducedMotion) {
      progress.setValue(motionScope.isFocused ? normalized : 0);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      delay: staggerDelay,
      duration: VitalisMotion.deliberate,
      easing: Easing.out(Easing.cubic),
      toValue: normalized,
      useNativeDriver: false,
    }).start();
  }, [motionScope.isFocused, normalized, progress, reducedMotion, staggerDelay]);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: normalized, text: `${normalized}%` }}
      style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          tone === 'primary' && styles.progressFillPrimary,
          tone === 'warning' && styles.progressFillWarning,
          { width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'neutral' | 'blue' | 'success' | 'warning';
}) {
  const color = tone === 'success'
    ? VitalisColors.success
    : tone === 'warning'
      ? VitalisColors.warningStrong
      : tone === 'blue'
        ? VitalisColors.primary
        : VitalisColors.muted;
  return (
    <MotionReveal distance={6} style={styles.metricCard}>
      <View style={styles.metricIcon}><MaterialIcons color={color} name={icon} size={20} /></View>
      <View style={styles.metricCopy}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
        {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
      </View>
    </MotionReveal>
  );
}

const cardTones: Record<CardTone, ViewStyle> = {
  paper: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, boxShadow: VitalisElevation.subtle },
  soft: { backgroundColor: VitalisColors.surfaceSoft, borderColor: VitalisColors.border, boxShadow: VitalisElevation.control },
  dark: { backgroundColor: VitalisColors.surfaceDark, borderColor: VitalisColors.surfaceDarkElevated, boxShadow: VitalisElevation.floating },
  blue: { backgroundColor: VitalisColors.primarySoft, borderColor: '#B7D4FA', boxShadow: VitalisElevation.subtle },
  success: { backgroundColor: VitalisColors.successSoft, borderColor: '#B6DFC9', boxShadow: VitalisElevation.control },
  warning: { backgroundColor: VitalisColors.warning, borderColor: VitalisColors.warningBorder, boxShadow: VitalisElevation.control },
};

const cardGradients: Record<CardTone, readonly [string, string, ...string[]]> = {
  paper: ['rgba(255,255,255,0.30)', 'rgba(217,233,255,0.05)'],
  soft: ['rgba(255,255,255,0.20)', 'rgba(197,220,203,0.07)'],
  dark: ['rgba(44,67,80,0.52)', 'rgba(17,25,31,0.04)'],
  blue: ['rgba(255,255,255,0.13)', 'rgba(13,79,176,0.06)'],
  success: ['rgba(255,255,255,0.22)', 'rgba(31,157,103,0.05)'],
  warning: ['rgba(255,255,255,0.22)', 'rgba(178,106,0,0.05)'],
};

const buttonTones: Record<NonNullable<ButtonProps['tone']>, ViewStyle> = {
  primary: { backgroundColor: VitalisColors.primary, borderColor: VitalisColors.primary },
  secondary: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderStrong },
  danger: { backgroundColor: VitalisColors.danger, borderColor: VitalisColors.danger },
  dark: { backgroundColor: VitalisColors.surfaceDarkElevated, borderColor: '#2D424E' },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
};

const buttonTextTones = {
  primary: { color: VitalisColors.surface },
  secondary: { color: VitalisColors.primaryStrong },
  danger: { color: VitalisColors.surface },
  dark: { color: VitalisColors.onDark },
  ghost: { color: VitalisColors.primaryStrong },
};

const statusTones = {
  neutral: { container: { backgroundColor: VitalisColors.surfaceSoft }, text: { color: VitalisColors.muted } },
  blue: { container: { backgroundColor: VitalisColors.primarySoft }, text: { color: VitalisColors.primaryStrong } },
  success: { container: { backgroundColor: VitalisColors.successSoft }, text: { color: '#106B45' } },
  warning: { container: { backgroundColor: VitalisColors.warning }, text: { color: VitalisColors.warningText } },
  danger: { container: { backgroundColor: VitalisColors.dangerSoft }, text: { color: VitalisColors.danger } },
  dark: { container: { backgroundColor: VitalisColors.surfaceDarkElevated }, text: { color: VitalisColors.onDark } },
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: VitalisColors.canvas },
  background: { flex: 1, backgroundColor: VitalisColors.canvas, overflow: 'hidden' },
  backgroundGradient: { bottom: 0, left: 0, pointerEvents: 'none', position: 'absolute', right: 0, top: 0 },
  shell: {
    alignSelf: 'center',
    flex: 1,
    paddingBottom: VitalisSpacing.xxl,
    width: '100%',
  },
  scrollOuter: { flexGrow: 1 },
  scrollShell: { flexGrow: 1, gap: VitalisSpacing.md, paddingBottom: 116 },
  scrollShellWide: { paddingBottom: VitalisSpacing.xxxl },
  aura: { borderRadius: 999, opacity: 0.14, pointerEvents: 'none', position: 'absolute' },
  auraBlue: { backgroundColor: '#B9D5E7', height: 310, right: -154, top: -136, width: 310 },
  auraGreen: { backgroundColor: '#C5DCCB', height: 360, left: -242, top: 286, width: 360 },
  auraQuiet: { opacity: 0.055 },
  auraHubBlue: { backgroundColor: '#AAC7D4', opacity: 0.18, right: -124, top: 68 },
  auraHubGreen: { backgroundColor: '#B9D6C4', opacity: 0.11, top: 352 },
  hubAtmosphere: { backgroundColor: 'rgba(18, 43, 54, 0.018)', bottom: 0, left: 0, pointerEvents: 'none', position: 'absolute', right: 0, top: 0 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', gap: VitalisSpacing.md, justifyContent: 'space-between' },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  screenTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 36, letterSpacing: -0.6, lineHeight: 40 },
  screenTitleSmall: { fontSize: 32, lineHeight: 36 },
  screenDescription: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 16, lineHeight: 24, maxWidth: 560 },
  labelPill: { alignSelf: 'flex-start', borderRadius: VitalisRadius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  labelBlue: { backgroundColor: VitalisColors.primarySoft, borderColor: '#B7D4FA' },
  labelGreen: { backgroundColor: VitalisColors.successSoft, borderColor: '#B6DFC9' },
  labelNeutral: { backgroundColor: VitalisColors.surfaceSoft, borderColor: VitalisColors.border },
  labelText: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' },
  logoMark: { alignItems: 'center', boxShadow: VitalisElevation.floating, justifyContent: 'center', overflow: 'hidden' },
  logoText: { color: '#FFFFFF', fontFamily: VitalisFonts.logo, zIndex: 2 },
  logoOrbit: { borderColor: 'rgba(255,255,255,0.28)', borderWidth: 1, position: 'absolute', transform: [{ rotate: '28deg' }] },
  card: { borderRadius: VitalisRadius.card, borderWidth: 1, padding: VitalisSpacing.ml, position: 'relative' },
  cardGradient: { borderRadius: VitalisRadius.card, bottom: 0, left: 0, pointerEvents: 'none', position: 'absolute', right: 0, top: 0 },
  sectionHeading: { alignItems: 'flex-end', flexDirection: 'row', gap: VitalisSpacing.md, justifyContent: 'space-between' },
  sectionHeadingCopy: { flex: 1, gap: 3 },
  sectionEyebrow: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  sectionTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 21, letterSpacing: -0.25, lineHeight: 27 },
  sectionMeta: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  button: { alignItems: 'center', borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, paddingHorizontal: VitalisSpacing.lg },
  buttonContent: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center' },
  buttonText: { fontFamily: VitalisFonts.bodyBold, fontSize: 15, lineHeight: 20, textAlign: 'center' },
  buttonTextDisabled: { color: VitalisColors.muted },
  buttonHovered: { boxShadow: VitalisElevation.subtle },
  iconButtonHovered: { backgroundColor: VitalisColors.primaryMist, borderColor: '#B7D4FA' },
  focusVisible: { borderColor: VitalisColors.primary, boxShadow: VitalisElevation.focus },
  focusVisibleDark: { borderColor: '#8FC3F5', boxShadow: '0 0 0 4px rgba(143,195,245,0.18)' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { backgroundColor: VitalisColors.surfaceSoft, borderColor: VitalisColors.border, opacity: 1 },
  iconButton: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, borderRadius: VitalisRadius.pill, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  iconButtonDark: { backgroundColor: VitalisColors.surfaceDarkElevated, borderColor: '#2D424E' },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 13 },
  input: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderStrong, borderRadius: VitalisRadius.md, borderWidth: 1, color: VitalisColors.ink, fontFamily: VitalisFonts.body, fontSize: 16, minHeight: 52, paddingHorizontal: 15, paddingVertical: 13 },
  inputMultiline: { minHeight: 104, textAlignVertical: 'top' },
  inputFocused: { borderColor: VitalisColors.primary, boxShadow: '0 0 0 3px rgba(21, 101, 216, 0.12)' },
  inputError: { borderColor: VitalisColors.danger },
  fieldHelper: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  fieldError: { color: VitalisColors.danger, fontFamily: VitalisFonts.bodyMedium, fontSize: 13, lineHeight: 19 },
  statusPill: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: VitalisRadius.pill, flexDirection: 'row', gap: 5, minHeight: 30, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillCompact: { justifyContent: 'center', paddingHorizontal: 8, width: 32 },
  statusText: { fontFamily: VitalisFonts.bodySemiBold, fontSize: 12 },
  medicationMark: { alignItems: 'center', borderRadius: VitalisRadius.md, justifyContent: 'center' },
  capsule: { borderRadius: VitalisRadius.pill, overflow: 'hidden', transform: [{ rotate: '35deg' }] },
  capsuleHalf: { bottom: 0, height: '50%', left: 0, opacity: 0.88, position: 'absolute', right: 0 },
  stateBox: { alignSelf: 'center', flex: 1, gap: VitalisSpacing.lg, justifyContent: 'center', maxWidth: 560, minHeight: 300, padding: VitalisSpacing.lg, width: '100%' },
  stateTitle: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 15, textAlign: 'center' },
  loadingHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  skeletonStack: { gap: 12, width: '100%' },
  skeletonBlock: { backgroundColor: '#E5E9EA', borderRadius: VitalisRadius.md },
  skeletonHero: { height: 128, width: '100%' },
  skeletonRow: { flexDirection: 'row', gap: 10 },
  skeletonMetric: { flex: 1, height: 72 },
  skeletonLine: { height: 14, width: '92%' },
  skeletonLineShort: { height: 14, width: '64%' },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: VitalisSpacing.xl },
  emptyIcon: { alignItems: 'center', backgroundColor: VitalisColors.primarySoft, borderRadius: VitalisRadius.pill, height: 52, justifyContent: 'center', marginBottom: 4, width: 52 },
  emptyTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 25, lineHeight: 29, textAlign: 'center' },
  emptyDescription: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 15, lineHeight: 23, maxWidth: 420, textAlign: 'center' },
  emptyAction: { marginTop: 10, maxWidth: 320, width: '100%' },
  errorCard: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  errorCopy: { flex: 1, gap: 3, minWidth: 190 },
  errorTitle: { color: VitalisColors.danger, fontFamily: VitalisFonts.bodyBold, fontSize: 15 },
  errorDescription: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 21 },
  retryButton: { marginTop: 4, width: '100%' },
  notice: { alignItems: 'flex-start', borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  noticeInfo: { backgroundColor: VitalisColors.primarySoft, borderColor: '#B7D4FA' },
  noticeSuccess: { backgroundColor: VitalisColors.successSoft, borderColor: '#B6DFC9' },
  noticeWarning: { backgroundColor: VitalisColors.warning, borderColor: VitalisColors.warningBorder },
  noticeDanger: { backgroundColor: VitalisColors.dangerSoft, borderColor: '#E9C0C0' },
  noticeIcon: { alignItems: 'center', height: 26, justifyContent: 'center', width: 26 },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 14, lineHeight: 20 },
  noticeDescription: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20 },
  smallMuted: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  divider: { backgroundColor: VitalisColors.border, height: 1, width: '100%' },
  segmentedControl: { backgroundColor: VitalisColors.surfaceSoft, borderRadius: VitalisRadius.md, flexDirection: 'row', gap: 4, padding: 4 },
  segment: { alignItems: 'center', borderColor: 'transparent', borderRadius: VitalisRadius.sm, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  segmentSelected: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderStrong, boxShadow: VitalisElevation.control },
  segmentHovered: { backgroundColor: VitalisColors.surfaceRaised },
  segmentIndicator: { backgroundColor: VitalisColors.primary, borderRadius: VitalisRadius.pill, height: 6, width: 6 },
  segmentText: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 14 },
  segmentTextSelected: { color: VitalisColors.ink },
  progressTrack: { backgroundColor: VitalisColors.surfaceCard, borderRadius: VitalisRadius.pill, height: 8, overflow: 'hidden', width: '100%' },
  progressFill: { backgroundColor: VitalisColors.success, borderRadius: VitalisRadius.pill, height: '100%' },
  progressFillPrimary: { backgroundColor: VitalisColors.primary },
  progressFillWarning: { backgroundColor: VitalisColors.warningStrong },
  metricCard: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderSubtle, borderRadius: VitalisRadius.lg, borderWidth: 1, boxShadow: VitalisElevation.control, flexDirection: 'row', gap: 12, minHeight: 92, padding: 14 },
  metricIcon: { alignItems: 'center', backgroundColor: VitalisColors.surfaceSoft, borderRadius: VitalisRadius.md, height: 40, justifyContent: 'center', width: 40 },
  metricCopy: { flex: 1, gap: 1 },
  metricLabel: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 12, lineHeight: 17 },
  metricValue: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 22, fontVariant: ['tabular-nums'], lineHeight: 27 },
  metricDetail: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 17 },
});
