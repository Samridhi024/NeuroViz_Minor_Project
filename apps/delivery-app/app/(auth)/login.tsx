import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DeliveryLoginScreen() {
  // TODO: Phone input for delivery partner login
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚚 Samruddhi Delivery</Text>
      <Text style={styles.subtitle}>Deliver fresh produce, earn daily</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#F59E0B', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280' },
});
