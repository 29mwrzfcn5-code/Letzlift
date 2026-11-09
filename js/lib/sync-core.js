/*
 * Client du serveur LetzLift — logique pure (navigateur + Node) : appels au serveur et cycle de
 * synchronisation (envoyer les données locales, appliquer la version fusionnée par le serveur).
 * Le réseau (fetch) et l'accès aux données locales sont injectés : le même code tourne dans l'app
 * et dans les tests, où le serveur est le vrai Worker appelé directement.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LetzSyncCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_ATTEMPTS = 4;
  var OVERLAY_KEYS = ['lu', 'fr', 'cat', 'g', 'sentence', 'sentenceFr', 'note', 'updatedAt'];

  function normalizeServerUrl(input) {
    var s = String(input || '').trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(s) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(s)) return null;
    return s;
  }

  // Sérialisation à clés triées, pour comparer deux jeux de données sans dépendre de l'ordre.
  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }

  // Mots personnels reçus du serveur : seuls les champs connus, courts, sans < > (ni guillemet droit
  // ou antislash dans lu / fr / cat, comme le formulaire de saisie).
  function validOverlay(o) {
    if (o === undefined) return true;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    var ids = Object.keys(o);
    if (ids.length > 2000) return false;
    return ids.every(function (id) {
      var e = o[id];
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !e || typeof e !== 'object' || Array.isArray(e)) return false;
      return Object.keys(e).every(function (k) {
        var v = e[k];
        if (OVERLAY_KEYS.indexOf(k) === -1) return false;
        if (k === 'updatedAt') return typeof v === 'number' && isFinite(v);
        if (typeof v !== 'string' || v.length > 300 || /[<>]/.test(v)) return false;
        return !((k === 'lu' || k === 'fr' || k === 'cat') && /["\\]/.test(v));
      });
    });
  }

  function createClient(opts) {
    var base = opts.baseUrl, doFetch = opts.fetch, token = opts.token || null;
    function request(method, path, body, authed) {
      var headers = { 'Content-Type': 'application/json' };
      if (authed && token) headers.Authorization = 'Bearer ' + token;
      return Promise.resolve(doFetch(base + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) }))
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) { return { status: res.status, ok: res.ok, body: json }; });
        });
    }
    return {
      setToken: function (t) { token = t; },
      request: function (method, path, body) { return request(method, path, body, true); },
      register: function (fields) { return request('POST', '/api/register', fields); },
      login: function (username, password) { return request('POST', '/api/login', { username: username, password: password }); },
      me: function () { return request('GET', '/api/me', undefined, true); },
      sync: function (data) { return request('POST', '/api/sync', { data: data }, true); },
      consent: function (analytics, version) { return request('POST', '/api/consent', { analytics: analytics, version: version }, true); },
      events: function (events) { return request('POST', '/api/events', { events: events }, true); },
      changePassword: function (oldPassword, newPassword) { return request('POST', '/api/password', { oldPassword: oldPassword, newPassword: newPassword }, true); },
      logout: function () { return request('POST', '/api/logout', {}, true); },
      deleteAccount: function (password) { return request('DELETE', '/api/account', { password: password }, true); },
    };
  }

  function codedError(message, code) { var e = new Error(message); e.code = code; return e; }

  /*
   * Synchronisation : on envoie les données locales, le serveur les fusionne avec sa copie et renvoie
   * le résultat, que l'on applique s'il diffère. o : { client, getLocal(): data, apply(data): Promise,
   * validate(data): bool }. Renvoie { rev, applied } ; lève une Error avec .code :
   * 'auth' | 'suspended' | 'invalid' | 'conflict' | 'server'.
   */
  async function runSync(o) {
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var local = o.getLocal();
      var res = await o.client.sync(local);
      if (res.status === 409) continue;
      if (res.status === 401) throw codedError('Session expirée : reconnecte-toi.', 'auth');
      if (res.status === 403) throw codedError((res.body && res.body.error) || 'Accès refusé.', 'suspended');
      if (!res.ok) throw codedError((res.body && res.body.error) || 'Erreur du serveur.', 'server');
      var merged = res.body.data;
      if (!merged || !o.validate(merged)) throw codedError('Les données du serveur sont invalides : rien n’a été modifié.', 'invalid');
      var changed = canonical(merged) !== canonical(local);
      if (changed) await o.apply(merged);
      return { rev: res.body.rev, applied: changed };
    }
    throw codedError('Un autre appareil synchronise en même temps : réessaie dans un instant.', 'conflict');
  }

  return { normalizeServerUrl: normalizeServerUrl, canonical: canonical, validOverlay: validOverlay, createClient: createClient, runSync: runSync };
});
