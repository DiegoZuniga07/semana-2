'use strict';
const KEY = 'sorteoJusto.v1';
const $ = id => document.getElementById(id);
let state = load();
let shown = null; // sorteo mostrado en el panel

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.classes) && s.classes.length) return s;
  } catch (e) {}
  const c = newClass('Mi clase');
  return { classes: [c], current: c.id, mode: 'teams', value: 4 };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).', 'err'); }
}
function newClass(name) {
  return { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, students: [], history: [], resetFrom: 0 };
}
const cls = () => state.classes.find(c => c.id === state.current) || state.classes[0];

// ---------- utilidades ----------
function rand(n) { // entero aleatorio criptográfico en [0,n)
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % n;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const norm = s => s.trim().replace(/\s+/g, ' ');
const pk = (a, b) => (a.toLowerCase() < b.toLowerCase() ? a + '|' + b : b + '|' + a).toLowerCase();
let tt;
function toast(msg, type = 'ok') {
  const t = $('toast'); t.textContent = msg; t.className = 'toast ' + type; t.hidden = false;
  clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 6000);
}

// ---------- clases ----------
function renderClasses() {
  const sel = $('classSelect'); sel.innerHTML = '';
  state.classes.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
  sel.value = cls().id;
}
$('classSelect').onchange = e => { state.current = e.target.value; shown = null; save(); renderAll(); };
$('addClass').onclick = () => {
  const name = norm($('newClass').value);
  if (!name) return toast('Escribe un nombre para la clase.', 'err');
  if (state.classes.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast('Ya existe una clase con ese nombre.', 'err');
  const c = newClass(name); state.classes.push(c); state.current = c.id; shown = null;
  $('newClass').value = ''; save(); renderAll(); toast('Clase "' + name + '" creada.');
};
$('delClass').onclick = () => {
  if (state.classes.length < 2) return toast('Debe existir al menos una clase.', 'err');
  const c = cls();
  if (!confirm('¿Eliminar la clase "' + c.name + '" con sus estudiantes y todo su historial? Esta acción no se puede deshacer.')) return;
  state.classes = state.classes.filter(x => x.id !== c.id); state.current = state.classes[0].id; shown = null;
  save(); renderAll(); toast('Clase eliminada.');
};

// ---------- estudiantes ----------
function addNames(list) {
  const c = cls(); let added = 0; const dup = [];
  list.map(norm).filter(Boolean).forEach(n => {
    if (c.students.some(s => s.toLowerCase() === n.toLowerCase())) dup.push(n);
    else { c.students.push(n); added++; }
  });
  save(); renderAll();
  if (dup.length) toast('Nombres duplicados omitidos: ' + dup.join(', ') + (added ? '. Agregados: ' + added + '.' : '.'), 'err');
  else if (added) toast(added + ' estudiante(s) agregado(s).');
  else toast('No hay nombres válidos para agregar.', 'err');
}
$('addStudent').onclick = () => { addNames([$('studentName').value]); $('studentName').value = ''; $('studentName').focus(); };
$('studentName').onkeydown = e => { if (e.key === 'Enter') $('addStudent').click(); };
$('addBulk').onclick = () => { addNames($('bulk').value.split(/\r?\n/)); $('bulk').value = ''; };
$('clearStudents').onclick = () => {
  if (!cls().students.length) return;
  if (!confirm('¿Vaciar la lista de estudiantes? El historial de sorteos se conserva.')) return;
  cls().students = []; save(); renderAll();
};
function renderStudents() {
  const ul = $('studentList'); ul.innerHTML = '';
  cls().students.forEach((n, i) => {
    const li = document.createElement('li'), sp = document.createElement('span'), b = document.createElement('button');
    sp.textContent = n; b.textContent = '×'; b.title = 'Eliminar'; b.setAttribute('aria-label', 'Eliminar ' + n);
    b.onclick = () => { cls().students.splice(i, 1); save(); renderAll(); };
    li.append(sp, b); ul.appendChild(li);
  });
  $('studentCount').textContent = cls().students.length;
}

// ---------- configuración ----------
function sizesFor(n) {
  const v = parseInt($('value').value, 10), mode = $('mode').value;
  if (!n) return { error: 'Agrega estudiantes antes de sortear.' };
  if (!v || v < 1) return { error: 'Indica un número mayor que 0.' };
  const k = mode === 'teams' ? v : Math.ceil(n / v);
  if (k > n) return { error: 'Hay menos estudiantes (' + n + ') que equipos (' + k + ').' };
  const base = Math.floor(n / k), extra = n % k;
  return { sizes: Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)) };
}
function renderPreview() {
  const n = cls().students.length, r = sizesFor(n);
  $('preview').textContent = r.error ? 'Total: ' + n + ' estudiantes. ' + r.error :
    'Total: ' + n + ' estudiantes → ' + r.sizes.length + ' equipos de ' + [...new Set(r.sizes)].sort((a, b) => b - a).join(' o ') + ' integrantes.';
}
$('mode').onchange = $('value').oninput = () => { state.mode = $('mode').value; state.value = $('value').value; save(); renderPreview(); };

