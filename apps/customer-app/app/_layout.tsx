import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, title: 'Product Details' }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: true, title: 'Order Tracking' }} />
        <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Checkout' }} />
      </Stack>
    </>
  );
}
