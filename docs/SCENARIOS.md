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
node scripts/scenarios.js docs/mesures-apres.json
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
| S1 | 8 / 3 / 4 | 8 / 3 / 4 | — (prochaine itération) |
| S2 | 5 / 2 / 3 | **3** / 3 / 2 | Ajout rapide : bouton + toujours visible, établissements récents, autocomplétion, valeurs par défaut |
| S3 | 2 / 0 / 1 | 2 / 0 / 1 | — |
| S4 | 3 / 1 / 2 | 3 / 1 / 2 | — |
| S5 | 3 / 1 / 3 | 3 / 1 / 3 | — |
| S6 | 4 / 1 / 2 | 4 / 1 / 2 | — |
| S7 | 5 / 1 / 2 **bloqué** | 5 / 1 / 3 | Bug corrigé : le bouton « Créer » sortait de l'écran sur iPhone |
| S8 | 7 / 1 / 3 | **3** / 2 / 2 | Ajout rapide + pipeline mémorisé (« Terrain » pour un technicien) |

Sur ordinateur (1440 px), les chiffres sont identiques, à un écran près : la recherche s'ouvre en menu plutôt qu'en feuille.

## Notes

- **S8 et la mémoire du pipeline** : 3 interactions une fois que l'appareil a mémorisé « Terrain ». La toute première fois, il faut 1 tap de plus pour le choisir.
- **Recherche** : chaque mot tapé doit se retrouver dans le titre, l'organisation ou la ville (« érables rails »). Chaque résultat d'affaire affiche son établissement, puisque plusieurs affaires portent le même titre.
