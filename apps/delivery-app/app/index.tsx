import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: Check auth + KYC status and redirect
  return <Redirect href="/(tabs)" />;
}
