import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams();
  // TODO: Order status timeline, live map tracking
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Order Tracking: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
