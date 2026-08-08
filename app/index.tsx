import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LogoMark, ScreenContainer } from '@/components/vitalis-ui';
import { VitalisColors, VitalisFonts } from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';

export default function SplashScreen() {
  const router = useRouter();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      router.replace(session ? '/(tabs)/home' : '/welcome');
    }, 650);
    return () => clearTimeout(timer);
  }, [loading, router, session]);

  return (
    <ScreenContainer atmosphere="brand" contentContainerStyle={styles.container}>
      <Pressable
        accessibilityHint="Avança para o aplicativo"
        accessibilityRole="button"
        disabled={loading}
        onPress={() => router.replace(session ? '/(tabs)/home' : '/welcome')}
        style={styles.center}>
        <LogoMark size={78} />
        <View style={styles.copy}>
          <Text style={styles.title}>Vitalis</Text>
          <Text style={styles.subtitle}>Sua rotina de cuidado, em continuidade.</Text>
        </View>
        <ActivityIndicator color={VitalisColors.primary} size="small" />
      </Pressable>
      <Text style={styles.footer}>Organização medicamentosa com clareza e segurança.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 22 },
  copy: { alignItems: 'center', gap: 5 },
  title: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 48, letterSpacing: -1.2, lineHeight: 50 },
  subtitle: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 16, lineHeight: 24, maxWidth: 290, textAlign: 'center' },
  footer: { bottom: 30, color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.body, fontSize: 12, position: 'absolute', textAlign: 'center' },
});
