import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { isActive, monthlyEquivalent } from "../../src/engine/finances.ts";
import { euros } from "../../src/engine/format.ts";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Frequency, type Recurring } from "../../src/engine/types.ts";
import { useAppState, useStore } from "../../src/data/AppStore.tsx";
import { buildRecurring } from "../../src/logic/drafts.ts";
import { parseDayMonth, shortDate } from "../../src/logic/today.ts";
import { nextOccurrence } from "../../src/logic/views.ts";
import { Button, Card, Chip, Field, H2, Row, Screen, Segmented, Small, Title } from "../../src/ui/kit.tsx";
import { colors, space } from "../../src/ui/theme.ts";

const FREQ_LABELS: Record<Frequency, string> = { weekly: "par semaine", monthly: "par mois", yearly: "par an" };

export default function Recurrents() {
  const { today, dispatch } = useStore();
  const app = useAppState();
  const [adding, setAdding] = useState(false);
  const recs = app.finance.recurrings;
  const active = recs.filter((r) => isActive(r, today) || r.startDate > today);
  const ended = recs.filter((r) => r.endDate !== undefined && r.endDate < today);
  const incomes = active.filter((r) => r.kind === "in");
  const outs = active.filter((r) => r.kind === "out");
  const monthlyOut = outs.reduce((s, r) => s + monthlyEquivalent(r), 0);

  const cancel = (r: Recurring) =>
    Alert.alert(`Arrêter « ${r.label} » ?`, "Plus aucune échéance ne sera comptée après aujourd'hui.", [
      { text: "Annuler", style: "cancel" },
      { text: "Arrêter", style: "destructive", onPress: () => dispatch({ type: "endRecurring", id: r.id, endDate: today }) },
    ]);

  return (
    <Screen>
      <Title>Récurrents</Title>
      <Small>{`Tes dépenses qui reviennent coûtent ${euros(monthlyOut)} par mois.`}</Small>

      {adding ? (
        <AddForm onDone={() => setAdding(false)} />
      ) : (
        <Button label="Ajouter un récurrent" kind="ghost" onPress={() => setAdding(true)} />
      )}

      <Section title="Rentrées" items={incomes} today={today} onCancel={cancel} />
      <Section
        title="Dépenses et abonnements"
        items={outs}
        today={today}
        onCancel={cancel}
        onUsed={(r, used) => dispatch({ type: "setSubscriptionUsed", id: r.id, used })}
      />

      {ended.length > 0 ? (
        <Card>
          <H2>Arrêtés</H2>
          {ended.map((r) => (
            <Small key={r.id}>{`${r.label} · arrêté le ${shortDate(r.endDate as string)}`}</Small>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  items,
  today,
  onCancel,
  onUsed,
}: {
  title: string;
  items: Recurring[];
  today: string;
  onCancel: (r: Recurring) => void;
  onUsed?: (r: Recurring, used: boolean) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <H2>{title}</H2>
      {items.map((r) => {
        const next = nextOccurrence(r, today);
        return (
          <View key={r.id} style={{ gap: space.s, paddingVertical: space.s, borderTopColor: colors.line, borderTopWidth: 1 }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{r.label}</Text>
                <Small>{`${euros(r.amount)} ${FREQ_LABELS[r.frequency]}${next ? ` · prochaine le ${shortDate(next)}` : ""}${r.isSubscription ? " · abonnement" : ""}`}</Small>
              </View>
              <Text onPress={() => onCancel(r)} style={{ color: colors.bad, fontSize: 14 }} accessibilityRole="button">
                Arrêter
              </Text>
            </Row>
            {r.isSubscription && onUsed ? (
              <Row wrap>
                <Small>Tu t'en sers ?</Small>
                <Chip label="Oui" selected={r.used === true} onPress={() => onUsed(r, true)} />
                <Chip label="Non" selected={r.used === false} onPress={() => onUsed(r, false)} />
              </Row>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const KIND_OPTIONS = [
  { value: "out", label: "Dépense" },
  { value: "in", label: "Rentrée" },
] as const;
const FREQ_OPTIONS = [
  { value: "weekly", label: "Semaine" },
  { value: "monthly", label: "Mois" },
  { value: "yearly", label: "An" },
] as const;

function AddForm({ onDone }: { onDone: () => void }) {
  const { today, dispatch, newId } = useStore();
  const [kind, setKind] = useState<"in" | "out">("out");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [category, setCategory] = useState<Category | undefined>();
  const [isSubscription, setIsSubscription] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const startDate = nextDate.trim() === "" ? today : parseDayMonth(nextDate, today);
    if (!startDate) {
      setError("Date invalide. Exemple : 05/11");
      return;
    }
    const result = buildRecurring(
      { kind, label, amountText: amount, frequency, startDate, ...(category ? { category } : {}), isSubscription },
      newId(),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dispatch({ type: "addRecurring", rec: result.value });
    onDone();
  };

  return (
    <Card accent={colors.cyan}>
      <H2>Nouveau récurrent</H2>
      <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
      <Field label="Nom" value={label} onChangeText={setLabel} placeholder={kind === "out" ? "Forfait, appli musique…" : "Argent de poche…"} />
      <Field label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="4,99" numeric />
      <Segmented options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} />
      <Field label="Prochaine échéance (JJ/MM), aujourd'hui si vide" value={nextDate} onChangeText={setNextDate} placeholder={shortDate(today)} />
      {kind === "out" ? (
        <>
          <Row wrap>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={CATEGORY_LABELS[c]} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </Row>
          <Row wrap>
            <Chip label="C'est un abonnement" selected={isSubscription} onPress={() => setIsSubscription((v) => !v)} />
          </Row>
        </>
      ) : null}
      {error ? <Small color={colors.bad}>{error}</Small> : null}
      <Row>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" kind="ghost" onPress={onDone} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Ajouter" onPress={save} />
        </View>
      </Row>
    </Card>
  );
}
