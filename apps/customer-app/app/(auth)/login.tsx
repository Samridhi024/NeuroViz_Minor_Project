import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LoginScreen() {
  // TODO: Implement phone number input + OTP send
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌾 Samruddhi Agros</Text>
      <Text style={styles.subtitle}>Fresh from farm to your doorstep</Text>
      {/* TODO: Phone input + Send OTP button */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#16A34A', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280' },
});
