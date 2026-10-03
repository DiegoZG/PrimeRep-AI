import { useContext, useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { reconcileAppleHealthExport } from '@/services/health/exportSync';
import { PRIVACY_VERSION } from '@/constants/legal';
import { AuthContext } from '@/utils/authContext';

export function HealthExportSync() {
  const { token, user, isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !isLoggedIn || !token || !user?.id || user.privacy_accepted_version !== PRIVACY_VERSION) return;
    let current = true;
    const run = () => void reconcileAppleHealthExport(token, user.id, () => current).catch(() => {
      // Foreground reconciliation retries when connectivity or HealthKit recovers.
    });
    run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [isLoggedIn, token, user?.id, user?.privacy_accepted_version]);

  return null;
}
