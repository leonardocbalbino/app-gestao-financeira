jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}));

jest.mock('react-native-mmkv', () => {
  const createMMKV = () => {
    const map = new Map<string, unknown>();
    return {
      set: (k: string, v: unknown) => void map.set(k, v),
      getString: (k: string) => map.get(k) as string | undefined,
      getBoolean: (k: string) => map.get(k) as boolean | undefined,
      getNumber: (k: string) => map.get(k) as number | undefined,
      contains: (k: string) => map.has(k),
      remove: (k: string) => map.delete(k),
      getAllKeys: () => [...map.keys()],
      clearAll: () => map.clear(),
    };
  };
  return { createMMKV };
});

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
