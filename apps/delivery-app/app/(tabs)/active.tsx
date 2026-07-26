import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ActiveDeliveryScreen() {
  // TODO: Show active delivery with map and status steps
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Active Delivery Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
