import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStoreProvider } from "../src/data/AppStore.tsx";
import { colors } from "../src/ui/theme.ts";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="saisie" options={{ presentation: "modal" }} />
        </Stack>
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
