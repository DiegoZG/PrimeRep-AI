import { useContext, useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { appleHealthAdapter } from '@/services/health/appleHealthAdapter';
import { syncAppleHealthRead } from '@/services/health/readSync';
import { getHealthState } from '@/services/healthService';
import { PRIVACY_VERSION } from '@/constants/legal';
import { AuthContext } from '@/utils/authContext';

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function HealthReadSync() {
  const { token, user, isLoggedIn } = useContext(AuthContext);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !isLoggedIn || !token || !user?.id || user.privacy_accepted_version !== PRIVACY_VERSION) return;
    let current = true;
    let busy = false;
    const run = async () => {
      if (!current || busy) return;
      busy = true;
      try {
        const state = await getHealthState(token);
        if (!current || !state.collectionAvailable) return;
        const connection = state.sources.find((item) => item.source === 'apple_health' && item.readEnabled);
        if (!connection) return;
        const lastSync = connection.lastSuccessfulSyncAt ? Date.parse(connection.lastSuccessfulSyncAt) : NaN;
        if (Number.isFinite(lastSync) && Date.now() - lastSync < SIX_HOURS) return;
        if (await appleHealthAdapter.availability() !== 'available' || !current) return;
        await syncAppleHealthRead(token, connection, () => current);
      } catch {
        // Manual sync in Health connections remains available after a foreground failure.
      } finally {
        busy = false;
      }
    };
    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [isLoggedIn, token, user?.id, user?.privacy_accepted_version]);

  return null;
}
