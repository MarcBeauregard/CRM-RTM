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
| S4 | 3 / 1 / 2 | 3 / 1 / 2 | — |
| S5 | 3 / 1 / 3 | 3 / 1 / 3 | — |
| S6 | 4 / 1 / 2 | **3** / 0 / 2 | Après l'appel, cocher l'activité propose aussi « Gagnée / Perdue » ; les raisons s'affichent dans la même feuille |
| S7 | 5 / 1 / 2 **bloqué** | **3** / 1 / 2 | Bouton « Créer le projet » sur l'affaire gagnée (et dans la confirmation « Affaire gagnée ») : bon tableau, première phase, liste de tâches standard. Bug iPhone du formulaire corrigé |
| S8 | 7 / 1 / 3 | **3** / 2 / 2 | Ajout rapide + pipeline mémorisé (« Terrain » pour un technicien) |

Sur ordinateur (1440 px), les chiffres sont identiques, à un écran près : la recherche s'ouvre en menu plutôt qu'en feuille.

## Notes

- **S6 depuis la recherche** : 4 interactions (rechercher, ouvrir, Perdue, raison). La raison est obligatoire et la fiche doit être ouverte : on ne descend pas sous 4 par ce chemin. Le chemin naturel (le client l'annonce pendant l'appel prévu) en prend 3.
- **Suite proposée** : elle n'apparaît que si l'affaire n'a plus rien de planifié, pour ne pas ralentir les simples cochages. Fermer la feuille garde la note tapée.

- **S8 et la mémoire du pipeline** : 3 interactions une fois que l'appareil a mémorisé « Terrain ». La toute première fois, il faut 1 tap de plus pour le choisir.
- **Recherche** : chaque mot tapé doit se retrouver dans le titre, l'organisation ou la ville (« érables rails »). Chaque résultat d'affaire affiche son établissement, puisque plusieurs affaires portent le même titre.
