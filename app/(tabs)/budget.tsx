import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { CATEGORY_LABELS } from "../../src/engine/types.ts";
import { euros } from "../../src/engine/format.ts";
import { useAppState, useStore } from "../../src/data/AppStore.tsx";
import { monthLabel, shiftMonth, shortDate } from "../../src/logic/today.ts";
import { groupByDay, monthView, type Line } from "../../src/logic/views.ts";
import { Card, Row, Screen, Small, Title } from "../../src/ui/kit.tsx";
import { colors, space } from "../../src/ui/theme.ts";

export default function Budget() {
  const { today, dispatch } = useStore();
  const app = useAppState();
  const [month, setMonth] = useState(today.slice(0, 7));
  const view = useMemo(() => monthView(app.finance, month), [app.finance, month]);
  const days = useMemo(() => groupByDay(view.lines), [view.lines]);
  const firstMonth = app.finance.settings.openingDate.slice(0, 7);

  const askDelete = (line: Line) => {
    if (line.origin !== "transaction") {
      Alert.alert("Opération récurrente", "Modifie-la depuis l'onglet Récurrents.");
      return;
    }
    Alert.alert("Supprimer cette opération ?", `${line.label} · ${euros(Math.abs(line.signed))}`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => dispatch({ type: "removeTransaction", id: line.refId }) },
    ]);
  };

  return (
    <Screen>
      <Row>
        <Arrow label="‹" disabled={month <= firstMonth} onPress={() => setMonth((m) => shiftMonth(m, -1))} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Title>{monthLabel(month)}</Title>
        </View>
        <Arrow label="›" disabled={month >= shiftMonth(today.slice(0, 7), 1)} onPress={() => setMonth((m) => shiftMonth(m, 1))} />
      </Row>

      <Card>
        <Row>
          <Total label="Rentrées" cents={view.totalIn} color={colors.good} />
          <Total label="Dépenses" cents={view.totalOut} color={colors.text} />
          <Total label="Mis de côté" cents={view.totalSaved} color={colors.violet} />
        </Row>
      </Card>

      {days.length === 0 ? <Small>Aucune opération ce mois-ci. Le bouton + sert à en ajouter.</Small> : null}

      {days.map((day) => (
        <View key={day.date} style={{ gap: space.s }}>
          <Small>{shortDate(day.date)}</Small>
          <Card>
            {day.lines.map((line) => (
              <Pressable key={line.key} onLongPress={() => askDelete(line)} accessibilityHint="Appui long pour supprimer">
                <Row>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15 }}>{line.label}</Text>
                    <Small>{describe(line)}</Small>
                  </View>
                  <Text
                    style={{
                      color: line.paidByRelative ? colors.muted : line.signed > 0 ? colors.good : colors.text,
                      fontSize: 15,
                      fontWeight: "600",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {line.paidByRelative ? "offert" : `${line.signed > 0 ? "+" : ""}${euros(line.signed)}`}
                  </Text>
                </Row>
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      {days.length > 0 ? <Small>Appui long sur une opération pour la supprimer.</Small> : null}
    </Screen>
  );
}

function describe(line: Line): string {
  const parts: string[] = [];
  if (line.category) parts.push(CATEGORY_LABELS[line.category]);
  if (line.origin === "recurring") parts.push("récurrent");
  if (line.planned) parts.push("prévue");
  if (line.kind === "save" || line.kind === "withdraw") parts.push(line.goalId ? "objectif" : "réserve");
  return parts.join(" · ");
}

function Total({ label, cents, color }: { label: string; cents: number; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Small>{label}</Small>
      <Text style={{ color, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{euros(cents)}</Text>
    </View>
  );
}

function Arrow({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={12} style={{ padding: space.s, opacity: disabled ? 0.25 : 1 }}>
      <Text style={{ color: colors.cyan, fontSize: 28, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
