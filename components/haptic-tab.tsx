import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated, Platform } from 'react-native';

import { useReducedMotionPreference } from '@/components/vitalis-ui';

const AnimatedTabPressable = Animated.createAnimatedComponent(PlatformPressable);

export function HapticTab(props: BottomTabBarButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotionPreference();

  return (
    <AnimatedTabPressable
      {...props}
      onPressIn={(ev) => {
        if (!reducedMotion) {
          Animated.spring(scale, {
            damping: 18,
            mass: 0.55,
            stiffness: 320,
            toValue: 0.94,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
        if (Platform.OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        props.onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        if (!reducedMotion) {
          Animated.spring(scale, {
            damping: 16,
            mass: 0.58,
            stiffness: 270,
            toValue: 1,
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
        props.onPressOut?.(ev);
      }}
      style={[props.style, { transform: [{ scale }] }]}
    />
  );
}
