import { Stack } from 'expo-router';

export default function AdminRoutesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="members" />
      <Stack.Screen name="vouchers" />
      <Stack.Screen name="branches" />
      <Stack.Screen name="payment-logs" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="audit" />
    </Stack>
  );
}
