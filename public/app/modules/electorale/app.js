(async () => {
  const INDICATORS = {
    electeurs:        { label: "Nombre d'électeurs",   short: "Électeurs",       fmt: (v)=>v.toLocaleString('fr-FR') },
    bureaux:          { label: "Bureaux de vote",      short: "Bureaux",         fmt: (v)=>v.toLocaleString('fr-FR') },
    circonscriptions: { label: "Circonscriptions",     short: "Circonscriptions",fmt: (v)=>v.toLocaleString('fr-FR') },
  };
  const PALETTE = ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'];
  const CLASS_LABELS = ['Très faible','Faible','Moyen','Élevé','Très élevé'];

  const $ = (id) => document.getElementById(id);

  // --- Load data ---
  const [geo, elections] = await Promise.all([
    fetch('data/communes.geojson').then(r=>r.json()),
    fetch('data/elections.json').then(r=>r.json()),
  ]);
  let chefLieu = null;
  try { chefLieu = await fetch('data/chef_lieu.geojson').then(r=>r.json()); } catch(e){}

  // Attach electoral data to each feature
  geo.features.forEach(f => {
    const name = f.properties.nom_commun;
    const e = elections[name] || {};
    f.properties.electeurs = e.electeurs ?? null;
    f.properties.bureaux = e.bureaux ?? null;
    f.properties.circonscriptions = e.circonscriptions ?? null;
    f.properties.nom_ar = e.nom_ar ?? '';
  });

  // --- State ---
  const state = {
    indicator: 'electeurs',
    activeClass: null,   // 0..4 or null
    selectedCommune: null,
    sortDesc: true,
  };

  // --- Map ---
  const map = L.map('map', { zoomControl: true, scrollWheelZoom: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  let geoLayer = null;
  let chefLayer = null;

  function getBreaks(values){
    const sorted = values.filter(v=>v!=null).slice().sort((a,b)=>a-b);
    if (!sorted.length) return [0,0,0,0,0,0];
    const q = (p) => {
      const idx = (sorted.length-1)*p;
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return sorted[lo] + (sorted[hi]-sorted[lo])*(idx-lo);
    };
    return [sorted[0], q(0.2), q(0.4), q(0.6), q(0.8), sorted[sorted.length-1]];
  }
  let breaks = [];
  function classify(v){
    if (v==null) return -1;
    for (let i=0;i<5;i++){ if (v <= breaks[i+1]) return i; }
    return 4;
  }
  function colorFor(v){
    const c = classify(v);
    return c<0 ? '#cbd5e1' : PALETTE[c];
  }

  function styleFeature(f){
    const v = f.properties[state.indicator];
    const c = classify(v);
    const dim = (state.activeClass!=null && c!==state.activeClass);
    return {
      color:'#1e293b',
      weight: state.selectedCommune===f.properties.nom_commun ? 3 : 1,
      fillColor: colorFor(v),
      fillOpacity: dim ? 0.15 : 0.78,
      opacity: dim ? 0.4 : 1,
    };
  }

  function onEachFeature(f, layer){
    const p = f.properties;
    layer.bindTooltip(`<div class="commune-tooltip"><b>${p.nom_commun}</b><br>${p.nom_ar||''}<br>${INDICATORS[state.indicator].short}: ${INDICATORS[state.indicator].fmt(p[state.indicator]??0)}</div>`, {sticky:true});
    layer.on('click', () => {
      state.selectedCommune = p.nom_commun;
      updateAll();
      const popup = `<div class="pop-title">${p.nom_commun} <span style="color:#64748b;font-weight:400;font-size:12px">${p.nom_ar||''}</span></div>
        <div class="pop-row"><span>Électeurs</span><b>${(p.electeurs||0).toLocaleString('fr-FR')}</b></div>
        <div class="pop-row"><span>Bureaux de vote</span><b>${p.bureaux||0}</b></div>
        <div class="pop-row"><span>Circonscriptions</span><b>${p.circonscriptions||0}</b></div>`;
      layer.bindPopup(popup).openPopup();
    });
  }

  function rebuildMap(){
    const values = geo.features.map(f=>f.properties[state.indicator]);
    breaks = getBreaks(values);
    if (geoLayer) geoLayer.remove();
    geoLayer = L.geoJSON(geo, { style: styleFeature, onEachFeature }).addTo(map);
    if (!map._didFit){ map.fitBounds(geoLayer.getBounds(), { padding:[20,20] }); map._didFit = true; }
    if (chefLieu && !chefLayer){
      chefLayer = L.geoJSON(chefLieu, {
        pointToLayer: (f, latlng) => L.marker(latlng, {
          icon: L.divIcon({ className:'cl-icon', html:'<div style="font-size:18px">★</div>', iconSize:[20,20] })
        }).bindTooltip(f.properties?.nom_commun || f.properties?.name || 'Chef-lieu')
      }).addTo(map);
    }
  }

  // --- Legend ---
  function renderLegend(){
    const el = $('legend');
    const fmt = INDICATORS[state.indicator].fmt;
    let html = `<h4>${INDICATORS[state.indicator].label}</h4>`;
    for (let i=4;i>=0;i--){
      const lo = breaks[i], hi = breaks[i+1];
      html += `<div class="legend-row ${state.activeClass!=null && state.activeClass!==i?'dim':''}" data-cls="${i}">
        <span class="legend-swatch" style="background:${PALETTE[i]}"></span>
        <span>${CLASS_LABELS[i]} <span style="color:#64748b">(${fmt(Math.round(lo))} – ${fmt(Math.round(hi))})</span></span>
      </div>`;
    }
    html += `<div class="legend-reset ${state.activeClass!=null?'visible':''}" id="legendReset">Réinitialiser le filtre</div>`;
    el.innerHTML = html;
    el.querySelectorAll('.legend-row').forEach(row => {
      row.addEventListener('click', () => {
        const c = parseInt(row.dataset.cls,10);
        state.activeClass = (state.activeClass===c) ? null : c;
        updateAll();
      });
    });
    const reset = $('legendReset');
    if (reset) reset.addEventListener('click', () => { state.activeClass=null; updateAll(); });
  }

  // --- Stats ---
  function renderGlobals(){
    const sum = (k) => geo.features.reduce((s,f)=>s+(f.properties[k]||0),0);
    $('kpiElecteurs').textContent = sum('electeurs').toLocaleString('fr-FR');
    $('kpiBureaux').textContent   = sum('bureaux').toLocaleString('fr-FR');
    $('kpiCircons').textContent   = sum('circonscriptions').toLocaleString('fr-FR');
    $('kpiCommunes').textContent  = geo.features.length;
  }

  // --- Commune panel ---
  function renderCommunePanel(){
    const f = geo.features.find(f => f.properties.nom_commun === state.selectedCommune) || geo.features[0];
    const p = f.properties;
    state.selectedCommune = p.nom_commun;
    $('communeName').innerHTML = `${p.nom_commun} <span style="color:#64748b;font-weight:400;font-size:13px">${p.nom_ar||''}</span>`;
    const total = geo.features.reduce((s,f)=>s+(f.properties[state.indicator]||0),0);
    const pct = total ? ((p[state.indicator]||0)/total*100) : 0;
    $('communeKpis').innerHTML = `
      <div class="commune-kpi"><span>Électeurs</span><b>${(p.electeurs||0).toLocaleString('fr-FR')}</b></div>
      <div class="commune-kpi"><span>Bureaux de vote</span><b>${p.bureaux||0}</b></div>
      <div class="commune-kpi"><span>Circonscriptions</span><b>${p.circonscriptions||0}</b></div>
      <div class="commune-kpi"><span>Part de ${INDICATORS[state.indicator].short.toLowerCase()}</span><b>${pct.toFixed(1)}%</b></div>`;
  }

  // --- Charts ---
  let rankingChart = null, pieChart = null;
  function renderCharts(){
    const indicator = state.indicator;
    const items = geo.features.map(f => ({
      name: f.properties.nom_commun,
      value: f.properties[indicator]||0,
      cls: classify(f.properties[indicator]),
    })).sort((a,b)=> state.sortDesc ? b.value-a.value : a.value-b.value);

    const labels = items.map(i=>i.name);
    const values = items.map(i=>i.value);
    const colors = items.map(i => state.activeClass!=null && i.cls!==state.activeClass ? '#e2e8f0' : PALETTE[i.cls]);

    $('rankingTitle').textContent = `Classement — ${INDICATORS[indicator].label}`;

    if (rankingChart) rankingChart.destroy();
    rankingChart = new Chart($('rankingChart'), {
      type:'bar',
      data:{ labels, datasets:[{ data: values, backgroundColor: colors, borderRadius:4 }] },
      options:{
        indexAxis:'y', maintainAspectRatio:false, responsive:true,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=> INDICATORS[indicator].fmt(c.parsed.x) }}},
        scales:{ x:{ ticks:{ font:{size:10} } }, y:{ ticks:{ font:{size:10} } } },
        onClick: (_,els) => { if (els[0]){ state.selectedCommune = labels[els[0].index]; updateAll(); } }
      }
    });

    if (pieChart) pieChart.destroy();
    pieChart = new Chart($('pieChart'), {
      type:'doughnut',
      data:{ labels, datasets:[{ data: values, backgroundColor: items.map(i=>PALETTE[i.cls]), borderWidth:1, borderColor:'#fff' }] },
      options:{ maintainAspectRatio:false, responsive:true, plugins:{ legend:{ display:false } } }
    });
  }

  // --- Search ---
  function buildSearchList(){
    const dl = $('communeList');
    dl.innerHTML = geo.features.map(f=>`<option value="${f.properties.nom_commun}">`).join('');
  }

  // --- Wire up ---
  function updateAll(){
    if (geoLayer) geoLayer.setStyle(styleFeature);
    geoLayer && geoLayer.eachLayer(l => {
      const p = l.feature.properties;
      l.setTooltipContent(`<div class="commune-tooltip"><b>${p.nom_commun}</b><br>${p.nom_ar||''}<br>${INDICATORS[state.indicator].short}: ${INDICATORS[state.indicator].fmt(p[state.indicator]??0)}</div>`);
    });
    renderLegend();
    renderGlobals();
    renderCommunePanel();
    renderCharts();
  }

  $('indicatorSelect').addEventListener('change', e => { state.indicator = e.target.value; state.activeClass=null; rebuildMap(); updateAll(); });
  $('sortToggle').addEventListener('click', () => { state.sortDesc = !state.sortDesc; renderCharts(); });
  $('communeSearch').addEventListener('change', (e) => {
    const v = e.target.value.trim();
    const f = geo.features.find(x=>x.properties.nom_commun.toLowerCase()===v.toLowerCase());
    if (f){ state.selectedCommune = f.properties.nom_commun; updateAll();
      geoLayer.eachLayer(l=>{ if (l.feature===f){ map.fitBounds(l.getBounds(), {padding:[40,40]}); l.fire('click'); }});
    }
  });

  // iframe resize compat
  window.addEventListener('message', (e) => { if (e.data?.type==='HUB:VISIBLE'){ setTimeout(()=> map.invalidateSize(), 100); }});

  buildSearchList();
  rebuildMap();
  state.selectedCommune = geo.features[0].properties.nom_commun;
  updateAll();
})();
