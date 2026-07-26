import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function OnboardingScreen() {
  // TODO: KYC form — Aadhaar last 4, PAN last 4, DL, vehicle, bank/UPI
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>Submit your documents to start delivering</Text>
      {/* TODO: KYC form fields */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
});
