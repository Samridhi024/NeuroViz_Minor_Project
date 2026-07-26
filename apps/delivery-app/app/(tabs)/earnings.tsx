import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EarningsScreen() {
  // TODO: Daily/weekly/monthly earnings breakdown, incentive tracking
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Earnings Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
