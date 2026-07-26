import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Good Morning! 🌅</Text>
      <Text style={styles.subtitle}>Fresh produce, straight from our farm</Text>
      {/* TODO: Search bar */}
      {/* TODO: Active offers carousel */}
      {/* TODO: Categories grid */}
      {/* TODO: Featured products */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  greeting: { fontSize: 24, fontWeight: '700', color: '#111827', paddingHorizontal: 16, paddingTop: 16 },
  subtitle: { fontSize: 14, color: '#6B7280', paddingHorizontal: 16, marginTop: 4, marginBottom: 24 },
});
