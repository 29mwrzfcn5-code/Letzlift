// Faux DOM minimal pour tester les écrans qui lisent/écrivent des éléments par id.
// Un id inconnu renvoie null, comme dans un vrai document ; add('id') crée l'élément.
function makeFakeDom() {
  const els = new Map();
  const mk = id => {
    const classes = new Set();
    const el = {
      id: id || '', value: '', innerHTML: '', textContent: '', className: '', style: {}, dataset: {}, clicked: 0, listeners: {},
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: (c, f) => { (f === undefined ? !classes.has(c) : f) ? classes.add(c) : classes.delete(c); } },
      focus() {}, click() { el.clicked++; }, setSelectionRange() {}, scrollIntoView() {},
      addEventListener(type, cb) { el.listeners[type] = cb; },
      removeEventListener() {},
      appendChild(child) { if (child.id) els.set(child.id, child); return child; },
      insertAdjacentElement(_pos, child) { if (child.id) els.set(child.id, child); return child; },
      remove() { if (el.id) els.delete(el.id); },
    };
    return el;
  };
  const doc = {
    els,
    add(id) { const e = mk(id); els.set(id, e); return e; },
    getElementById: id => els.get(id) || null,
    createElement: () => mk(''),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {}, removeEventListener() {},
    body: null,
    hidden: false,
  };
  doc.body = { appendChild: child => { if (child.id) els.set(child.id, child); return child; }, removeChild() {} };
  return doc;
}
module.exports = { makeFakeDom };
