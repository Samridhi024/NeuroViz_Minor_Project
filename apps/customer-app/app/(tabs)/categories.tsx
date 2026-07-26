import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CategoriesScreen() {
  // TODO: Implement category listing with product counts
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Categories Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#6B7280' },
});
