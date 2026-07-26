import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CartScreen() {
  // TODO: Implement cart with items, quantity controls, pricing summary
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Cart Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
