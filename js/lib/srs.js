/*
 * Répétition espacée (Leitner + learning steps) — logique pure, utilisable dans le navigateur et
 * dans Node. Aucune lecture de globale, aucune écriture en stockage : l'heure (`now`, en ms) et le
 * type de session sont passés en paramètres.
 *
 * Boîte 1 : revoir après 5 min | 2 : 1 jour | 3 : 3 jours | 4 : 7 jours | 5 : 14 jours (acquis).
 * Les échéances sont des instants absolus (ms) : « 1 jour » = 24 h exactes. Lors d'un changement
 * d'heure, l'échéance locale se décale donc d'une heure ; ce n'est pas un jour calendaire.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BOX_INTERVALS_MS = {
    1: 5 * 60 * 1000,
    2: 24 * 3600 * 1000,
    3: 3 * 24 * 3600 * 1000,
    4: 7 * 24 * 3600 * 1000,
    5: 14 * 24 * 3600 * 1000,
  };

  // ---- learning steps : encodage initial avant le cycle Leitner ----
  // Étape 0→2 : phase d'apprentissage d'un mot tout juste introduit, avec réinsertion dynamique
  // dans la file de session. Étape 3 = diplômé → entre dans le cycle Leitner classique (box=2).
  var LEARNING_GAPS = {
    0: { correct: [5, 9],  wrong: [3, 6] },
    1: { correct: [8, 14], wrong: [3, 6] },
    2: { wrong: [3, 6] },
  };

  var DIFFICULT_TARGET_REPS = 2;     // réussites requises avant qu'un mot sorte de la boucle
  var DIFFICULT_REQUEUE_GAP_CORRECT = [3, 6];
  var DIFFICULT_REQUEUE_GAP_WRONG = [2, 4];

  function applyLearningStep(entry, correct) {
    var step = entry.learningStep;
    if (step === 0) {
      if (correct) { entry.learningStep = 1; return LEARNING_GAPS[0].correct; }
      entry.learningStep = 0; return LEARNING_GAPS[0].wrong;
    }
    if (step === 1) {
      if (correct) { entry.learningStep = 2; return LEARNING_GAPS[1].correct; }
      entry.learningStep = 0; return LEARNING_GAPS[1].wrong;
    }
    if (step === 2) {
      if (correct) { entry.learningStep = 3; return null; } // diplômé
      entry.learningStep = 1; return LEARNING_GAPS[2].wrong;
    }
    return null;
  }

  function isDueEntry(entry, now) {
    return now >= entry.dueAt;
  }

  /*
   * Applique une réponse à une entrée { box, dueAt, learningStep?, wrongCount? } (modifiée en place).
   * kind : 'normal' | 'mastery' | 'difficult' | 'confidence'.
   * difficultReps : réussites déjà obtenues par ce mot dans la session « difficult » en cours.
   * Renvoie { requeueGap, difficultReps } : requeueGap vaut null si la carte est « réglée »,
   * sinon [min,max] = nombre de cartes avant sa réapparition en session.
   */
  function applyAnswerToEntry(e, correct, opts) {
    var now = opts.now;
    var kind = opts.kind || 'normal';
    var difficultReps = opts.difficultReps || 0;
    if (!correct) e.wrongCount = (e.wrongCount || 0) + 1; // alimente les badges "ça résiste"
    var requeueGap = null;
    if (e.learningStep !== undefined && e.learningStep < 3) {
      requeueGap = applyLearningStep(e, correct);
      if (e.learningStep === 3) {
        e.box = 2;
        e.dueAt = now + BOX_INTERVALS_MS[2];
        delete e.learningStep;
        requeueGap = null;
      }
    } else if (kind === 'mastery') {
      // Révision des acquis : mots déjà en boîte 4-5.
      var wasDue = now >= e.dueAt;
      if (correct) {
        e.box = Math.min(5, e.box + 1);
        // Un mot pas encore dû revu par anticipation ne voit pas son échéance repoussée :
        // seuls les mots réellement dus avancent leur date.
        if (wasDue) e.dueAt = now + BOX_INTERVALS_MS[e.box];
      } else {
        // Une erreur reste un vrai signal d'oubli, mais la redescente est plafonnée à la boîte 3.
        e.box = 3;
        e.dueAt = now + BOX_INTERVALS_MS[3];
      }
    } else if (kind === 'difficult') {
      // Mots difficiles : boucle un mot jusqu'à DIFFICULT_TARGET_REPS réussites dans la session.
      if (correct) {
        e.box = Math.min(5, e.box + 1);
        e.dueAt = now + BOX_INTERVALS_MS[e.box];
        difficultReps += 1;
        if (difficultReps < DIFFICULT_TARGET_REPS) requeueGap = DIFFICULT_REQUEUE_GAP_CORRECT;
      } else {
        e.box = 1;
        e.dueAt = now + BOX_INTERVALS_MS[1];
        requeueGap = DIFFICULT_REQUEUE_GAP_WRONG; // revient plus vite après une erreur
      }
    } else if (kind === 'confidence') {
      // Remise en confiance : jamais de sanction ; l'échéance ne bouge que dans le sens positif.
      if (correct && now >= e.dueAt) {
        e.dueAt = now + BOX_INTERVALS_MS[5];
      }
    } else {
      e.box = correct ? Math.min(5, e.box + 1) : 1;
      e.dueAt = now + BOX_INTERVALS_MS[e.box];
    }
    return { requeueGap: requeueGap, difficultReps: difficultReps };
  }

  return {
    BOX_INTERVALS_MS: BOX_INTERVALS_MS, LEARNING_GAPS: LEARNING_GAPS,
    DIFFICULT_TARGET_REPS: DIFFICULT_TARGET_REPS,
    DIFFICULT_REQUEUE_GAP_CORRECT: DIFFICULT_REQUEUE_GAP_CORRECT,
    DIFFICULT_REQUEUE_GAP_WRONG: DIFFICULT_REQUEUE_GAP_WRONG,
    applyLearningStep: applyLearningStep, isDueEntry: isDueEntry, applyAnswerToEntry: applyAnswerToEntry,
  };
});
