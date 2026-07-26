import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CheckoutScreen() {
  // TODO: Address selection, payment method, order summary, place order
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Checkout Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
