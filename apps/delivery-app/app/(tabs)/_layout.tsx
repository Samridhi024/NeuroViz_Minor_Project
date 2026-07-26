import { Tabs } from 'expo-router';

export default function DeliveryTabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Dashboard' }} />
      <Tabs.Screen name="active" options={{ title: 'Active', tabBarLabel: 'Active' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarLabel: 'Earnings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tabs>
  );
}
