import { useMemo } from "react";
import { Text, View } from "react-native";
import { available, reserveBalance, sum, upcoming } from "../../src/engine/finances.ts";
import { computeHealth } from "../../src/engine/health.ts";
import { computeProgress } from "../../src/engine/xp.ts";
import { useAppState, useStore } from "../../src/data/AppStore.tsx";
import { shortDate } from "../../src/logic/today.ts";
import { Bar, Card, H2, Money, Row, Screen, Small, Title } from "../../src/ui/kit.tsx";
import { colors, space } from "../../src/ui/theme.ts";

/** Accueil du lot 2 : les chiffres justes. La mise en scène (avatar, QG, missions) arrive au lot 3. */
export default function Accueil() {
  const { today } = useStore();
  const app = useAppState();
  const f = app.finance;

  const data = useMemo(() => {
    const coming = upcoming(f, today, 30);
    return {
      cash: available(f, today),
      reserve: reserveBalance(f, today),
      coming,
      comingTotal: sum(coming.map((c) => c.amount)),
      health: computeHealth(f, today),
      progress: computeProgress(app.events, app.profile.gender),
    };
  }, [f, app.events, app.profile.gender, today]);

  const { health, progress } = data;
  const healthColor = health.score === null || health.calibrating ? colors.muted : health.score >= 70 ? colors.good : health.score >= 40 ? colors.warn : colors.bad;
  const levelSpan = progress.nextLevelAt - progress.levelStartsAt;

  return (
    <Screen>
      <View style={{ gap: space.s }}>
        <Row>
          <Title>{`Niv. ${progress.level} · ${progress.title}`}</Title>
        </Row>
        <Bar ratio={(progress.total - progress.levelStartsAt) / levelSpan} color={colors.violet} height={6} />
        <Small>{`${progress.total} XP · Ravitaillement dans ${progress.nextRavitaillementIn} connexion${progress.nextRavitaillementIn > 1 ? "s" : ""}`}</Small>
      </View>

      <Card>
        <Row>
          <View style={{ flex: 1, gap: space.xs }}>
            <Small>Disponible</Small>
            <Money cents={data.cash} color={data.cash < 0 ? colors.bad : undefined} />
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Small>Réserve</Small>
            <Money cents={data.reserve} size="m" />
          </View>
        </Row>
      </Card>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <H2>Santé financière</H2>
          </View>
          <Text style={{ color: healthColor, fontSize: 17, fontWeight: "700" }}>
            {health.calibrating || health.score === null ? "En calibrage" : `${health.score} / 100`}
          </Text>
        </Row>
        {health.score !== null ? <Bar ratio={health.score / 100} color={healthColor} /> : null}
        {health.calibrating ? (
          <Small>La jauge devient fiable après 2 semaines de saisie et au moins une rentrée.</Small>
        ) : null}
        <View style={{ gap: space.s, marginTop: space.xs }}>
          {health.criteria.map((c) => (
            <View key={c.id} style={{ gap: 2 }}>
              <Row>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 }}>{c.label}</Text>
                <Small>{c.points === null ? "—" : `${Math.round(c.points)} / ${c.max}`}</Small>
              </Row>
              <Small>{c.explanation}</Small>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <H2>À venir sur 30 jours</H2>
          </View>
          <Money cents={data.comingTotal} size="s" />
        </Row>
        {data.coming.length === 0 ? <Small>Aucune dépense prévue.</Small> : null}
        {data.coming.slice(0, 5).map((c) => (
          <Row key={`${c.refId}@${c.date}`}>
            <Small>{shortDate(c.date)}</Small>
            <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{c.label}</Text>
            <Money cents={c.amount} size="s" />
          </Row>
        ))}
        {data.coming.length > 5 ? <Small>{`+ ${data.coming.length - 5} autres`}</Small> : null}
      </Card>
    </Screen>
  );
}
