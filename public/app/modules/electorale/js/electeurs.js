/* Électeurs — Base locale (sensible)
 * Les données restent sur l'appareil (localStorage / fichier local).
 * Jamais envoyées au serveur.
 */
(function () {
  const STORAGE_KEY = 'figuig_electeurs_v1';
  const FIELDS = [
    { k: 'numero',          ar: 'الرقم الترتيبي' },
    { k: 'cin',             ar: 'رقم بطاقة التعريف' },
    { k: 'adresse',         ar: 'العنوان بدقة' },
    { k: 'date_naissance',  ar: 'تاريخ الازدياد' },
    { k: 'prenom',          ar: 'الاسم الشخصي للناخب' },
    { k: 'nom',             ar: 'الاسم العائلي للناخب' },
    { k: 'sexe',            ar: 'الجنس' },
    { k: 'circonscription', ar: 'الدائرة الانتخابية' },
    { k: 'commune',         ar: 'الجماعة' },
    { k: 'nom_bv',          ar: 'اسم مكتب التصويت' },
    { k: 'adresse_bv',      ar: 'عنوان مكتب التصويت' },
    { k: 'lieu_bv',         ar: 'مكان مكتب التصويت' },
    { k: 'province',        ar: 'العمالة' },
  ];
  const HEADER_AR_TO_K = Object.fromEntries(FIELDS.map(f => [f.ar.replace(/\s+/g, ''), f.k]));
  // Aliases tolerated in imports
  const ALIASES = {
    'الرقمالترتيبي':'numero','الرقم':'numero','n':'numero','num':'numero','numero':'numero',
    'cin':'cin','رقمبطاقةالتعريف':'cin','رقمالبطاقة':'cin',
    'adresse':'adresse','العنوانبدقة':'adresse','العنوان':'adresse',
    'تاريخالازدياد':'date_naissance','date_naissance':'date_naissance','datenaissance':'date_naissance',
    'الاسمالشخصيللناخب':'prenom','الاسمالشخصي':'prenom','prenom':'prenom',
    'الاسمالعائليللناخب':'nom','الاسمالعائلي':'nom','nom':'nom',
    'sexe':'sexe','الجنس':'sexe',
    'الدائرةالانتخابية':'circonscription','circonscription':'circonscription','circ':'circonscription',
    'الجماعة':'commune','commune':'commune',
    'اسممكتبالتصويت':'nom_bv','nombv':'nom_bv',
    'عنوانمكتبالتصويت':'adresse_bv','adressebv':'adresse_bv',
    'مكانمكتبالتصويت':'lieu_bv','lieubv':'lieu_bv',
    'العمالةاو':'province','العمالة':'province','province':'province'
  };
  function normalizeHeader(h) {
    const c = String(h||'').trim().replace(/\s+/g,'').toLowerCase();
    return ALIASES[c] || HEADER_AR_TO_K[c.replace(/^./,m=>m)] || c;
  }

  // ---------- Storage ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(_) { return []; }
  }
  function save(rows) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
    catch(e){ alert('Stockage local saturé. Les données dépassent la capacité du navigateur.'); }
  }

  // ---------- CSV Parser (RFC4180-ish, supports quoted Arabic) ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
        else if (c === '"') inQ = false;
        else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',' || c === ';' || c === '\t') { row.push(field); field=''; }
        else if (c === '\n') { row.push(field); rows.push(row); row=[]; field=''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r[0] && r[0].trim()));
  }

  function rowsFromCSV(text) {
    const grid = parseCSV(text);
    if (!grid.length) return [];
    const headers = grid[0].map(normalizeHeader);
    return grid.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { if (h) o[h] = (r[i]||'').trim(); });
      return o;
    });
  }

  // ---------- Import / Export ----------
  async function importFile(file) {
    const name = file.name.toLowerCase();
    const text = await file.text();
    let rows;
    if (name.endsWith('.json')) {
      const data = JSON.parse(text);
      rows = Array.isArray(data) ? data : (data.electeurs || data.data || []);
      // normalize keys
      rows = rows.map(r => {
        const o = {};
        for (const k in r) o[normalizeHeader(k)] = r[k];
        return o;
      });
    } else {
      rows = rowsFromCSV(text);
    }
    save(rows);
    return rows;
  }
  function exportJSON() {
    const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'electeurs_figuig.json';
    a.click();
  }
  function clearAll() {
    if (!confirm('Supprimer toutes les données locales des électeurs ?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  // ---------- Aggregation → carte ----------
  function aggregate(rows) {
    const byCommune = {};
    rows.forEach(r => {
      const c = (r.commune||'').trim();
      if (!c) return;
      if (!byCommune[c]) byCommune[c] = { electeurs:0, bureaux:new Set(), circonscriptions:new Set() };
      byCommune[c].electeurs += 1;
      if (r.nom_bv) byCommune[c].bureaux.add(r.nom_bv.trim());
      if (r.circonscription!=null && String(r.circonscription).trim()!=='') byCommune[c].circonscriptions.add(String(r.circonscription).trim());
    });
    const out = {};
    Object.keys(byCommune).forEach(c => {
      out[c] = {
        electeurs: byCommune[c].electeurs,
        bureaux: byCommune[c].bureaux.size,
        circonscriptions: byCommune[c].circonscriptions.size
      };
    });
    return out;
  }

  function pushToMap(rows) {
    const agg = aggregate(rows);
    const frame = document.getElementById('moduleFrame');
    function send(){ try { frame.contentWindow.postMessage({ type:'ELECTEURS:AGG', payload: agg }, '*'); } catch(_){} }
    if (frame) {
      // send now and after load
      send();
      frame.addEventListener('load', () => setTimeout(send, 300), { once:true });
    }
  }

  // ---------- Filtres ----------
  function uniqueSorted(rows, key) {
    return [...new Set(rows.map(r => (r[key]||'').toString().trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  }
  function fillFilter(id, values, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
  }

  // ---------- KPI ----------
  function updateGlobalKPIs(rows) {
    const agg = aggregate(rows);
    const totE = rows.length;
    const totB = new Set(rows.map(r=>`${r.commune}|${r.nom_bv}`).filter(s=>s!=='|' && !s.endsWith('|'))).size;
    const totC = new Set(rows.map(r=>`${r.commune}|${r.circonscription}`).filter(s=>s!=='|' && !s.endsWith('|'))).size;
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = (v||0).toLocaleString('fr-FR'); };
    setText('kpiE', totE);
    setText('kpiB', totB);
    setText('kpiC', totC);
    const kpiCount = document.getElementById('kpiElecteursCount');
    if (kpiCount) kpiCount.textContent = totE.toLocaleString('fr-FR');
  }

  // ---------- DataTable ----------
  let dt = null;
  function renderTable(rows) {
    const tbl = document.getElementById('electeursTable');
    if (!tbl) return;
    if (dt) { dt.destroy(); tbl.querySelector('tbody').innerHTML=''; }
    const tbody = tbl.querySelector('tbody');
    const frag = document.createDocumentFragment();
    rows.forEach((r,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.numero ?? i+1}</td>
        <td>${escapeHtml(r.cin)}</td>
        <td>${escapeHtml(r.prenom)} ${escapeHtml(r.nom)}</td>
        <td>${escapeHtml(r.sexe)}</td>
        <td>${escapeHtml(r.date_naissance)}</td>
        <td>${escapeHtml(r.adresse)}</td>
        <td>${escapeHtml(r.commune)}</td>
        <td class="text-center">${escapeHtml(r.circonscription)}</td>
        <td>${escapeHtml(r.nom_bv)}</td>
        <td>${escapeHtml(r.adresse_bv)}</td>
        <td>${escapeHtml(r.lieu_bv)}</td>
        <td>${escapeHtml(r.province)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    dt = window.jQuery('#electeursTable').DataTable({
      paging:true, pageLength:10, lengthMenu:[[10,25,50,100,-1],[10,25,50,100,'Tous']],
      searching:true, ordering:true, info:true, scrollX:true,
      order:[[0,'asc']],
      language: {
        search:'Recherche :', lengthMenu:'Afficher _MENU_ électeurs',
        info:'Affichage de _START_ à _END_ sur _TOTAL_ électeurs',
        infoFiltered:'(filtré sur _MAX_ électeurs au total)',
        paginate:{first:'«',previous:'‹',next:'›',last:'»'},
        emptyTable:'Aucune donnée — importez un fichier JSON ou CSV',
        zeroRecords:'Aucun électeur ne correspond aux filtres'
      }
    });
  }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------- Apply filters ----------
  function applyFilters(all) {
    const c  = document.getElementById('fCommune').value;
    const ci = document.getElementById('fCirc').value;
    const s  = document.getElementById('fSexe').value;
    const bv = document.getElementById('fBV').value;
    const out = all.filter(r =>
      (!c  || r.commune === c) &&
      (!ci || String(r.circonscription) === ci) &&
      (!s  || r.sexe === s) &&
      (!bv || r.nom_bv === bv)
    );
    renderTable(out);
    updateGlobalKPIs(out);
    pushToMap(out);
  }

  // ---------- Bootstrap ----------
  async function init() {
    let rows = load();
    if (!rows.length) {
      // try sample
      try {
        const sample = await fetch('modules/electorale/data/electeurs.sample.json').then(r=>r.ok?r.json():[]);
        if (sample.length) { rows = sample; save(rows); }
      } catch(_){}
    }

    // filters population
    fillFilter('fCommune', uniqueSorted(rows,'commune'), 'Toutes les communes');
    fillFilter('fCirc',    uniqueSorted(rows,'circonscription'), 'Toutes les circonscriptions');
    fillFilter('fSexe',    uniqueSorted(rows,'sexe'), 'Tous');
    fillFilter('fBV',      uniqueSorted(rows,'nom_bv'), 'Tous les bureaux');

    ['fCommune','fCirc','fSexe','fBV'].forEach(id =>
      document.getElementById(id)?.addEventListener('change', () => applyFilters(rows))
    );
    document.getElementById('fReset')?.addEventListener('click', () => {
      ['fCommune','fCirc','fSexe','fBV'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      applyFilters(rows);
    });

    document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile')?.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const newRows = await importFile(f);
        alert(`${newRows.length} électeurs importés. Les données restent sur votre appareil.`);
        location.reload();
      } catch(err) {
        alert('Erreur d\'import : ' + err.message);
      }
    });
    document.getElementById('exportBtn')?.addEventListener('click', exportJSON);
    document.getElementById('clearBtn')?.addEventListener('click', clearAll);

    renderTable(rows);
    updateGlobalKPIs(rows);
    pushToMap(rows);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
