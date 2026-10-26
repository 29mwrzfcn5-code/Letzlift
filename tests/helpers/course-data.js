// Charge les données des leçons (scripts classiques) dans un bac à sable et renvoie le cours construit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..', '..');

function lessonFiles() {
  return fs.readdirSync(path.join(ROOT, 'data', 'course')).filter(f => /^lesson-\d+\.js$/.test(f)).sort();
}
function loadRawLessons() {
  const ctx = vm.createContext({});
  const code = ['course.js', ...lessonFiles()].map(f => fs.readFileSync(path.join(ROOT, 'data', 'course', f), 'utf8')).join('\n;');
  vm.runInContext(code + '\n;globalThis.__L = COURSE_LESSONS;', ctx);
  return JSON.parse(JSON.stringify(ctx.__L));
}
function loadVocab() {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', 'vocab.js'), 'utf8') + ';globalThis.__V = VOCAB;', ctx);
  return JSON.parse(JSON.stringify(ctx.__V));
}
module.exports = { ROOT, lessonFiles, loadRawLessons, loadVocab };
