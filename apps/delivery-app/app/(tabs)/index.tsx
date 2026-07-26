import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function DeliveryDashboard() {
  // TODO: Available orders, accepted/rejected counts, today's earnings
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Available Orders</Text>
      {/* TODO: Order cards with Accept/Reject */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', padding: 16 },
});
