# Mes Finances Gaming

Application mobile de gestion budgétaire gamifiée pour les 15–20 ans. Le joueur est un **Opérateur** du réseau **Nexa** : il fait évoluer son avatar et son QG en apprenant à gérer son argent, et neutralise des **Glitchs** qui matérialisent de vrais mécanismes financiers.

Projet indépendant. Aucun code n'est partagé avec d'autres applications.

## Décisions de cadrage

| Sujet | Décision |
| --- | --- |
| Cible de lancement | 15–20 ans |
| Technologie | React Native + Expo, TypeScript |
| Données | Sans compte par défaut, tout reste sur le téléphone. Inscription facultative pour une sauvegarde chiffrée de bout en bout (le serveur ne peut pas la lire). |
| Supervision parentale | Aucune |
| Visuel | Avatar + QG en calques SVG 2D, univers Nexa |

## Les trois systèmes, séparés

1. **Finances réelles** (`finances.ts`) : rentrées, dépenses, abonnements, réserve, objectifs. Montants en centimes entiers.
2. **Santé financière** (`health.ts`) : note sur 100, calculée (jamais stockée), en 4 critères de 25 points. Tous sont des ratios, donc indépendants du niveau de revenu.
3. **XP et progression** (`xp.ts`) : rejoue des événements avec des plafonds. Elle lit les finances pour vérifier des comportements et ne les modifie jamais.

Les données circulent dans un seul sens : finances → santé et Glitchs → événements d'XP.

### Santé financière

| Critère | Mesure | 25 pts | 0 pt |
| --- | --- | --- | --- |
| Équilibre | Reste projeté à 30 jours ÷ rentrées | ≥ 10 % | < 0 |
| Anticipation | Disponible ÷ dépenses connues à 30 jours | ≥ 100 % | ≤ 50 % |
| Réserve | Réserve ÷ cible (1 mois de dépenses, 20 € minimum) | ≥ 100 % | 0 |
| Rythme | Dépenses courantes du mois projetées ÷ budget | dans le budget | ≥ +20 % |

- Une dépense **prévue** ne coûte rien en soi.
- Chaque critère renvoie une phrase d'explication.
- La jauge est « en calibrage » pendant les 14 premiers jours, ou tant qu'aucune rentrée n'est saisie.

### Glitchs (MVP)

| Glitch | Détection | Neutralisé quand… |
| --- | --- | --- |
| Le Siphon | ≥ 4 petites dépenses (≤ 5 €) d'une même catégorie en 30 jours, pour au moins 10 € et 10 % des rentrées | la catégorie baisse d'au moins 30 %, constaté après 21 jours minimum |
| La Boucle | abonnement déclaré inutilisé, ou sans réponse depuis 30 jours | une date de fin est saisie (supprimer la fiche ne suffit pas) |
| La Faille | dépense imprévue ≥ 15 € (et ≥ 15 % des rentrées) alors que la réserve est sous la moitié de sa cible | la réserve remonte à la moitié de sa cible |

### XP

| Source | XP | Garde-fou |
| --- | --- | --- |
| Connexion du jour | 4 | 1 par jour |
| Ravitaillement | 20 + 1 cosmétique | tous les 7 jours de connexion **cumulés**, récompenses fixes et annoncées, sans tirage |
| Saisie d'une opération | 2 | 10 XP par jour maximum, 1 fois par opération |
| Revue de la semaine | 20 | 1 par semaine ISO |
| Glitch neutralisé | 40 | 1 fois par Glitch, 2 par semaine maximum |
| Objectif tenu | 30 à 80 selon la durée | 21 jours minimum, montant ignoré |
| Mission | 15 à 50 | 1 fois chacune |
| Réserve en hausse 4 semaines d'affilée | 30 | quel que soit le montant ajouté |

Niveau n atteint à 100 × n^1,4 XP cumulés. Un test vérifie que connexion et Ravitaillement restent sous un tiers de l'XP d'un mois actif.

## Lancer les tests

Node 22.18 ou plus récent exécute le TypeScript directement, sans installation :

```bash
npm test
```

Pour la vérification de types :

```bash
npm install
npm run typecheck
```

## Lots de développement

1. ✅ Moteur de règles et tests (`src/engine`), sans interface.
2. Saisie et écrans financiers (app Expo).
3. Accueil, jauge, XP.
4. Glitchs et Modules (arbre de compétences).
5. Avatar + QG, mode simulation, projection adulte.
6. Test avec 10 à 15 testeurs pendant 3 semaines.