// ---------- algoritmo ----------
function pairSet(c) {
  const set = new Set();
  c.history.slice(c.resetFrom || 0).forEach(h => h.teams.forEach(t => {
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) set.add(pk(t[i], t[j]));
  }));
  return set;
}
function solve(names, sizes, pairs) {
  const k = sizes.length;
  const deg = {}; names.forEach(a => deg[a] = names.reduce((s, b) => s + (a !== b && pairs.has(pk(a, b)) ? 1 : 0), 0));
  for (let attempt = 0; attempt < 400; attempt++) {
    const order = shuffle(names).sort((a, b) => (deg[b] + Math.random() * 0.9) - (deg[a] + Math.random() * 0.9));
    const teams = sizes.map(() => []);
    let budget = 6000;
    const place = i => {
      if (i === order.length) return true;
      if (budget-- <= 0) return false;
      const s = order[i], seenEmpty = new Set();
      for (const t of shuffle([...Array(k).keys()])) {
        if (teams[t].length >= sizes[t]) continue;
        if (!teams[t].length) { if (seenEmpty.has(sizes[t])) continue; seenEmpty.add(sizes[t]); }
        if (teams[t].some(m => pairs.has(pk(m, s)))) continue;
        teams[t].push(s);
        if (place(i + 1)) return true;
        teams[t].pop();
        if (budget <= 0) return false;
      }
      return false;
    };
    if (place(0)) return teams;
  }
  return null;
}
function valid(teams, names, sizes) {
  const flat = teams.flat();
  return flat.length === names.length && new Set(flat).size === names.length && flat.every(n => names.includes(n)) &&
    teams.every(t => sizes.includes(t.length)) && Math.max(...teams.map(t => t.length)) - Math.min(...teams.map(t => t.length)) <= 1;
}

// ---------- sorteo ----------
$('draw').onclick = () => {
  const c = cls(), names = c.students.slice(), w = $('warn'); w.hidden = true;
  const r = sizesFor(names.length);
  if (r.error) return toast(r.error, 'err');
  const teams = solve(names, r.sizes, pairSet(c));
  if (!teams || !valid(teams, names, r.sizes)) {
    w.innerHTML = '';
    const p = document.createElement('div');
    p.textContent = 'No existe (o no se encontró) una distribución en la que nadie repita compañeros de sorteos anteriores con esta configuración. Tu historial no se ha modificado. Puedes revisar el historial, cambiar la cantidad de equipos o reiniciar las restricciones de forma consciente.';
    const row = document.createElement('div'); row.className = 'row';
    const b1 = document.createElement('button'); b1.className = 'btn ghost'; b1.textContent = 'Ver historial';
    b1.onclick = () => $('historySection').scrollIntoView({ behavior: 'smooth' });
    const b2 = document.createElement('button'); b2.className = 'btn'; b2.textContent = 'Reiniciar restricciones';
    b2.onclick = () => {
      if (!confirm('Los sorteos anteriores seguirán guardados, pero dejarán de limitar los próximos sorteos de esta clase. ¿Continuar?')) return;
      c.resetFrom = c.history.length; save(); w.hidden = true; toast('Restricciones reiniciadas. El historial se conserva. Vuelve a sortear.');
    };
    row.append(b1, b2); w.append(p, row); w.hidden = false;
    return;
  }
  const rec = { id: 'h' + Date.now().toString(36), date: new Date().toISOString(), size: names.length, teams };
  c.history.push(rec); save(); shown = rec; renderAll();
  toast('Sorteo realizado y guardado en el historial.');
  $('resultPanel').scrollIntoView({ behavior: 'smooth' });
};

