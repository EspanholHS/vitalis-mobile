import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { LoadingState, ScreenContainer } from '@/components/vitalis-ui';
import { VitalisColors, VitalisFonts } from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';

export default function TabLayout() {
  const { loading, session } = useAuth();
  const { width } = useWindowDimensions();
  const usesRail = width >= 1024;

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState label="Restaurando sua sessão…" />
      </ScreenContainer>
    );
  }

  if (!session) return <Redirect href="/welcome" />;

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        sceneStyle: { backgroundColor: VitalisColors.canvas },
        tabBarActiveTintColor: VitalisColors.primary,
        tabBarActiveBackgroundColor: VitalisColors.primaryMist,
        tabBarInactiveTintColor: VitalisColors.mutedSoft,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: usesRail ? 'beside-icon' : 'below-icon',
        tabBarPosition: usesRail ? 'left' : 'bottom',
        tabBarVariant: 'uikit',
        tabBarStyle: {
          backgroundColor: VitalisColors.surfaceRaised,
          borderColor: VitalisColors.borderSubtle,
          borderRadius: 0,
          borderRightWidth: usesRail ? 1 : 0,
          borderTopColor: VitalisColors.borderSubtle,
          borderTopWidth: usesRail ? 0 : 1,
          bottom: 0,
          boxShadow: usesRail ? '4px 0 22px rgba(17,25,31,0.035)' : '0 -8px 24px rgba(17,25,31,0.05)',
          height: usesRail ? '100%' : 78,
          left: 0,
          maxWidth: usesRail ? 164 : undefined,
          minWidth: usesRail ? 164 : undefined,
          overflow: 'hidden',
          paddingBottom: usesRail ? 20 : 5,
          paddingHorizontal: usesRail ? 10 : 6,
          paddingTop: usesRail ? 20 : 5,
          position: usesRail ? 'relative' : 'absolute',
          right: usesRail ? undefined : 0,
          top: usesRail ? 0 : undefined,
          width: usesRail ? 164 : undefined,
        },
        tabBarItemStyle: {
          borderRadius: 14,
          flex: usesRail ? 0 : 1,
          marginHorizontal: 2,
          marginVertical: usesRail ? 4 : 2,
          minHeight: usesRail ? 58 : 60,
        },
        tabBarIconStyle: { marginBottom: usesRail ? 0 : 1 },
        tabBarLabelStyle: {
          fontFamily: VitalisFonts.bodySemiBold,
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Hoje',
          tabBarAccessibilityLabel: 'Agenda de hoje',
          tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="home-filled" size={size} />,
        }}
      />
      <Tabs.Screen
        name="monitoring"
        options={{
          title: 'Progresso',
          tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="insights" size={size} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'IA HUB',
          tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="auto-awesome" size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="history" size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <MaterialIcons color={color} name="person" size={size} />,
        }}
      />
    </Tabs>
  );
}
