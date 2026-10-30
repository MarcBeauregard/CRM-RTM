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
| 2 | À valider, Valider une intervention (clavier), Soumissions → Affaire | ✅ |
| 3 | Rapports (packs simulés), Accueil fusionné, recherche globale du parc | ✅ |
| 4 | Modèles, Marques, Pièces, fiche Modèle, Paramètres, Importer, Cartographie | ✅ |

## Tests (depuis `fusion/`)

```bash
node scripts/scenarios.js     # scénarios d'usage
node scripts/interactions.js  # glisser-déposer, fiches, clavier
node scripts/a11y.js          # cibles 44 px + contraste AA
node scripts/shots.js shots   # captures 390 / 1024 / 1440 / 2200, clair et sombre
```

## Mesures (iPhone 390 px / ordinateur 1440 px, interactions)

| # | Scénario | iPhone | Ordinateur |
|---|---|---|---|
| S1–S8 | Scénarios du CRM (voir `docs/SCENARIOS.md` à la racine) | ≤ 3 | ≤ 3 |
| S5 | Téléphone de l'acheteuse : maintenant par la recherche (« acheteuse érables ») | 2 | 2 |
| S9 | Décider d'une non-conformité (soumission requise) | 3 | 3 |
| S10 | Saisir une soumission dans Acomba → affaire « Soumission d'achat » | 4 | **2** |
| S11 | Trouver un équipement par son n° de série (recherche + Entrée) | 2 | 2 |
| S12 | Générer le pack de rapports d'un établissement (bouton sur la fiche) | 3 | 3 |
| S13 | Identifier le modèle d'un équipement (carte de l'accueil → choix en un tap) | 3 | 3 |

S10 se fait au bureau, là où Acomba est ouvert : 2 interactions sur ordinateur. Sur iPhone, Soumissions
passe par le menu « Plus » (4 interactions).

## Validation au clavier

Sur « Valider une intervention » : ← → précédent / suivant, 1 2 3 décision, E corriger le modèle,
Entrée enregistrer et passer au suivant, Échap revenir à la file. Sur iPhone, « Enregistrer » est
fixé en bas de l'écran et la barre d'onglets s'efface pendant la validation.

## Accueil fusionné et recherche

L'accueil garde « Ma journée » et les indicateurs de vente, avec une rangée **Parc** :
non-conformités à décider (« Reprendre · 3 sur 27 » si une validation est en cours), modèles à
identifier, soumissions à saisir, dernier rapport livré.

La recherche (`/` ou ⌘K) couvre aussi les établissements, les clients et les équipements : n° de série,
local (« 116 érables »), modèle ou type. Quand la recherche contient un chiffre, le parc passe avant les ventes.

## Référentiel et paramètres

- **Modèles** : grille avec photo de référence, filtre par type ; **fiche Modèle** avec noms reconnus
  (ajouter, retirer), clients qui l'ont, manuels (pièces, service), partage avec RailConfig, pièces liées.
- **Cartographie du manuel** : dessiner un rectangle sur la vue éclatée (souris, doigt ou stylet), le lier
  à une pièce, 2 pages. Le PDF est simulé par un dessin.
- **Marques** et **Pièces** (numéros identiques à Acomba ; « Mettre à jour depuis Acomba » simulé).
- **Paramètres** : équipe et rôles (Administrateur, Peut corriger les données, Lecture seule), techniciens
  terrain ; **Importer** en 4 étapes (fichier, colonnes, vérification, confirmation) : rien n'est créé avant
  la confirmation.

## Ce qui reste simulé dans ce prototype

Génération des PDF, téléchargement, manuels PDF, mise à jour depuis Acomba, envoi d'invitations, lecture
réelle du fichier Excel importé : dans la vraie app, ces actions passent par le back-office Next.js et Supabase.
