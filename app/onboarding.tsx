import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { parts } from "../src/engine/dates.ts";
import type { Recurring, Settings } from "../src/engine/types.ts";
import type { Gender } from "../src/engine/xp.ts";
import { useStore } from "../src/data/AppStore.tsx";
import { parseAmount } from "../src/logic/amount.ts";
import { Button, Card, Field, H2, Screen, Segmented, Small, Title } from "../src/ui/kit.tsx";
import { colors, space } from "../src/ui/theme.ts";

const GENDERS = [
  { value: "f", label: "Opératrice" },
  { value: "m", label: "Opérateur" },
  { value: "n", label: "Opérateur·rice" },
] as const;

/** Premier lancement : trois questions, toutes modifiables plus tard. */
export default function Onboarding() {
  const { state, today, dispatch, newId } = useStore();
  const router = useRouter();
  const [gender, setGender] = useState<Gender>("n");
  const [balance, setBalance] = useState("");
  const [pocket, setPocket] = useState("");
  const [reserve, setReserve] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (state) return <Redirect href="/" />;

  const optional = (text: string): number | undefined | "invalid" => {
    if (text.trim() === "") return undefined;
    return parseAmount(text) ?? "invalid";
  };

  const start = () => {
    const opening = balance.trim() === "" || balance.trim() === "0" ? 0 : parseAmount(balance);
    const pocketAmount = optional(pocket);
    const reserveAmount = optional(reserve);
    const budgetAmount = optional(budget);
    if (opening === null || pocketAmount === "invalid" || reserveAmount === "invalid" || budgetAmount === "invalid") {
      setError("Un des montants n'est pas valide. Exemple : 12,50");
      return;
    }
    const settings: Settings = {
      openingBalance: opening,
      openingDate: today,
      ...(reserveAmount !== undefined ? { openingReserve: reserveAmount } : {}),
      ...(budgetAmount !== undefined ? { monthlyBudget: budgetAmount } : {}),
    };
    const recurrings: Recurring[] =
      pocketAmount !== undefined
        ? [
            {
              id: newId(),
              kind: "in",
              label: "Argent de poche",
              amount: pocketAmount,
              frequency: "monthly",
              // Le prochain versement : le 1er du mois suivant, modifiable dans Récurrents.
              startDate: nextFirst(today),
            },
          ]
        : [];
    dispatch({ type: "init", settings, profile: { gender }, recurrings });
    router.replace("/");
  };

  return (
    <Screen>
      <View style={{ gap: space.s, marginTop: space.xl }}>
        <Text style={{ color: colors.cyan, fontSize: 13, fontWeight: "700", letterSpacing: 2 }}>RÉSEAU NEXA</Text>
        <Title>Bienvenue, nouvelle recrue</Title>
        <Small>Tes données restent sur ce téléphone. Rien n'est envoyé ailleurs.</Small>
      </View>

      <Card>
        <H2>Comment t'appeler ?</H2>
        <Segmented options={GENDERS} value={gender} onChange={setGender} />
      </Card>

      <Card>
        <H2>Ton argent</H2>
        <Field label="Argent dont tu disposes aujourd'hui (€)" value={balance} onChangeText={setBalance} placeholder="0" numeric />
        <Field label="Argent de poche par mois (€), si tu en as" value={pocket} onChangeText={setPocket} placeholder="Facultatif" numeric />
      </Card>

      <Card>
        <H2>Pour aller plus loin</H2>
        <Field label="Argent déjà mis de côté (€)" value={reserve} onChangeText={setReserve} placeholder="Facultatif" numeric />
        <Field label="Budget par mois pour tes dépenses courantes (€)" value={budget} onChangeText={setBudget} placeholder="Facultatif" numeric />
        <Small>Tu pourras tout changer plus tard.</Small>
      </Card>

      {error ? <Small color={colors.bad}>{error}</Small> : null}
      <Button label="Entrer dans le réseau" onPress={start} />
    </Screen>
  );
}

function nextFirst(today: string): string {
  const { y, m } = parts(today);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}
