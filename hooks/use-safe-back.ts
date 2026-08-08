import { useNavigation } from '@react-navigation/native';
import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';

export function useSafeBack(fallback: Href) {
  const navigation = useNavigation();
  const router = useRouter();

  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    router.replace(fallback);
  }, [fallback, navigation, router]);
}
