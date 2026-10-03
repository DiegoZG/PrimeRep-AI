import { Platform } from 'react-native';

export const HEALTH_BRIDGE_TEST_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_HEALTH_BRIDGE_TEST === '1' && Platform.OS === 'ios';
