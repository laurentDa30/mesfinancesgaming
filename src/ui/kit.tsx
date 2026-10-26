import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { euros } from "../engine/format.ts";
import { colors, radius, space, type } from "./theme.ts";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={type.title}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={type.h2}>{children}</Text>;
}

export function Small({ children, color }: { children: ReactNode; color?: string }) {
  return <Text style={[type.small, color ? { color } : null]}>{children}</Text>;
}

export function Card({ children, accent, style }: { children: ReactNode; accent?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, accent ? { borderColor: accent, borderWidth: 1.5 } : null, style]}>{children}</View>
  );
}

export function Money({ cents, size = "l", color }: { cents: number; size?: "s" | "m" | "l"; color?: string }) {
  const fontSize = size === "l" ? 28 : size === "m" ? 17 : 15;
  return <Text style={[type.money, { fontSize }, color ? { color } : null]}>{euros(cents)}</Text>;
}

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const color = kind === "danger" ? colors.bad : colors.cyan;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" ? { backgroundColor: color } : { borderColor: color, borderWidth: 1 },
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.buttonText, { color: kind === "primary" ? colors.bg : color }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, gap = space.s, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentOn]}
        >
          <Text style={[styles.segmentText, o.value === value && { color: colors.bg }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Bar({ ratio, color = colors.cyan, height = 8 }: { ratio: number; color?: string; height?: number }) {
  const width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` as const;
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Small>{label}</Small>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={numeric ? "decimal-pad" : "default"}
        style={styles.input}
      />
    </View>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

/** Pavé numérique intégré : pas de clavier système, saisie en quelques tapes. */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <View style={styles.keypad}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k === "⌫" ? "Effacer" : k === "," ? "Virgule" : k}
          onPress={() => onKey(k)}
          style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.panelHigh }]}
        >
          <Text style={styles.keyText}>{k}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.l, gap: space.l, paddingBottom: 120 },
  card: { backgroundColor: colors.panel, borderRadius: radius.m, padding: space.l, gap: space.s, borderColor: colors.line, borderWidth: 1 },
  button: { borderRadius: radius.m, paddingVertical: 14, paddingHorizontal: space.l, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "700" },
  chip: { borderRadius: radius.round, borderWidth: 1, borderColor: colors.line, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.panel },
  chipOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  chipText: { color: colors.text, fontSize: 14 },
  segmented: { flexDirection: "row", backgroundColor: colors.panel, borderRadius: radius.m, padding: 4, gap: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.s, alignItems: "center" },
  segmentOn: { backgroundColor: colors.cyan },
  segmentText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  barTrack: { backgroundColor: colors.line, overflow: "hidden" },
  input: { backgroundColor: colors.panel, borderRadius: radius.s, borderWidth: 1, borderColor: colors.line, color: colors.text, padding: space.m, fontSize: 16 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.s },
  key: { width: "31%", height: 56, borderRadius: radius.m, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  keyText: { color: colors.text, fontSize: 24, fontWeight: "600" },
});
