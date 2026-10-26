import { Redirect, Tabs, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../src/data/AppStore.tsx";
import { colors } from "../../src/ui/theme.ts";

export default function TabsLayout() {
  const { ready, state } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }
  if (!state) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.cyan,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarIconStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Accueil" }} />
        <Tabs.Screen name="budget" options={{ title: "Budget" }} />
        <Tabs.Screen name="recurrents" options={{ title: "Récurrents" }} />
        <Tabs.Screen name="coffre" options={{ title: "Coffre" }} />
      </Tabs>
      {/* Bouton + : la saisie en 3 tapes, accessible depuis tous les onglets. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Saisir une opération"
        onPress={() => router.push("/saisie")}
        style={({ pressed }) => [styles.plus, { bottom: insets.bottom + 64 }, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.plusText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  plus: {
    position: "absolute",
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  plusText: { color: colors.bg, fontSize: 32, fontWeight: "700", marginTop: -2 },
});
