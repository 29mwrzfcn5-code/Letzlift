/*
 * Client de synchronisation — logique pure (navigateur + Node) : appels au serveur et cycle
 * « récupérer → fusionner → appliquer → envoyer ». Le réseau (fetch), la fusion et l'accès aux
 * données locales sont injectés : le même code tourne dans l'app et dans les tests, où le
 * serveur est le vrai Worker appelé directement.
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
      register: function (username, password, invite) { return request('POST', '/api/register', { username: username, password: password, invite: invite }); },
      login: function (username, password) { return request('POST', '/api/login', { username: username, password: password }); },
      getData: function () { return request('GET', '/api/data', undefined, true); },
      putData: function (expectedRev, data) { return request('PUT', '/api/data', { expectedRev: expectedRev, data: data }, true); },
      changePassword: function (oldPassword, newPassword) { return request('POST', '/api/password', { oldPassword: oldPassword, newPassword: newPassword }, true); },
      logout: function () { return request('POST', '/api/logout', {}, true); },
      deleteAccount: function (password) { return request('DELETE', '/api/account', { password: password }, true); },
    };
  }

  /*
   * o : { client, getLocal(): data, apply(data): Promise, merge(local, remote): data, validate(data): bool }
   * Renvoie { rev, applied, uploaded } ; lève une Error avec .code : 'auth' | 'invalid' | 'conflict' | 'server'.
   */
  async function runSync(o) {
    var applied = false;
    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var remote = await o.client.getData();
      if (remote.status === 401) { var a = new Error('Session expirée : reconnecte-toi.'); a.code = 'auth'; throw a; }
      if (!remote.ok) { var s = new Error((remote.body && remote.body.error) || 'Erreur du serveur.'); s.code = 'server'; throw s; }
      var remoteData = remote.body.data, rev = remote.body.rev;
      var local = o.getLocal();
      var merged = remoteData ? o.merge(local, remoteData) : local;
      if (remoteData && !o.validate(merged)) { var v = new Error('Les données du serveur sont invalides : rien n’a été modifié.'); v.code = 'invalid'; throw v; }
      var mergedKey = canonical(merged);
      if (mergedKey !== canonical(local)) { await o.apply(merged); applied = true; }
      if (remoteData && mergedKey === canonical(remoteData)) return { rev: rev, applied: applied, uploaded: false };
      var put = await o.client.putData(rev, merged);
      if (put.status === 409) continue;
      if (put.status === 401) { var a2 = new Error('Session expirée : reconnecte-toi.'); a2.code = 'auth'; throw a2; }
      if (!put.ok) { var s2 = new Error((put.body && put.body.error) || 'Erreur du serveur.'); s2.code = 'server'; throw s2; }
      return { rev: put.body.rev, applied: applied, uploaded: true };
    }
    var c = new Error('Un autre appareil synchronise en même temps : réessaie dans un instant.'); c.code = 'conflict'; throw c;
  }

  return { normalizeServerUrl: normalizeServerUrl, canonical: canonical, validOverlay: validOverlay, createClient: createClient, runSync: runSync };
});
