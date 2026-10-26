import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addDays } from "../src/engine/dates.ts";
import { goalSaved, reserveBalance } from "../src/engine/finances.ts";
import { euros } from "../src/engine/format.ts";
import { CATEGORIES, CATEGORY_LABELS, type Category, type IncomeSource } from "../src/engine/types.ts";
import { useStore } from "../src/data/AppStore.tsx";
import { pressKey } from "../src/logic/amount.ts";
import { buildTransaction, INCOME_SOURCE_LABELS, type EntryDraft, type EntryKind } from "../src/logic/drafts.ts";
import { parseDayMonth, shortDate } from "../src/logic/today.ts";
import { Chip, Field, Keypad, Row, Screen, Segmented, Small } from "../src/ui/kit.tsx";
import { colors, radius, space } from "../src/ui/theme.ts";

const KINDS = [
  { value: "out", label: "Dépense" },
  { value: "in", label: "Rentrée" },
  { value: "save", label: "Côté" },
] as const;

const SOURCES: IncomeSource[] = ["poche", "job", "cadeau", "autre"];
type DateChoice = "today" | "yesterday" | "other";

/**
 * Saisie en 3 tapes : (1) le type, déjà sur « Dépense » par défaut,
 * (2) le montant au pavé, (3) la catégorie, qui enregistre directement.
 */
export default function Saisie() {
  const params = useLocalSearchParams<{ kind?: string; goalId?: string }>();
  const { state, today, dispatch, newId } = useStore();
  const router = useRouter();
  const initialKind: EntryKind =
    params.kind === "in" || params.kind === "save" || params.kind === "withdraw" ? params.kind : "out";
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const [amountText, setAmountText] = useState("");
  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [otherDate, setOtherDate] = useState("");
  const [planned, setPlanned] = useState(false);
  const [paidByRelative, setPaidByRelative] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) return null;
  const goals = state.finance.goals;

  const resolveDate = (): string | null => {
    if (dateChoice === "today") return today;
    if (dateChoice === "yesterday") return addDays(today, -1);
    return parseDayMonth(otherDate, today);
  };

  const submit = (extra: Partial<EntryDraft>) => {
    const date = resolveDate();
    if (!date) {
      setError("Date invalide. Exemple : 05/11");
      return;
    }
    const draft: EntryDraft = { kind, amountText, date, ...extra };
    if (kind === "out") {
      // Une dépense datée dans le futur est forcément prévue.
      if (planned || date > today) draft.planned = true;
      if (paidByRelative) draft.paidByRelative = true;
    }
    const result = buildTransaction(draft, newId());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dispatch({ type: "addTransaction", tx: result.value, today });
    router.back();
  };

  const pocketLabel = (goalId?: string) => {
    const amount = goalId ? goalSaved(state.finance, goalId, today) : reserveBalance(state.finance, today);
    return euros(amount);
  };

  return (
    <Screen>
      <Row>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Fermer</Text>
        </Pressable>
      </Row>

      {kind === "withdraw" ? (
        <Text style={styles.heading}>Reprendre de l'argent mis de côté</Text>
      ) : (
        <Segmented options={KINDS} value={kind as "out" | "in" | "save"} onChange={(k) => { setKind(k); setError(null); }} />
      )}

      <View style={styles.amountBox}>
        <Text style={[styles.amount, !amountText && { color: colors.muted }]}>{amountText || "0"} €</Text>
      </View>

      <Keypad onKey={(k) => { setAmountText((cur) => pressKey(cur, k)); setError(null); }} />

      <Row wrap>
        <Chip label="Aujourd'hui" selected={dateChoice === "today"} onPress={() => setDateChoice("today")} />
        <Chip label="Hier" selected={dateChoice === "yesterday"} onPress={() => setDateChoice("yesterday")} />
        <Chip label="Autre date" selected={dateChoice === "other"} onPress={() => setDateChoice("other")} />
      </Row>
      {dateChoice === "other" ? (
        <Field label="Date (JJ/MM)" value={otherDate} onChangeText={setOtherDate} placeholder={shortDate(today)} />
      ) : null}

      {error ? <Small color={colors.bad}>{error}</Small> : null}

      {kind === "out" ? (
        <View style={{ gap: space.m }}>
          <Row wrap>
            <Chip label="Dépense prévue" selected={planned} onPress={() => setPlanned((v) => !v)} />
            <Chip label="Payée par un proche" selected={paidByRelative} onPress={() => setPaidByRelative((v) => !v)} />
          </Row>
          <Small>Touche une catégorie pour enregistrer</Small>
          <View style={styles.grid}>
            {CATEGORIES.map((c: Category) => (
              <Tile key={c} label={CATEGORY_LABELS[c]} onPress={() => submit({ category: c })} />
            ))}
          </View>
        </View>
      ) : null}

      {kind === "in" ? (
        <View style={{ gap: space.m }}>
          <Small>D'où vient cet argent ? Touche pour enregistrer</Small>
          <View style={styles.grid}>
            {SOURCES.map((s) => (
              <Tile key={s} label={INCOME_SOURCE_LABELS[s]} onPress={() => submit({ source: s })} />
            ))}
          </View>
        </View>
      ) : null}

      {kind === "save" || kind === "withdraw" ? (
        <View style={{ gap: space.m }}>
          <Small>{kind === "save" ? "Où le mettre ? Touche pour enregistrer" : "Depuis où ? Touche pour enregistrer"}</Small>
          <View style={styles.grid}>
            <Tile label="Réserve" hint={pocketLabel()} onPress={() => submit({})} />
            {goals.map((g) => (
              <Tile key={g.id} label={g.label} hint={pocketLabel(g.id)} highlighted={params.goalId === g.id} onPress={() => submit({ goalId: g.id })} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function Tile({ label, hint, onPress, highlighted }: { label: string; hint?: string; onPress: () => void; highlighted?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, highlighted && { borderColor: colors.cyan }, pressed && { backgroundColor: colors.panelHigh }]}
    >
      <Text style={styles.tileText}>{label}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 18, fontWeight: "700" },
  amountBox: { alignItems: "center", paddingVertical: space.m },
  amount: { color: colors.text, fontSize: 44, fontWeight: "700", fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  tile: {
    width: "48%",
    minHeight: 56,
    borderRadius: radius.m,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    justifyContent: "center",
  },
  tileText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  tileHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
