/*
 * Nettoyage des saisies (navigateur + Node).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var USER_NAME_MAX_LEN = 60;

  // Les caractères < et > sont refusés par la validation d'import des sauvegardes (protection
  // contre l'injection HTML). Un prénom qui en contenait s'affichait bien (escapeHtml) mais rendait
  // la sauvegarde exportée impossible à réimporter : on les interdit donc dès la saisie.
  function hasForbiddenNameChars(name) {
    return /[<>]/.test(String(name == null ? '' : name));
  }

  // Version « réparée » d'un prénom déjà enregistré ou importé : retire < et >, espaces en trop,
  // plafonne à 60 caractères. Renvoie null si rien ne reste.
  function cleanUserName(name) {
    if (typeof name !== 'string') return name; // null, undefined ou type invalide : laissé tel quel (la validation tranchera)
    var cleaned = name.replace(/[<>]/g, '').trim().slice(0, USER_NAME_MAX_LEN).trim();
    return cleaned === '' ? null : cleaned;
  }

  return { USER_NAME_MAX_LEN: USER_NAME_MAX_LEN, hasForbiddenNameChars: hasForbiddenNameChars, cleanUserName: cleanUserName };
});
