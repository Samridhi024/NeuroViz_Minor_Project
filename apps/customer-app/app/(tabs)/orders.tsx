import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OrdersScreen() {
  // TODO: Implement order history with status badges
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Orders Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