// ---------- resultados ----------
const fmt = iso => new Date(iso).toLocaleString('es');
function renderResult() {
  const p = $('resultPanel');
  if (!shown) { p.hidden = true; return; }
  p.hidden = false;
  $('resultTitle').textContent = 'Resultados · ' + fmt(shown.date);
  const box = $('teams'); box.innerHTML = '';
  shown.teams.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'team';
    const h = document.createElement('h3'); h.textContent = 'EQUIPO ' + (i + 1);
    const ul = document.createElement('ul'); t.forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
    const s = document.createElement('small'); s.textContent = t.length + ' integrantes';
    d.append(h, ul, s); box.appendChild(d);
  });
}
const asText = () => cls().name + ' — ' + fmt(shown.date) + '\n\n' +
  shown.teams.map((t, i) => 'EQUIPO ' + (i + 1) + ' (' + t.length + ')\n' + t.map(n => '- ' + n).join('\n')).join('\n\n');
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(asText()); toast('Resultados copiados al portapapeles.'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = asText(); document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Resultados copiados al portapapeles.'); } catch (_) { toast('No se pudo copiar.', 'err'); }
    ta.remove();
  }
};
$('print').onclick = () => window.print();
$('again').onclick = () => $('draw').click();

// ---------- historial ----------
function renderHistory() {
  const c = cls(), ul = $('history'); ul.innerHTML = '';
  $('histCount').textContent = c.history.length;
  if (!c.history.length) { const li = document.createElement('li'); li.textContent = 'Aún no hay sorteos. Realiza el primero para empezar el historial.'; ul.appendChild(li); return; }
  c.history.map((h, i) => ({ h, i })).reverse().forEach(({ h, i }) => {
    const li = document.createElement('li'), sp = document.createElement('span'), box = document.createElement('span');
    const ignored = i < (c.resetFrom || 0);
    sp.textContent = 'Sorteo ' + (i + 1) + ' · ' + fmt(h.date) + ' · ' + h.teams.length + ' equipos, ' + h.size + ' estudiantes' + (ignored ? ' (no restringe)' : '');
    const v = document.createElement('button'); v.className = 'btn ghost'; v.textContent = 'Consultar';
    v.onclick = () => { shown = h; renderResult(); $('resultPanel').scrollIntoView({ behavior: 'smooth' }); };
    const d = document.createElement('button'); d.className = 'btn ghost danger'; d.textContent = 'Eliminar'; d.style.marginLeft = '6px';
    d.onclick = () => {
      if (!confirm('¿Eliminar el sorteo ' + (i + 1) + ' del historial? Los compañeros de ese sorteo podrán volver a coincidir.')) return;
      c.history.splice(i, 1); if (i < c.resetFrom) c.resetFrom--;
      if (shown && shown.id === h.id) shown = null;
      save(); renderAll();
    };
    box.append(v, d); li.append(sp, box); ul.appendChild(li);
  });
}

function renderAll() { renderClasses(); renderStudents(); renderPreview(); renderResult(); renderHistory(); }
$('mode').value = state.mode || 'teams'; $('value').value = state.value || 4;
renderAll();
