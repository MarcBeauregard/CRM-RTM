# Bureau RTM Médical — fusion CRM + back-office (environnement de test)

Copie de travail qui greffe les maquettes « V2 · Site complet » du back-office RTM Rapports
(toile « Maquettes tableau de bord RTM ») sur le prototype CRM, au style et à la typographie du CRM.
Le CRM seul reste à la racine du dépôt, inchangé.

**Données fictives, 100 % local.** Rien ne se connecte à Supabase ni à la production. Les modifications
restent dans le `localStorage` du navigateur (clé distincte du CRM seul).

## Modèle

Client (CISSS, CIUSSS, groupe privé) → Établissements (les anciennes « Organisations » du CRM, avec leurs
affaires, projets et contacts) → Locaux → Équipements → Interventions. Référentiels : modèles, marques,
pièces, techniciens. Une soumission saisie dans Acomba crée ou fait avancer une affaire « Soumission d'achat ».

## Navigation

Accueil · **Ventes** (Affaires, Projets, Activités) · **Parc** (Clients, À valider, Soumissions, Rapports)
· **Référentiel** (Modèles, Marques, Pièces) · Personnes · Paramètres.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Données, navigation, Clients, fiche Client, fiche Établissement, fiche Équipement | ✅ |
| 2 | À valider, Valider une intervention (clavier), Soumissions → Affaire | à venir |
| 3 | Rapports (packs simulés), Accueil fusionné, recherche globale du parc | à venir |
| 4 | Modèles, Marques, Pièces, fiche Modèle, Paramètres, Importer, Cartographie | à venir |

## Tests (depuis `fusion/`)

```bash
node scripts/scenarios.js     # scénarios d'usage
node scripts/interactions.js  # glisser-déposer, fiches, clavier
node scripts/a11y.js          # cibles 44 px + contraste AA
node scripts/shots.js shots   # captures 390 / 1024 / 1440 / 2200, clair et sombre
```
