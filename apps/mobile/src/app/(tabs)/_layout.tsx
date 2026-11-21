import { Tabs } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from '@/components/ui';
import { AddTabButton } from '@/components/navigation/AddTabButton';

const tabIcon =
  (name: IconName) =>
  ({ focused, size }: { focused: boolean; size: number }) => (
    <Icon name={name} color={focused ? 'primary' : 'inkSubtle'} size={size} />
  );

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.inkSubtle,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: t.fontFamily.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: tabIcon('house') }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Transações', tabBarIcon: tabIcon('arrow-left-right') }}
      />
      <Tabs.Screen name="add" options={{ title: '', tabBarButton: () => <AddTabButton /> }} />
      <Tabs.Screen
        name="budgets"
        options={{ title: 'Orçamentos', tabBarIcon: tabIcon('wallet') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Relatórios', tabBarIcon: tabIcon('chart-pie') }}
      />
    </Tabs>
  );
}
