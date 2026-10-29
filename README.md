# CRM RTM — prototype

Prototype local d'un CRM maison pour RTM Médical, pour remplacer Pipedrive.
Il reprend les modules **Affaires** et **Projets** de Pipedrive, et ajoute des fiches
d'organisations et de personnes qui pourront être partagées avec les autres applications RTM
(et, plus tard, synchronisées avec Acomba).

**Données fictives.** Les pipelines et leurs étapes reprennent la structure Pipedrive actuelle ;
toutes les affaires, organisations, personnes et projets sont inventés (`js/data.js`, graine fixe).
Les modifications (glisser une affaire, cocher une tâche, ajouter une note) restent dans le
`localStorage` du navigateur. Menu « ⋯ » → *Réinitialiser les données* pour repartir à zéro.

## Ouvrir

Aucune installation : ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python3 -m http.server 8080
```

puis http://localhost:8080.

## Fonctions

| Module | Pipedrive | Prototype |
|---|---|---|
| Affaires | Pipeline kanban, liste, prévisions, gagnée/perdue, affaires inactives, activités | Les 5 pipelines RTM, glisser-déposer (souris et tactile), zone Gagnée / Perdue pendant le glisser, liste triable, prévisions par mois, fiche avec étapes cliquables, notes, activités, historique |
| Projets | Tableaux, phases, tâches, plan | Tableaux *Installations* et *Entretien préventif*, kanban par phase, liste, chronologie (Gantt), fiche avec tâches et affaire liée |
| Activités | Liste à faire / terminées | Groupées : en retard, aujourd'hui, demain, cette semaine, plus tard |
| Contacts | Organisations, personnes | Fiches avec code client Acomba, lits, lève-personnes, contacts, affaires et projets |

Recherche globale (⌘K), filtre par responsable, thème clair / sombre / automatique,
mise en page ordinateur, tablette (barre latérale réduite) et téléphone (barre d'onglets).

## Design

Inspiré des apps Apple (HIG) : police système, couleurs système, surfaces pleines sans contours,
matériau translucide pour le chrome flottant. Base : `railconfig/design-kit/APPLE.md` et les règles
du skill *dashboard-design* (une couleur d'action, couleur réservée aux problèmes, aucun texte
explicatif hors infobulles).

## Captures de contrôle

```bash
npm i -D playwright   # ou une installation globale
node scripts/shots.js shots
```
