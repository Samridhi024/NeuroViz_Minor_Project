import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#16A34A',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="categories" options={{ title: 'Categories', tabBarLabel: 'Categories' }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarLabel: 'Cart' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarLabel: 'Orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
    </Tabs>
  );
}
