/* Données fictives — CRM RTM (prototype local).
 * Les pipelines et leurs étapes reprennent la structure Pipedrive actuelle de RTM Médical ;
 * toutes les affaires, organisations, personnes et projets sont inventés.
 * Générateur à graine fixe : mêmes données à chaque chargement. */
(function () {
  'use strict';

  let seed = 20261029;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;

  const TODAY = new Date(2026, 9, 29); // 29 oct. 2026
  const day = 86400000;
  const iso = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const addDays = (n) => iso(new Date(TODAY.getTime() + n * day));

  const users = [
    { id: 1, name: 'Marc-Étienne Beauregard', short: 'Marc-Étienne', initials: 'MB', hue: 211 },
    { id: 2, name: 'Julie Tremblay', short: 'Julie', initials: 'JT', hue: 340 },
    { id: 3, name: 'Olivier Gagnon', short: 'Olivier', initials: 'OG', hue: 160 },
    { id: 4, name: 'Sophie Lavoie', short: 'Sophie', initials: 'SL', hue: 28 },
    { id: 5, name: 'Antoine Bélanger', short: 'Antoine', initials: 'AB', hue: 268 },
  ];

  const pipelines = [
    { id: 1, name: 'Vente', stages: [
      { id: 1, name: 'Lead', rot: 7 },
      { id: 12, name: 'Informations en attente', rot: 7 },
      { id: 3, name: 'À soumissionner', rot: 3 },
      { id: 62, name: 'Validation avant envoi', rot: 2 },
      { id: 13, name: 'À relancer', rot: 7 },
      { id: 61, name: 'Toujours en cours', rot: 30 },
      { id: 2, name: 'À classer', rot: 14 },
    ] },
    { id: 7, name: "Soumission d'achat", stages: [
      { id: 71, name: 'Soumission envoyée', rot: 10 },
      { id: 72, name: 'Relancée', rot: 10 },
      { id: 73, name: '2e relance', rot: 10 },
      { id: 74, name: 'Acceptée', rot: 14 },
      { id: 75, name: 'Attente de commande', rot: 21 },
      { id: 76, name: 'Livré au client', rot: 30 },
      { id: 77, name: 'Suivi après service', rot: 30 },
    ] },
    { id: 9, name: 'Entretien et TDC', stages: [
      { id: 91, name: 'Soumission envoyée', rot: 10 },
      { id: 92, name: 'Relancée', rot: 10 },
      { id: 93, name: '2e relance', rot: 10 },
      { id: 94, name: 'Acceptée — attente PO', rot: 14 },
      { id: 95, name: 'Planification', rot: 14 },
      { id: 96, name: 'En cours', rot: 30 },
      { id: 97, name: 'Terminé — facturation', rot: 7 },
      { id: 98, name: 'Facturé + satisfaction', rot: 30 },
    ] },
    { id: 6, name: 'Montérégie', stages: [
      { id: 33, name: 'Client', rot: 30 },
      { id: 34, name: 'Prise de contact', rot: 14 },
      { id: 35, name: 'Démo programmée', rot: 14 },
      { id: 36, name: 'Proposition', rot: 14 },
      { id: 37, name: 'Négociation', rot: 14 },
    ] },
    { id: 10, name: 'Opportunités terrain', stages: [
      { id: 101, name: 'Nouvelle opportunité', rot: 7 },
      { id: 102, name: 'Contact établi', rot: 10 },
      { id: 103, name: 'Soumission envoyée', rot: 10 },
      { id: 104, name: 'Suivi / négociation', rot: 14 },
    ] },
  ];

  const regions = ['Montréal', 'Laval', 'Montérégie', 'Laurentides', 'Lanaudière', 'Capitale-Nationale', 'Estrie', 'Mauricie', 'Outaouais'];
  const villes = {
    'Montréal': ['Montréal', 'Verdun', 'Saint-Laurent', 'Anjou'], 'Laval': ['Laval'], 'Montérégie': ['Longueuil', 'Saint-Hyacinthe', 'Granby', 'Châteauguay', 'Brossard'],
    'Laurentides': ['Saint-Jérôme', 'Mirabel', 'Sainte-Agathe'], 'Lanaudière': ['Joliette', 'Repentigny', 'Terrebonne'],
    'Capitale-Nationale': ['Québec', 'Lévis', 'Beauport'], 'Estrie': ['Sherbrooke', 'Magog'], 'Mauricie': ['Trois-Rivières', 'Shawinigan'], 'Outaouais': ['Gatineau'],
  };
  const orgSeeds = [
    ['CHSLD des Érables', 'CHSLD'], ['CHSLD Jardins du Fleuve', 'CHSLD'], ['Hôpital Sainte-Claire', 'Hôpital'], ['Centre hospitalier du Littoral', 'Hôpital'],
    ['Résidence Le Belvédère', 'RPA'], ['Résidence Les Trois Pignons', 'RPA'], ['CHSLD Saint-Ambroise', 'CHSLD'], ['Maison des Aînés de la Rivière', 'Maison des aînés'],
    ['Centre de réadaptation Horizon', 'Réadaptation'], ['CLSC de la Vallée', 'CLSC'], ['Hôpital régional du Nord', 'Hôpital'], ['CHSLD Pierre-Lemoyne', 'CHSLD'],
    ['Résidence Cap-Soleil', 'RPA'], ['Maison des Aînés Boisé-Vert', 'Maison des aînés'], ['CHSLD Marguerite-Bourg', 'CHSLD'], ['Centre de santé Haute-Ville', 'Hôpital'],
    ['Résidence Domaine du Parc', 'RPA'], ['CHSLD Les Peupliers', 'CHSLD'], ['Institut de gériatrie Rive-Sud', 'Hôpital'], ['Centre d’hébergement Saint-Joseph', 'CHSLD'],
    ['Maison des Aînés Lac-Clair', 'Maison des aînés'], ['Résidence Le Chantecler', 'RPA'], ['Centre de réadaptation L’Envol', 'Réadaptation'], ['CHSLD Vallée-des-Roses', 'CHSLD'],
    ['Hôpital de la Montagne', 'Hôpital'], ['Résidence Bord-de-l’Eau', 'RPA'], ['CLSC du Plateau-Est', 'CLSC'], ['CHSLD Champlain-Nord', 'CHSLD'],
  ];
  const rues = ['rue Principale', 'boul. Saint-Laurent', 'rue des Pins', 'avenue du Parc', 'rue Notre-Dame', 'boul. Taschereau', 'rue King Ouest', 'chemin du Lac', 'rue Sherbrooke Est', 'boul. Labelle'];

  const orgs = orgSeeds.map(([name, type], i) => {
    const region = pick(regions);
    return {
      id: 100 + i, name, type, region, ville: pick(villes[region]),
      adresse: `${int(12, 9800)} ${pick(rues)}`,
      telephone: `${pick(['450', '514', '819', '418', '579'])} ${int(200, 989)}-${String(int(0, 9999)).padStart(4, '0')}`,
      lits: type === 'RPA' ? int(60, 240) : type === 'Hôpital' ? int(180, 650) : int(48, 220),
      leves: int(4, 60), owner: pick(users).id,
      acomba: `C${String(int(1000, 9999))}`,
      clientDepuis: rnd() < 0.75 ? 2008 + int(0, 17) : null,
    };
  });

  const prenoms = ['Isabelle', 'Martin', 'Nathalie', 'François', 'Caroline', 'Éric', 'Mélanie', 'Patrick', 'Geneviève', 'Stéphane', 'Valérie', 'Sylvain', 'Annie', 'Mathieu', 'Chantal', 'Louis', 'Karine', 'Jean-François', 'Émilie', 'Daniel', 'Véronique', 'Alexandre', 'Josée', 'Simon', 'Marie-Claude', 'Benoît', 'Catherine', 'Yannick'];
  const noms = ['Côté', 'Bouchard', 'Gauthier', 'Morin', 'Fortin', 'Pelletier', 'Bergeron', 'Lévesque', 'Girard', 'Simard', 'Ouellet', 'Caron', 'Paquette', 'Gagné', 'Nadeau', 'Dubé', 'Leblanc', 'Poirier', 'Lapointe', 'Boucher', 'Cloutier', 'Demers'];
  const roles = ['Chef de service — soins', 'Conseillère en prévention SST', 'Directeur des services techniques', 'Acheteuse principale', 'Coordonnateur — installations matérielles', 'Ergothérapeute', 'Gestionnaire immobilier', 'Directrice générale', 'Technicien en génie biomédical', 'Agente d’approvisionnement'];
  const persons = [];
  orgs.forEach((o) => {
    const n = int(1, 3);
    for (let k = 0; k < n; k++) {
      const p = pick(prenoms), nm = pick(noms);
      persons.push({
        id: 500 + persons.length, name: `${p} ${nm}`, first: p, orgId: o.id, role: pick(roles),
        email: `${p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')}.${nm.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')}@${o.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '').slice(0, 14)}.qc.ca`,
        telephone: `${o.telephone.slice(0, 3)} ${int(200, 989)}-${String(int(0, 9999)).padStart(4, '0')}`,
        poste: rnd() < 0.5 ? String(int(1000, 7999)) : null,
      });
    }
  });

  const dealTitles = {
    1: ['Lève-personnes sur rail — {n} chambres', 'Remplacement de lève-personnes mobiles', 'Rails de plafond aile {a}', 'Demande d’info — système en H', 'Soumission civières-douche', 'Ajout de rails — unité prothétique'],
    7: ['Achat {n} moteurs Guldmann GH3', 'Achat toiles de transfert ({n})', 'Lève-personne mobile Arjo — {n} unités', 'Achat chargeurs muraux', 'Remplacement moteurs aile {a}', 'Fauteuils de transfert ({n})'],
    9: ['Contrat d’entretien préventif 2027', 'Inspection annuelle des toiles', 'Entretien {n} lève-personnes', 'TDC — certification des rails', 'Programme d’inspection semestriel', 'Réparation et entretien aile {a}'],
    6: ['Démonstration système Handicare', 'Projet pilote — {n} chambres', 'Renouvellement de parc — Rive-Sud', 'Formation PDSB + équipement'],
    10: ['Rail endommagé — chambre {n}', 'Opportunité signalée par tech — aile {a}', 'Remplacement de sangles usées', 'Ajout de chargeur — poste {a}'],
  };
  const ailes = ['A', 'B', 'C', 'Est', 'Ouest', 'Nord', '2e étage', '3e étage'];
  const lostReasons = ['Prix trop élevé', 'Compétiteur choisi', 'Budget reporté', 'Aucune réponse', 'Projet annulé'];
  const actTypes = ['appel', 'reunion', 'tache', 'courriel', 'visite'];
  const actLabels = {
    appel: ['Appel de suivi', 'Relance téléphonique', 'Appel — confirmer budget'],
    reunion: ['Rencontre sur place', 'Présentation de la soumission', 'Réunion de démarrage'],
    tache: ['Préparer la soumission', 'Valider les mesures', 'Envoyer le devis révisé', 'Commander pièces'],
    courriel: ['Envoyer la fiche technique', 'Courriel de relance', 'Confirmer la date de visite'],
    visite: ['Visite technique', 'Relevé des plafonds', 'Démonstration sur place'],
  };

  const deals = [];
  const activities = [];
  const notes = [];
  let dealId = 1000, actId = 1;

  function makeDeal(pl, status, closeOffset) {
    const st = pick(pl.stages);
    const org = pick(orgs);
    const orgPersons = persons.filter((p) => p.orgId === org.id);
    const tpl = pick(dealTitles[pl.id]);
    const title = tpl.replace('{n}', int(2, 24)).replace('{a}', pick(ailes));
    const big = rnd() < 0.12;
    const base = pl.id === 9 ? int(2, 26) * 1000 : pl.id === 7 ? int(2, 38) * 1000 : pl.id === 10 ? int(6, 80) * 100 : big ? int(80, 190) * 1000 : int(4, 70) * 1000;
    const created = -int(5, 200);
    const d = {
      id: dealId++, title, pipelineId: pl.id, stageId: st.id, orgId: org.id,
      personId: orgPersons.length ? pick(orgPersons).id : null,
      ownerId: rnd() < 0.42 ? 1 : pick(users).id,
      value: Math.round(base / 50) * 50, status,
      created: addDays(created),
      stageChanged: addDays(Math.max(created, rnd() < 0.14 ? -(st.rot + int(2, 28)) : -int(0, st.rot))),
      expectedClose: addDays(int(-10, 120)),
      probability: null, lostReason: null, closeDate: null,
      soumission: rnd() < 0.6 ? `S-26-${String(int(100, 999))}` : null,
      labels: rnd() < 0.18 ? ['Chaud'] : rnd() < 0.1 ? ['Appel d’offres'] : [],
    };
    if (status !== 'open') {
      d.closeDate = addDays(closeOffset);
      d.stageId = pl.stages[pl.stages.length - 1].id;
      if (status === 'lost') d.lostReason = pick(lostReasons);
    }
    deals.push(d);

    // Activités : passées (faites) + une prochaine (planifiée, parfois en retard, parfois aucune).
    const past = int(0, 3);
    for (let k = 0; k < past; k++) {
      const t = pick(actTypes);
      activities.push({ id: actId++, dealId: d.id, type: t, subject: pick(actLabels[t]), due: addDays(-int(1, 60)), time: `${String(int(8, 16)).padStart(2, "0")}:${pick(['00', '15', '30', '45'])}`, done: true, ownerId: d.ownerId });
    }
    if (status === 'open') {
      const r = rnd();
      if (r < 0.82) {
        const t = pick(actTypes);
        const off = r < 0.07 ? -int(1, 9) : r < 0.16 ? 0 : int(1, 21);
        activities.push({ id: actId++, dealId: d.id, type: t, subject: pick(actLabels[t]), due: addDays(off), time: `${String(int(8, 16)).padStart(2, "0")}:${pick(['00', '15', '30', '45'])}`, done: false, ownerId: d.ownerId });
      }
    }
    if (rnd() < 0.55) {
      notes.push({ id: notes.length + 1, dealId: d.id, date: addDays(-int(0, 30)), authorId: d.ownerId, text: pick([
        'Le client souhaite une installation avant la période des Fêtes. Accès aux chambres possible les mardis et jeudis.',
        'Budget confirmé par la direction. Attendre le bon de commande du service des approvisionnements.',
        'Plafonds en béton dans l’aile ancienne — prévoir ancrages chimiques et un relevé supplémentaire.',
        'Compétiteur présent sur l’appel d’offres. Mettre en avant le service d’entretien local et le délai.',
        'Demande d’ajouter 2 chargeurs muraux à la soumission initiale.',
        'Client satisfait de la dernière inspection. Ouvert à un contrat pluriannuel.',
      ]) });
    }
    return d;
  }

  pipelines.forEach((pl) => {
    const nOpen = pl.id === 1 ? 46 : pl.id === 9 ? 30 : pl.id === 7 ? 28 : 14;
    for (let i = 0; i < nOpen; i++) makeDeal(pl, 'open');
    const nClosed = pl.id === 1 ? 70 : pl.id === 9 ? 50 : pl.id === 7 ? 44 : 14;
    for (let i = 0; i < nClosed; i++) makeDeal(pl, rnd() < 0.62 ? 'won' : 'lost', -int(1, 360));
  });

  /* Projets — modèle Pipedrive Projets : tableaux → phases → projets → tâches. */
  const boards = [
    { id: 1, name: 'Installations', phases: [
      { id: 11, name: 'À planifier' }, { id: 12, name: 'Relevé technique' }, { id: 13, name: 'Commande matériel' },
      { id: 14, name: 'Installation' }, { id: 15, name: 'Inspection et remise' },
    ] },
    { id: 2, name: 'Entretien préventif', phases: [
      { id: 21, name: 'À planifier' }, { id: 22, name: 'Planifié' }, { id: 23, name: 'En cours' }, { id: 24, name: 'Rapport à produire' }, { id: 25, name: 'Facturation' },
    ] },
  ];
  const taskTpl = {
    1: ['Confirmer la date avec le client', 'Relevé des plafonds', 'Plans d’installation', 'Commande des rails', 'Commande des moteurs', 'Réception du matériel', 'Installation des rails', 'Installation des moteurs', 'Test de charge 150 %', 'Formation du personnel', 'Remise du rapport de conformité'],
    2: ['Planifier la visite', 'Confirmer l’accès aux chambres', 'Inspection des moteurs', 'Inspection des toiles', 'Test de charge', 'Saisir les non-conformités', 'Produire le rapport PDF', 'Envoyer la facture'],
  };
  const projects = [];
  const wonDeals = deals.filter((d) => d.status === 'won');
  for (let i = 0; i < 26; i++) {
    const b = i < 15 ? boards[0] : boards[1];
    const ph = pick(b.phases);
    const phIdx = b.phases.indexOf(ph);
    const deal = pick(wonDeals);
    const org = orgs.find((o) => o.id === deal.orgId);
    const start = -int(0, 50) + phIdx * 6;
    const length = int(14, 70);
    const tpl = taskTpl[b.id];
    const progressShare = (phIdx + rnd() * 0.8) / b.phases.length;
    const tasks = tpl.map((t, k) => ({
      id: i * 100 + k, title: t, done: k / tpl.length < progressShare,
      due: addDays(start + Math.round((k / tpl.length) * length)),
      assigneeId: pick(users).id,
    }));
    const end = start + length;
    const late = rnd() < 0.18;
    projects.push({
      id: 300 + i,
      title: b.id === 1 ? `${org.name} — ${pick(['rails aile ' + pick(ailes), int(4, 30) + ' lève-personnes', 'système en H', 'unité prothétique'])}`
        : `${org.name} — inspection ${pick(['annuelle', 'semestrielle', 'automne 2026', 'printemps 2027'])}`,
      boardId: b.id, phaseId: ph.id, orgId: org.id, dealId: deal.id, ownerId: deal.ownerId,
      start: addDays(start), end: addDays(late ? Math.min(end, -int(1, 10)) : end), status: 'open',
      health: late ? 'risque' : rnd() < 0.15 ? 'attention' : 'ok',
      value: deal.value, tasks,
      labels: rnd() < 0.3 ? ['Prioritaire'] : [],
    });
  }

  /* ———— Parc (back-office RTM Rapports) ————
   * Client → Établissements (les organisations du CRM) → Locaux → Équipements → Interventions.
   * Deuxième générateur à graine fixe : les données CRM ci-dessus restent identiques. */
  let seed2 = 7031;
  const r2 = () => ((seed2 = (seed2 * 1103515245 + 12345) >>> 0) / 4294967296);
  const p2 = (a) => a[Math.floor(r2() * a.length)];
  const i2 = (min, max) => Math.floor(r2() * (max - min + 1)) + min;

  const CISSS = {
    'Montérégie': 'CISSS des Deux-Rives', 'Montréal': 'CIUSSS du Mont-Royal', 'Laval': 'CISSS de l’Île-Jésus',
    'Laurentides': 'CISSS des Hautes-Laurentides', 'Lanaudière': 'CISSS de Lanaudière-Sud', 'Capitale-Nationale': 'CIUSSS de la Capitale',
    'Estrie': 'CIUSSS des Cantons', 'Mauricie': 'CIUSSS Mauricie-Centre', 'Outaouais': 'CISSS de l’Outaouais-Ouest',
  };
  const clients = [];
  const clientOf = (name, type) => { let c = clients.find((x) => x.name === name); if (!c) { c = { id: 900 + clients.length, name, type, acomba: `C${i2(1000, 9999)}` }; clients.push(c); } return c; };
  orgs.forEach((o) => {
    if (o.type === 'RPA') o.clientId = (r2() < 0.5 ? clientOf('Groupe Résidences Horizon', 'Groupe privé') : clientOf(o.name, 'Établissement privé')).id;
    else o.clientId = clientOf(CISSS[o.region], o.name.startsWith('CIUSSS') || CISSS[o.region].startsWith('CIUSSS') ? 'CIUSSS' : 'CISSS').id;
  });

  const techniciens = [
    { id: 41, name: 'Félix Gingras', initials: 'FG', hue: 200 }, { id: 42, name: 'Samuel Lévesque', initials: 'SL', hue: 150 },
    { id: 43, name: 'Kevin Morin', initials: 'KM', hue: 25 }, { id: 44, name: 'Maxime Paquin', initials: 'MP', hue: 280 },
    { id: 45, name: 'Jonathan Roy', initials: 'JR', hue: 330 }, { id: 46, name: 'Étienne Dufresne', initials: 'ÉD', hue: 100 },
  ];

  const marques = ['Arjo', 'BHM Medical', 'Guldmann', 'Handicare', 'Savaria', 'Prism Medical'].map((n, k) => ({ id: 60 + k, name: n }));
  const M = (name, mq, type, cap) => ({ name, marqueId: marques.find((x) => x.name === mq).id, type, capacite: cap });
  const modeles = [
    M('Maxi Sky 2', 'Arjo', 'Lève-personne sur rail', 272), M('Maxi Sky 600', 'Arjo', 'Lève-personne sur rail', 272), M('V4', 'BHM Medical', 'Lève-personne sur rail', 205),
    M('V4i', 'BHM Medical', 'Lève-personne sur rail', 205), M('GH3', 'Guldmann', 'Lève-personne sur rail', 205), M('GH1 F', 'Guldmann', 'Lève-personne sur rail', 255),
    M('FL (Monarch)', 'Savaria', 'Lève-personne sur rail', 200), M('C-450', 'Handicare', 'Lève-personne sur rail', 205),
    M('KwikTrak', 'Arjo', 'Rail', null), M('GL2', 'Guldmann', 'Rail', null), M('BHM', 'BHM Medical', 'Rail', null),
    M('Maxi Move', 'Arjo', 'Lève-personne mobile', 227), M('Minilift 160', 'Handicare', 'Lève-personne mobile', 160),
    M('Carendo', 'Arjo', 'Chaise de douche', 182), M('Alenti', 'Arjo', 'Chaise de bain', 182),
  ].map((m, k) => Object.assign({ id: 700 + k, aliases: i2(2, 12), manuel: k === 1 }, m));
  const modelesOf = (type) => modeles.filter((m) => m.type === type);

  // Catalogue de pièces (numéros fictifs, même logique que l'export Acomba).
  const pieceTpl = [['BAT', 'Batterie 24 V'], ['CHG', 'Chargeur mural'], ['SNG', 'Sangle de levage'], ['ROU', 'Roue rivetée'], ['BUT', 'Butée de fin de course'],
    ['PIN', 'Pin de double sécurité'], ['TEL', 'Télécommande'], ['MOT', 'Moteur de levage'], ['FRE', 'Frein de chariot'], ['CAB', 'Câble d’alimentation']];
  const pieces = [];
  modeles.forEach((m) => pieceTpl.slice(0, m.type === 'Rail' ? 4 : 8).forEach(([c, d], k) => {
    if (m.type === 'Rail' && !['ROU', 'BUT', 'PIN', 'CAB'].includes(c)) return;
    pieces.push({ id: 3000 + pieces.length, code: `${m.name.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}-${c}${k}`, desc: `${d} — ${marques.find((x) => x.id === m.marqueId).name} ${m.name}`, modeleId: m.id, posees: i2(0, 30) });
  }));

  const NOTE_BY = { BAT: 'Batterie ne tient plus la charge.', CHG: 'Chargeur mural ne charge plus.', SNG: 'Sangle effilochée, retirer du service.', ROU: 'Roue rivetée brisée, le chariot bloque dans la courbe.',
    BUT: 'Butée de fin de course desserrée.', PIN: 'Butée sans double sécurité, pin à installer.', TEL: 'Télécommande intermittente.', MOT: 'Levage saccadé sous charge, moteur à remplacer.', CAB: 'Câble d’alimentation endommagé.', FRE: 'Frein de chariot inefficace.' };
  const NOTES_NC = ['Batterie ne tient plus la charge.', 'Roue rivetée brisée, chariot bloque dans la courbe.', 'Butée sans double sécurité, pin à installer.',
    'Sangle effilochée, retirer du service.', 'Télécommande intermittente.', 'Frein de chariot inefficace.', 'Câble d’alimentation endommagé.', 'Levage saccadé sous charge.'];
  const TYPES_INT = ['Entretien préventif', 'Test de charge', 'Inspection annuelle'];
  const equipements = [], interventions = [], soumissions = [];
  orgs.forEach((o) => {
    const nRail = Math.max(4, o.leves), plan = [
      ['Lève-personne sur rail', nRail], ['Rail', Math.round(nRail * 0.85)], ['Lève-personne mobile', i2(1, 6)], ['Chaise de douche', i2(0, 5)], ['Chaise de bain', i2(0, 3)],
    ];
    const floors = i2(2, 4); const used = new Set();
    const local = () => { let l; do { l = `${i2(1, floors)}${String(i2(1, 45)).padStart(2, '0')}`; } while (used.has(l) && used.size < floors * 45); used.add(l); return l; };
    const railLocals = [];
    plan.forEach(([type, n]) => { for (let k = 0; k < n; k++) {
      const m = r2() < 0.14 ? null : p2(modelesOf(type));
      const loc = type === 'Rail' && railLocals[k] ? railLocals[k] : type === 'Lève-personne sur rail' ? (railLocals[k] = local()) : local();
      const mq = m ? marques.find((x) => x.id === m.marqueId) : null;
      const e = { id: 10000 + equipements.length, etabId: o.id, type, local: loc, modeleId: m ? m.id : null,
        ns: type === 'Rail' ? `RAIL-${loc}` : `${mq ? mq.name.slice(0, 3).toUpperCase() : 'XXX'}-${i2(1000, 9999)}-${i2(10000, 99999)}`,
        annee: 2008 + i2(0, 17), etat: 'jamais', last: null };
      equipements.push(e);
      // Historique d'interventions : ~75 % du parc déjà vu au moins une fois.
      if (r2() < 0.76) {
        const nI = i2(1, 3);
        for (let j = nI - 1; j >= 0; j--) {
          const ago = j * i2(160, 380) + i2(2, 150);
          const nc = r2() < (j === 0 ? 0.1 : 0.06);
          const it = { id: 50000 + interventions.length, eqId: e.id, date: addDays(-ago), techId: p2(techniciens).id, type: type === 'Rail' ? 'Inspection annuelle' : p2(TYPES_INT),
            verdict: nc ? 'nc' : 'ok', note: nc ? p2(NOTES_NC) : '', pieces: [], status: 'valide', decision: nc ? 'soumission' : null };
          // La note du technicien décrit la pièce notée.
          if (nc && m) { const ps = pieces.filter((x) => x.modeleId === m.id); const pc = p2(ps); it.pieces = [[pc.id, 1]]; it.note = NOTE_BY[pc.code.split('-')[1].slice(0, 3)] || it.note; }
          interventions.push(it);
          e.last = it.date; e.etat = it.verdict;
        }
      }
    } });
  });
  // File « À valider » : les envois récents des techniciens attendent une décision du bureau.
  // Seules les non-conformités récentes attendent une décision ; les conformes sont validées d'office.
  interventions.filter((x) => x.verdict === 'nc' && -((new Date(x.date + 'T12:00:00') - TODAY) / day) <= 60 && equipements.find((e) => e.id === x.eqId).last === x.date).forEach((x) => { x.status = 'a_valider'; x.decision = null; });
  // Soumissions : non-conformes validées avec décision « soumission » sur les 6 derniers mois.
  interventions.filter((x) => x.status === 'valide' && x.decision === 'soumission' && -((new Date(x.date + 'T12:00:00') - TODAY) / day) <= 180).forEach((x, k) => {
    const e = equipements.find((q) => q.id === x.eqId);
    if (e.etat !== 'nc') return;
    const saisie = k % 3 === 0;
    const so = { id: 8000 + soumissions.length, interventionId: x.id, eqId: e.id, etabId: e.etabId, status: saisie ? 'saisie' : 'a_saisir', acomba: saisie ? `S-26-${i2(100, 999)}` : null, dealId: null, created: x.date };
    // Une soumission saisie dans Acomba vit aussi comme affaire du pipeline « Soumission d'achat ».
    if (saisie) {
      const m = modeles.find((q) => q.id === e.modeleId); const pc = pieces.find((q) => q.id === (x.pieces[0] || [])[0]);
      const d = { id: Math.max(...deals.map((q) => q.id)) + 1, title: `${pc ? pc.desc.split(' — ')[0] : 'Réparation'} — ${m ? m.name : e.type} local ${e.local}`, pipelineId: 7, stageId: p2([71, 71, 72]), orgId: e.etabId,
        personId: (persons.find((q) => q.orgId === e.etabId) || {}).id || null, ownerId: 1, value: i2(4, 30) * 50, status: 'open', created: x.date, stageChanged: addDays(-i2(1, 9)),
        expectedClose: addDays(i2(10, 40)), probability: null, lostReason: null, closeDate: null, soumission: so.acomba, labels: [] };
      deals.push(d); so.dealId = d.id;
    }
    soumissions.push(so);
  });
  const packs = [];
  orgs.slice(0, 6).forEach((o, k) => {
    const n = equipements.filter((e) => e.etabId === o.id && e.last).length;
    packs.push({ id: 600 + k, etabId: o.id, date: addDays(-i2(0, 20)), heure: `${i2(8, 16)} h ${String(i2(0, 59)).padStart(2, '0')}`, pdf: n, taille: (n * 0.018).toFixed(1).replace('.', ',') });
  });

  window.CRM_SEED = { TODAY: iso(TODAY), users, pipelines, orgs, persons, deals, activities, notes, boards, projects,
    clients, techniciens, marques, modeles, pieces, equipements, interventions, soumissions, packs };
})();
