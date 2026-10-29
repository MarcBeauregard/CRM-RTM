# Scénarios d'usage — CRM RTM

Critère n° 1 : la facilité d'utilisation. Chaque changement doit réduire le nombre d'interactions
d'un de ces scénarios réels, mesuré par `scripts/scenarios.js` (Playwright).

**Comment on compte**
- **Interactions** : chaque tap, clic ou touche qui déclenche une action. Ouvrir puis choisir dans un menu natif iOS compte pour 2.
- **Champs** : chaque texte à taper (la frappe n'est pas comptée comme interaction).
- **Écrans** : chaque changement de vue, de fiche ou de formulaire.
- **Départ** : l'accueil, données fictives d'origine, chemin le plus court disponible.
- **Objectif** : 3 interactions ou moins sur iPhone (390 px).

```bash
node scripts/scenarios.js docs/mesures-apres.json   # les 8 scénarios
node scripts/interactions.js                         # glisser-déposer, fiches, clavier
```

## Les 8 scénarios

| # | Qui | Tâche |
|---|---|---|
| S1 | Vendeur, iPhone, dans l'auto après la visite | Noter ce qui s'est dit et planifier le suivi dans 2 semaines |
| S2 | Vendeur, iPhone | Créer une affaire pour un CHSLD existant (titre + valeur) |
| S3 | Tous | Voir ce que j'ai à faire aujourd'hui et cocher une activité |
| S4 | Vendeur | Faire passer une soumission à « À relancer » |
| S5 | Vendeur | Trouver le téléphone de l'acheteuse d'un établissement |
| S6 | Vendeur | Marquer une affaire perdue avec la raison |
| S7 | Marc-Étienne | Convertir une affaire gagnée en projet d'installation |
| S8 | Technicien, téléphone, avec des gants | Signaler un rail endommagé chez un client |

## Mesures — iPhone (390 px)

Interactions / champs / écrans. « Avant » = prototype du 29 oct. avant cette boucle.

| # | Avant | Après | Changement |
|---|---|---|---|
| S1 | 8 / 3 / 4 | **2** / 1 / 2 | « Ma journée » à l'accueil + suite proposée en cochant : note et suivi (demain, 1 sem., 2 sem., 1 mois) en un tap |
| S2 | 5 / 2 / 3 | **3** / 3 / 2 | Ajout rapide : bouton + toujours visible, établissements récents, autocomplétion, valeurs par défaut |
| S3 | 2 / 0 / 1 | **1** / 0 / 1 | « Ma journée » en tête de l'accueil sur iPhone : mes activités du jour par heure, puis en retard |
| S4 | 3 / 1 / 2 | 3 / 1 / 2 | Déjà à 3. Recherche multi-mots + établissement affiché sous chaque affaire pour choisir la bonne |
| S5 | 3 / 1 / 3 | 3 / 1 / 3 | Déjà à 3. La recherche trouve aussi les personnes par rôle (« acheteuse érables ») |
| S6 | 4 / 1 / 2 | **3** / 0 / 2 | Après l'appel, cocher l'activité propose aussi « Gagnée / Perdue » ; les raisons s'affichent dans la même feuille |
| S7 | 5 / 1 / 2 **bloqué** | **3** / 1 / 2 | Bouton « Créer le projet » sur l'affaire gagnée (et dans la confirmation « Affaire gagnée ») : bon tableau, première phase, liste de tâches standard. Bug iPhone du formulaire corrigé |
| S8 | 7 / 1 / 3 | **3** / 2 / 2 | Ajout rapide + pipeline mémorisé (« Terrain » pour un technicien) |

Sur ordinateur (1440 px), les chiffres sont identiques, à un écran près : la recherche s'ouvre en menu plutôt qu'en feuille.

## Notes

- **S6 depuis la recherche** : 4 interactions (rechercher, ouvrir, Perdue, raison). La raison est obligatoire et la fiche doit être ouverte : on ne descend pas sous 4 par ce chemin. Le chemin naturel (le client l'annonce pendant l'appel prévu) en prend 3.
- **Suite proposée** : elle n'apparaît que si l'affaire n'a plus rien de planifié, pour ne pas ralentir les simples cochages. Fermer la feuille garde la note tapée.

- **S8 et la mémoire du pipeline** : 3 interactions une fois que l'appareil a mémorisé « Terrain ». La toute première fois, il faut 1 tap de plus pour le choisir.
- **Recherche** : chaque mot tapé doit se retrouver dans le titre, l'organisation ou la ville (« érables rails »). Chaque résultat d'affaire affiche son établissement, puisque plusieurs affaires portent le même titre.

## Accessibilité

`node scripts/a11y.js` vérifie, sur l'accueil, Affaires, Projets, Activités et Organisations,
en clair et en sombre :

| Contrôle | Avant | Après |
|---|---|---|
| Cibles tactiles < 44 px sur iPhone | 70 | **0** (barre en 44 px ; zone de frappe étendue sur les pastilles, segments et cases) |
| Textes sous le contraste AA | 105 | **0** (gris secondaires et tertiaires, boutons pleins en mode sombre, initiales des avatars) |

Alternatives au glisser-déposer :
- **Toucher** : la barre d'étapes de la fiche (1 tap par étape).
- **Clavier** : ← / → sur une carte ciblée, avec Annuler.
- **VoiceOver** : chaque carte est un bouton qui annonce le titre, l'établissement, la valeur, l'étape et l'inactivité.

`prefers-reduced-motion` coupe les animations.

## Tests

```bash
node scripts/scenarios.js docs/mesures-apres.json   # 8 scénarios + variante S6b
node scripts/interactions.js                         # glisser-déposer, fiches, clavier (← → / N Échap)
node scripts/a11y.js                                 # 44 px + contraste AA
node scripts/shots.js shots                          # captures 390 / 1024 / 1440 / 2200, clair et sombre
```

## Pistes non retenues (aucun scénario ne les justifie encore)

- **Raccourcis J/K/E et aide « ? »** : seuls N, / et ← → sont en place. À revoir si Marc-Étienne travaille surtout au clavier.
- **Glisser une ligne pour la reporter (geste iOS)** : la suite proposée couvre le cas. À ajouter si les vendeurs reportent souvent sans rien noter.
- **Édition en place de la valeur ou de la date** : aucun des 8 scénarios n'en a besoin. À ajouter si un scénario « corriger le montant d'une soumission » s'avère fréquent.
