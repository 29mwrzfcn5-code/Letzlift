/*
 * Saisie d'un mot de vocabulaire (formulaire « Ajouter ou corriger un mot ») — logique pure,
 * utilisable dans le navigateur et dans Node.
 *
 * Les règles protègent ce que le reste de l'app suppose d'un mot :
 *  - sentence : exactement un « ___ » (le mode « à compléter » le remplace une seule fois, et
 *    « Remise en ordre » s'en sert pour reconstruire la phrase) ; sans phrase, une carte « à
 *    compléter » planterait ;
 *  - lu, fr, cat : pas de guillemet droit ni d'antislash (ils atterrissent dans des attributs
 *    HTML et des chaînes de onclick) ;
 *  - aucun champ ne contient < ou > (même garde-fou que l'import CSV et l'import de sauvegarde) ;
 *  - g : seulement « f » (eng) ou « c » (e / en), les deux valeurs que l'app comprend.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VOCAB_FIELD_MAX_LEN = 300;
  var VOCAB_GENDERS = ['f', 'c'];

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function countBlanks(s) { return s.split('___').length - 1; }
  function normalizeKey(s) { return String(s || '').trim().toLowerCase(); }

  /*
   * input : { lu, fr, cat, g, sentence, sentenceFr, note } (chaînes, éventuellement vides).
   * Renvoie { ok, errors, entry } : errors = { champ: message } ; entry = objet prêt pour vocabOverlay
   * (champs optionnels vides omis).
   */
  function validateVocabEntry(input) {
    var f = {
      lu: str(input.lu), fr: str(input.fr), cat: str(input.cat), g: str(input.g),
      sentence: str(input.sentence), sentenceFr: str(input.sentenceFr), note: str(input.note),
    };
    var errors = {};
    ['lu', 'fr', 'cat'].forEach(function (k) {
      if (!f[k]) errors[k] = 'Champ obligatoire.';
      else if (/["\\]/.test(f[k])) errors[k] = 'Les guillemets droits (") et les antislash (\\) ne sont pas autorisés ici ; utilise l’apostrophe.';
    });
    if (!f.sentence) errors.sentence = 'La phrase d’exemple est obligatoire (elle sert aux exercices « à compléter »).';
    else if (countBlanks(f.sentence) !== 1) errors.sentence = 'Mets exactement un trou « ___ » (trois traits bas) à la place du mot.';
    else if (/_{4,}/.test(f.sentence)) errors.sentence = 'Le trou s’écrit avec exactement trois traits bas : « ___ ».';
    if (!f.sentenceFr) errors.sentenceFr = 'La traduction de la phrase est obligatoire.';
    if (f.g && VOCAB_GENDERS.indexOf(f.g) === -1) errors.g = 'Genre inconnu.';
    Object.keys(f).forEach(function (k) {
      if (errors[k]) return;
      if (f[k].length > VOCAB_FIELD_MAX_LEN) errors[k] = 'Trop long (' + VOCAB_FIELD_MAX_LEN + ' caractères au maximum).';
      else if (/[<>]/.test(f[k])) errors[k] = 'Les caractères < et > ne sont pas autorisés.';
    });
    var entry = { lu: f.lu, fr: f.fr, cat: f.cat };
    if (f.g) entry.g = f.g;
    entry.sentence = f.sentence;
    entry.sentenceFr = f.sentenceFr;
    if (f.note) entry.note = f.note;
    return { ok: Object.keys(errors).length === 0, errors: errors, entry: entry };
  }

  // Prochain identifiant « persoN » libre parmi les ids donnés (jamais de collision avec v1…v386
  // ni avec un id choisi à la main dans un import CSV).
  function nextPersonalId(ids) {
    var max = 0;
    (ids || []).forEach(function (id) {
      var m = /^perso(\d+)$/.exec(id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'perso' + (max + 1);
  }

  // Mots déjà présents avec le même luxembourgeois (insensible à la casse), hors excludeId.
  function findDuplicateWords(lu, vocab, excludeId) {
    var key = normalizeKey(lu);
    if (!key) return [];
    return vocab.filter(function (v) { return v.id !== excludeId && normalizeKey(v.lu) === key; })
      .map(function (v) { return { id: v.id, lu: v.lu, fr: v.fr }; });
  }

  return { VOCAB_FIELD_MAX_LEN: VOCAB_FIELD_MAX_LEN, VOCAB_GENDERS: VOCAB_GENDERS,
           validateVocabEntry: validateVocabEntry, nextPersonalId: nextPersonalId, findDuplicateWords: findDuplicateWords };
});
