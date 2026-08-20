import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Linking, Platform } from "react-native";

import * as pushTokenService from "@/services/pushTokenService";
import { AuthContext } from "@/utils/authContext";

const PENDING_TOKEN_KEY = "primerep.pendingExpoPushToken.v1";
const LAST_REGISTERED_TOKEN_KEY = "primerep.lastRegisteredExpoPushToken.v1";
const DEFAULT_CHANNEL_ID = "default";

export type NotificationPermissionState =
  | "unsupported"
  | "undetermined"
  | "granted"
  | "denied";

type NotificationsContextValue = {
  permission: NotificationPermissionState;
  isLoading: boolean;
  refreshPermission: () => Promise<NotificationPermissionState>;
  requestPermission: () => Promise<NotificationPermissionState>;
  unregisterCurrentDevice: (accessToken: string) => Promise<void>;
  openSettings: () => Promise<void>;
};

export const NotificationsContext = createContext<NotificationsContextValue>({
  permission: "undetermined",
  isLoading: false,
  refreshPermission: async () => "undetermined",
  requestPermission: async () => "undetermined",
  unregisterCurrentDevice: async () => {},
  openSettings: Linking.openSettings,
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function permissionState(
  settings: Notifications.NotificationPermissionsStatus
): NotificationPermissionState {
  if (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return "granted";
  }
  return settings.canAskAgain ? "undetermined" : "denied";
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: "PrimeRep notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

function getProjectId(): string {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("EAS project ID is not configured");
  return projectId;
}

async function acquireExpoToken(): Promise<string> {
  await configureAndroidChannel();
  return (
    await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() })
  ).data;
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { isBootstrapping, token: accessToken } = useContext(AuthContext);
  const [permission, setPermission] =
    useState<NotificationPermissionState>("undetermined");
  const [isLoading, setIsLoading] = useState(false);
  const authRef = useRef(accessToken);
  const requestVersionRef = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (authRef.current === accessToken) return;
    authRef.current = accessToken;
    requestVersionRef.current += 1;
  }, [accessToken]);

  const refreshPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    const next = permissionState(await Notifications.getPermissionsAsync());
    setPermission(next);
    return next;
  }, []);

  const uploadCurrentToken = useCallback((authToken: string) => {
    const version = ++requestVersionRef.current;
    const queuedUpload = uploadQueueRef.current.catch(() => {}).then(async () => {
      const platform = Platform.OS;
      if (
        (platform !== "ios" && platform !== "android") ||
        authRef.current !== authToken ||
        requestVersionRef.current !== version
      ) return;

      const currentToken = await acquireExpoToken();
      if (authRef.current !== authToken || requestVersionRef.current !== version) return;

      await pushTokenService.registerPushToken(authToken, {
        token: currentToken,
        platform,
      });
      if (authRef.current !== authToken || requestVersionRef.current !== version) return;

      const previousToken = await AsyncStorage.getItem(LAST_REGISTERED_TOKEN_KEY);
      if (previousToken && previousToken !== currentToken) {
        await pushTokenService.unregisterPushToken(authToken, previousToken);
        if (authRef.current !== authToken || requestVersionRef.current !== version) return;
      }
      await AsyncStorage.setItem(LAST_REGISTERED_TOKEN_KEY, currentToken);
      await AsyncStorage.removeItem(PENDING_TOKEN_KEY);
    });
    uploadQueueRef.current = queuedUpload;
    return queuedUpload;
  }, []);

  const syncWithoutPrompt = useCallback(async () => {
    try {
      const nextPermission = await refreshPermission();
      if (nextPermission !== "granted" || !accessToken) return;
      await uploadCurrentToken(accessToken);
    } catch (error) {
      if (__DEV__) console.warn("Push token sync deferred:", error);
    }
  }, [accessToken, refreshPermission, uploadCurrentToken]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    setIsLoading(true);
    try {
      await configureAndroidChannel();
      const settings = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      const nextPermission = permissionState(settings);
      setPermission(nextPermission);
      if (nextPermission !== "granted") return nextPermission;

      const pushToken = await acquireExpoToken();
      await AsyncStorage.setItem(PENDING_TOKEN_KEY, pushToken);
      if (accessToken) await uploadCurrentToken(accessToken);
      return nextPermission;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, uploadCurrentToken]);

  const unregisterCurrentDevice = useCallback(async (authToken: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.multiRemove([
        LAST_REGISTERED_TOKEN_KEY,
        PENDING_TOKEN_KEY,
      ]);
      return;
    }
    const version = ++requestVersionRef.current;
    const queuedUnregister = uploadQueueRef.current.catch(() => {}).then(async () => {
      if (authRef.current !== authToken || requestVersionRef.current !== version) {
        throw new Error("Session changed before device unregister completed");
      }
      const tokens = new Set<string>();
      const registeredToken = await AsyncStorage.getItem(LAST_REGISTERED_TOKEN_KEY);
      if (registeredToken) tokens.add(registeredToken);

      const currentPermission = permissionState(
        await Notifications.getPermissionsAsync()
      );
      if (currentPermission === "granted") tokens.add(await acquireExpoToken());

      for (const pushToken of tokens) {
        await pushTokenService.unregisterPushToken(authToken, pushToken);
      }
      await AsyncStorage.multiRemove([
        LAST_REGISTERED_TOKEN_KEY,
        PENDING_TOKEN_KEY,
      ]);
    });
    uploadQueueRef.current = queuedUnregister;
    await queuedUnregister;
  }, []);

  useEffect(() => {
    if (isBootstrapping) return;
    void syncWithoutPrompt();
  }, [isBootstrapping, syncWithoutPrompt]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncWithoutPrompt();
    });
    return () => subscription.remove();
  }, [syncWithoutPrompt]);

  const value = useMemo(
    () => ({
      permission,
      isLoading,
      refreshPermission,
      requestPermission,
      unregisterCurrentDevice,
      openSettings: Linking.openSettings,
    }),
    [
      isLoading,
      permission,
      refreshPermission,
      requestPermission,
      unregisterCurrentDevice,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
