import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ActiveDeliveryDetail() {
  const { id } = useLocalSearchParams();
  // TODO: Map navigation, delivery steps, complete delivery
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Delivery Detail: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
