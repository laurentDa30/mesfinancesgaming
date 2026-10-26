import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { daysBetween } from "../../src/engine/dates.ts";
import { goalSaved, reserveBalance, reserveTarget } from "../../src/engine/finances.ts";
import { euros } from "../../src/engine/format.ts";
import { useAppState, useStore } from "../../src/data/AppStore.tsx";
import { parseAmount } from "../../src/logic/amount.ts";
import { deadlineIn } from "../../src/logic/drafts.ts";
import { shortDate } from "../../src/logic/today.ts";
import { Bar, Button, Card, Chip, Field, H2, Money, Row, Screen, Small, Title } from "../../src/ui/kit.tsx";
import { colors, space } from "../../src/ui/theme.ts";

const WEEKS = [3, 4, 6, 8, 12] as const;

/** Le Coffre : la réserve de sécurité et les objectifs, chacun dans sa poche. */
export default function Coffre() {
  const { today, dispatch } = useStore();
  const app = useAppState();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const f = app.finance;
  const reserve = reserveBalance(f, today);
  const target = reserveTarget(f, today);

  return (
    <Screen>
      <Title>Coffre</Title>

      <Card>
        <H2>Réserve de sécurité</H2>
        <Row>
          <Money cents={reserve} />
          <Small>{`sur ${euros(target)}`}</Small>
        </Row>
        <Bar ratio={target > 0 ? reserve / target : 1} color={colors.good} />
        <Small>
          {f.settings.reserveTarget === undefined
            ? "Cible : environ un mois de dépenses, 20 € minimum. Elle sert à encaisser un imprévu."
            : "Cible choisie par toi. Elle sert à encaisser un imprévu."}
        </Small>
        <Row>
          <View style={{ flex: 1 }}>
            <Button label="Mettre de côté" onPress={() => router.push({ pathname: "/saisie", params: { kind: "save" } })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Reprendre" kind="ghost" onPress={() => router.push({ pathname: "/saisie", params: { kind: "withdraw" } })} />
          </View>
        </Row>
      </Card>

      <H2>Objectifs</H2>
      {f.goals.length === 0 && !adding ? <Small>Un objectif, c'est une envie que tu prépares au lieu de la subir.</Small> : null}

      {f.goals.map((g) => {
        const saved = goalSaved(f, g.id, today);
        const daysLeft = daysBetween(today, g.deadline);
        const done = saved >= g.target;
        return (
          <Card key={g.id} accent={done ? colors.good : undefined}>
            <Row>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 }}>{g.label}</Text>
              <Small>{`${euros(saved)} / ${euros(g.target)}`}</Small>
            </Row>
            <Bar ratio={saved / g.target} color={done ? colors.good : colors.cyan} />
            <Small>
              {done
                ? "Objectif atteint."
                : daysLeft >= 0
                  ? `Échéance le ${shortDate(g.deadline)} · ${euros(Math.ceil((g.target - saved) / Math.max(1, Math.ceil(daysLeft / 7))))} par semaine pour y arriver`
                  : `Échéance dépassée (${shortDate(g.deadline)})`}
            </Small>
            <Row>
              <View style={{ flex: 1 }}>
                <Button label="Ajouter" kind="ghost" onPress={() => router.push({ pathname: "/saisie", params: { kind: "save", goalId: g.id } })} />
              </View>
              <View style={{ flex: 1 }}>
                {saved > 0 ? (
                  <Button label="Reprendre" kind="ghost" onPress={() => router.push({ pathname: "/saisie", params: { kind: "withdraw", goalId: g.id } })} />
                ) : (
                  <Button label="Supprimer" kind="danger" onPress={() => dispatch({ type: "removeGoal", id: g.id, today })} />
                )}
              </View>
            </Row>
          </Card>
        );
      })}

      {adding ? <GoalForm onDone={() => setAdding(false)} /> : <Button label="Nouvel objectif" kind="ghost" onPress={() => setAdding(true)} />}
    </Screen>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const { today, dispatch, newId } = useStore();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [weeks, setWeeks] = useState<number>(4);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const target = parseAmount(amount);
    if (!label.trim()) return setError("Donne un nom à ton objectif.");
    if (target === null) return setError("Indique un montant.");
    dispatch({ type: "addGoal", goal: { id: newId(), label: label.trim(), target, createdAt: today, deadline: deadlineIn(today, weeks) } });
    onDone();
  };

  return (
    <Card accent={colors.cyan}>
      <H2>Nouvel objectif</H2>
      <Field label="Quoi ?" value={label} onChangeText={setLabel} placeholder="Écouteurs, concert…" />
      <Field label="Combien (€) ?" value={amount} onChangeText={setAmount} placeholder="60" numeric />
      <Small>En combien de semaines ?</Small>
      <Row wrap>
        {WEEKS.map((w) => (
          <Chip key={w} label={`${w} sem.`} selected={weeks === w} onPress={() => setWeeks(w)} />
        ))}
      </Row>
      <Small>Un objectif tenu au moins 3 semaines rapporte de l'XP, quel que soit son montant.</Small>
      {error ? <Small color={colors.bad}>{error}</Small> : null}
      <Row>
        <View style={{ flex: 1 }}>
          <Button label="Annuler" kind="ghost" onPress={onDone} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Créer" onPress={save} />
        </View>
      </Row>
      <View style={{ height: space.xs }} />
    </Card>
  );
}
