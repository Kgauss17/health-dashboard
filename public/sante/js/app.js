(() => {
  // Fullscreen
  let map = null; // Leaflet map (initialized later)
  const state = {
    santeIndicators: [],
    joinedCommunesFC: null,
    santeAuxGaugeKey: null,
    santeClassByCommune: new Map(),
    activeClassFilter: null,
    santeBatBreakdown: null,
    santeFieldKeys: {},
    santeGaugeExtents: null,
    etabIndexByCommune: new Map(),
    etabCountsReady: false
  };
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnLinesFocus = document.getElementById("btnLinesFocus");
  let btnToggleAmbulance = null;
  let showAmbulanceIcons = true;
  let btnToggleEtablissements = null;
  let showEtablissements = false;
  let layoutResizeTimer = null;
  function scheduleLayoutResize(delay){
    const wait = (typeof delay === "number" && Number.isFinite(delay)) ? delay : 120;
    if (layoutResizeTimer) clearTimeout(layoutResizeTimer);
    layoutResizeTimer = setTimeout(() => {
      if (map) map.invalidateSize();
      if (legendChart) legendChart.resize();
      if (linesChart) linesChart.resize();
    }, wait);
  }
  function isFullscreen(){
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  async function toggleFullscreen(){
    const chartContainer = document.getElementById("linesPanel");
    if (!chartContainer){
      console.warn("[FULLSCREEN] linesPanel container not found");
      return;
    }
    try{
      if (!isFullscreen()){
        if (chartContainer.requestFullscreen) await chartContainer.requestFullscreen();
        else if (chartContainer.webkitRequestFullscreen) await chartContainer.webkitRequestFullscreen();
        else if (chartContainer.mozRequestFullScreen) await chartContainer.mozRequestFullScreen();
        else if (chartContainer.msRequestFullscreen) await chartContainer.msRequestFullscreen();
        else {
          console.warn("[FULLSCREEN] Fullscreen API not supported");
          return;
        }
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
        else if (document.msExitFullscreen) await document.msExitFullscreen();
      }
    } catch(e){
      console.warn("[FULLSCREEN] Fullscreen not available:", e);
      if (e.name === "NotAllowedError"){
        console.warn("[FULLSCREEN] Iframe may need allowfullscreen attribute");
      }
    }
  }
  if (btnFullscreen) btnFullscreen.addEventListener("click", toggleFullscreen);
  function handleFullscreenChange(){
    const chartContainer = document.getElementById("linesPanel");
    const isFs = isFullscreen();
    if (btnFullscreen){
      btnFullscreen.textContent = isFs ? "⤢" : "⛶";
      btnFullscreen.title = isFs ? "Quitter le plein écran" : "Mode plein écran";
    }
    if (chartContainer){
      chartContainer.classList.toggle("is-fullscreen", isFs);
    }
    if (isFs && linesChart){
      setTimeout(() => {
        if (linesChart && typeof linesChart.resize === "function"){
          linesChart.resize();
          linesChart.update("none");
        }
      }, 100);
    } else if (linesChart){
      setTimeout(() => {
        if (linesChart && typeof linesChart.resize === "function"){
          linesChart.resize();
        }
      }, 100);
    }
    scheduleLayoutResize(180);
  }
  if (document){
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
  }
  function toggleLinesFocus(){
    const next = !document.body.classList.contains("lines-focus");
    document.body.classList.toggle("lines-focus", next);
    document.documentElement.classList.toggle("lines-focus", next);
    if (btnLinesFocus){
      btnLinesFocus.classList.toggle("is-active", next);
      btnLinesFocus.setAttribute("aria-pressed", next ? "true" : "false");
      btnLinesFocus.title = next ? "Reduire le graphe" : "Agrandir le graphe";
    }
    updateExpandChartButtonText();
    scheduleLayoutResize(140);
  }
  if (btnLinesFocus) btnLinesFocus.addEventListener("click", toggleLinesFocus);
  function setAmbulanceVisible(next){
    showAmbulanceIcons = !!next;
    if (btnToggleAmbulance){
      btnToggleAmbulance.classList.toggle("is-off", !showAmbulanceIcons);
      btnToggleAmbulance.classList.toggle("is-active", showAmbulanceIcons);
      btnToggleAmbulance.setAttribute("aria-pressed", showAmbulanceIcons ? "true" : "false");
    }
    if (linesChart) linesChart.draw();
  }
  function setEtablissementsVisible(next){
    showEtablissements = !!next;
    if (btnToggleEtablissements){
      btnToggleEtablissements.classList.toggle("is-off", !showEtablissements);
      btnToggleEtablissements.classList.toggle("is-active", showEtablissements);
      btnToggleEtablissements.setAttribute("aria-pressed", showEtablissements ? "true" : "false");
    }
    if (linesChart){
      const active = getLinesToggleState();
      linesChart.data.datasets.forEach((ds) => {
        if (ds._kind === "etab_bar" && ds._key){
          const isToggledOn = active.size ? !!active.get(ds._key) : true;
          ds.hidden = !showEtablissements || !isToggledOn;
        }
      });
      linesChart.update("none");
    }
  }

  // Dock / Undock + Drag (désactivé dans la version "side panel")
  // Ancien système de panel flottant : conservé en no-op pour compatibilité.
  /* BEGIN_NOOP_DOCK
// Dock / Undock + Drag
  const panel = document.getElementById("panel");
  const btnDock = document.getElementById("btnDock");
  const btnHidePanel = document.getElementById("btnHidePanel");
  const dockHandle = document.getElementById("dockHandle");
  const panelHeader = document.getElementById("panelHeader");

  let docked = true;
  let dragging = false;
  let dragStart = {x:0,y:0, left:0, top:0};

  function setDocked(nextDocked){
    docked = nextDocked;
    panel.classList.toggle("docked", docked);
    panel.classList.toggle("undocked", !docked);

    if (docked){
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "16px";
      btnDock.title = "Undock (panneau flottant)";
      btnDock.textContent = "⧉";
    } else {
      const r = panel.getBoundingClientRect();
      panel.style.right = "";
      panel.style.left = Math.max(8, r.left) + "px";
      panel.style.top  = Math.max(8, r.top) + "px";
      btnDock.title = "Dock (ancrer en haut à droite)";
      btnDock.textContent = "📌";
    }
  }

  if (btnDock) btnDock.addEventListener("click", (e) => {
    e.stopPropagation();
    setDocked(!docked);
  });

  if (btnHidePanel) btnHidePanel.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.style.display = "none";
    dockHandle.classList.add("show");
  });

  if (dockHandle) dockHandle.addEventListener("click", () => {
    dockHandle.classList.remove("show");
    panel.style.display = "";
    setTimeout(() => { if (map) map.invalidateSize(); if (legendChart) legendChart.resize(); }, 0);
  });

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function onPointerDown(ev){
    if (docked) return;
    dragging = true;
    panel.setPointerCapture(ev.pointerId);

    const r = panel.getBoundingClientRect();
    dragStart.x = ev.clientX;
    dragStart.y = ev.clientY;
    dragStart.left = r.left;
    dragStart.top  = r.top;
  }

  function onPointerMove(ev){
    if (!dragging || docked) return;
    const dx = ev.clientX - dragStart.x;
    const dy = ev.clientY - dragStart.y;

    const nextLeft = dragStart.left + dx;
    const nextTop  = dragStart.top + dy;

    const maxLeft = window.innerWidth - 40;
    const maxTop  = window.innerHeight - 40;

    panel.style.left = clamp(nextLeft, 8, maxLeft) + "px";
    panel.style.top  = clamp(nextTop, 8, maxTop) + "px";
  }

  function onPointerUp(ev){
    if (!dragging) return;
    dragging = false;
    try{ panel.releasePointerCapture(ev.pointerId); } catch(_){}
  }

  if (panelHeader) panelHeader.addEventListener("pointerdown", onPointerDown);
  if (panelHeader) panelHeader.addEventListener("pointermove", onPointerMove);
  if (panelHeader) panelHeader.addEventListener("pointerup", onPointerUp);
  if (panelHeader) panelHeader.addEventListener("pointercancel", onPointerUp);

  END_NOOP_DOCK */

  // Leaflet map init
  map = L.map('map', { zoomControl: true, preferCanvas: true });

  const basePane = map.createPane("basePane");
  if (basePane && basePane.style){
    basePane.style.zIndex = "200";
    basePane.style.pointerEvents = "none";
  }
  const communesPane = map.createPane("pane-communes");
  if (communesPane && communesPane.style){
    communesPane.style.zIndex = "400";
    communesPane.style.pointerEvents = "auto";
  }
  const provincePane = map.createPane("pane-province");
  if (provincePane && provincePane.style){
    provincePane.style.zIndex = "450";
    provincePane.style.pointerEvents = "none";
  }
  const chefLieuPane = map.createPane("pane-chef-lieu");
  if (chefLieuPane && chefLieuPane.style){
    chefLieuPane.style.zIndex = "650";
    chefLieuPane.style.pointerEvents = "none";
  }
  const douarsPane = map.createPane("pane-douars");
  if (douarsPane && douarsPane.style){
    douarsPane.style.zIndex = "620";
    douarsPane.style.pointerEvents = "none";
  }
  const etabPane = map.createPane("pane-etab");
  if (etabPane && etabPane.style){
    etabPane.style.zIndex = "700";
    etabPane.style.pointerEvents = "auto";
  }
  const popupPane = map.createPane("pane-popup");
  if (popupPane && popupPane.style){
    popupPane.style.zIndex = "800";
    popupPane.style.pointerEvents = "auto";
  }

  const MAPBOX_TOKEN = (typeof window !== "undefined" && window.MAPBOX_TOKEN)
    ? String(window.MAPBOX_TOKEN).trim()
    : "YOUR_MAPBOX_TOKEN";
  const hasMapboxToken = !!MAPBOX_TOKEN && MAPBOX_TOKEN !== "YOUR_MAPBOX_TOKEN";
  let mapboxTopoLayer = null;
  if (!hasMapboxToken){
    console.warn("[MAPBOX] Missing token: set window.MAPBOX_TOKEN or MAPBOX_TOKEN constant.");
  } else {
    const topoUrl = "https://api.mapbox.com/styles/v1/nabiltopo/ckh8drqui33jk19s00yvc744o/tiles/512/{z}/{x}/{y}@2x?access_token=" + MAPBOX_TOKEN;
    mapboxTopoLayer = L.tileLayer(topoUrl, {
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 20,
      pane: "basePane",
      attribution: "© Mapbox © OpenStreetMap"
    });
  }

  const esriSat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, attribution: 'Imagery © Esri', pane: "basePane" }
  );

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20, attribution: '© OpenStreetMap', pane: "basePane"
  });

  L.control.scale({ metric: true, imperial: false }).addTo(map);
  map.on("zoomend", updateDouarsLabelsByZoom);
  const baseLayers = {};
  if (mapboxTopoLayer) baseLayers["Carte topographique"] = mapboxTopoLayer;
  baseLayers["Satellite"] = esriSat;
  baseLayers["OSM"] = osm;
  if (mapboxTopoLayer) mapboxTopoLayer.addTo(map);
  else esriSat.addTo(map);
  L.control.layers(baseLayers, null, { position: "topleft" }).addTo(map);
  if (mapboxTopoLayer) console.info("[BASEMAP] default=Carte topographique, alt=Satellite");
  else console.info("[BASEMAP] default=Satellite, alt=Carte topographique (disabled)");

  function ensureMapFullscreenStyle(){
    if (typeof document === "undefined") return;
    if (document.getElementById("mapFullscreenStyle")) return;
    const style = document.createElement("style");
    style.id = "mapFullscreenStyle";
    style.textContent =
      ".leaflet-container.is-fullscreen{" +
      "position:fixed; inset:0; width:100vw; height:100vh; z-index:99999; background:#000;" +
      "}" +
      ".leaflet-container.is-fullscreen .leaflet-control-container{pointer-events:auto;}";
    document.head.appendChild(style);
  }

  function isMapFullscreen(container){
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    return !!(container && el === container);
  }

  function toggleMapFullscreen(container){
    if (!container) return;
    if (isMapFullscreen(container)){
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (container.requestFullscreen) container.requestFullscreen();
    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
  }

  function addMapFullscreenControl(){
    if (!map) return;
    const container = map.getContainer();
    if (!container) return;
    ensureMapFullscreenStyle();
    const control = L.control({ position: "topright" });
    control.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar");
      const link = L.DomUtil.create("a", "", div);
      link.href = "#";
      link.title = "Plein écran";
      link.setAttribute("aria-label", "Plein écran");
      link.innerHTML = "[]";
      L.DomEvent.on(link, "click", (e) => {
        L.DomEvent.preventDefault(e);
        toggleMapFullscreen(container);
      });
      return div;
    };
    control.addTo(map);
    const onFsChange = () => {
      const active = isMapFullscreen(container);
      container.classList.toggle("is-fullscreen", active);
      setTimeout(() => { if (map) map.invalidateSize(true); }, 120);
    };
    if (typeof document !== "undefined"){
      document.addEventListener("fullscreenchange", onFsChange);
      document.addEventListener("webkitfullscreenchange", onFsChange);
    }
    console.info("[UI] fullscreen control added");
  }

  addMapFullscreenControl();

  function createMapLegendControl(){
    if (!map || mapLegendControl) return;
    mapLegendControl = L.control({ position: "bottomright" });
    mapLegendControl.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend");
      mapLegendEl = div;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    };
    mapLegendControl.addTo(map);
  }

  function renderMapLegend(){
    if (!map) return;
    if (!mapLegendControl) createMapLegendControl();
    if (!mapLegendEl) return;
    
    // SVG étoile pour Chef-lieu
    const chefSvg =
      "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">" +
        "<path d=\"M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5z\" " +
        "fill=\"#FFD54A\" stroke=\"#111\" stroke-width=\"1\"/>" +
      "</svg>";
    
    // Génération HTML de la légende (Chef-lieu + Communes uniquement)
    let html = "<div class=\"map-legend-title\">L\u00e9gende</div>";
    html += "<div class=\"map-legend-section\">";
    html += "<div class=\"map-legend-section-title\">Symboles</div>";
    
    // Item Chef-lieu de commune
    html += "<div class=\"map-legend-item\">" +
      "<span class=\"map-legend-icon\">" + chefSvg + "</span>" +
      "<span class=\"map-legend-label\">Chef-lieu de commune</span>" +
      "</div>";
    
    // Item Douars (symbole)
    html += "<div class=\"map-legend-item\">" +
      "<span class=\"map-legend-dot\"></span>" +
      "<span class=\"map-legend-label\">Douars</span>" +
      "</div>";
    
    // Établissements de santé
    const etabLegendItems = [
      { label: "H\u00f4pital", icon: "assets/formes/hopital.png" },
      { label: "CS urbain", icon: "assets/formes/cs_urbain.png" },
      { label: "CS rural", icon: "assets/formes/cs_rural.png" },
      { label: "Dispensaire", icon: "assets/formes/disponsaire.png" },
      { label: "SRES", icon: "assets/formes/SRES.png" }
    ];
    etabLegendItems.forEach((item) => {
      html += "<div class=\"map-legend-item\">" +
        "<img class=\"map-legend-icon\" src=\"" + item.icon + "\" alt=\"\">" +
        "<span class=\"map-legend-label\">" + escapeHtml(item.label) + "</span>" +
        "</div>";
    });
    
    html += "</div>";
    html += "<div class=\"map-legend-section\">";
    html += "<div class=\"map-legend-section-title\">Couches</div>";
    
    // Item checkbox Communes
    html += "<div class=\"map-legend-item\">" +
      "<label style=\"display:flex; align-items:center; gap:6px; cursor:pointer;\">" +
        "<input type=\"checkbox\" id=\"communesLegendToggle\" style=\"margin:0\" " + (showCommunes ? "checked" : "") + ">" +
        "<span class=\"map-legend-label\">Communes</span>" +
      "</label>" +
      "</div>";
    
    // Item checkbox Douars
    html += "<div class=\"map-legend-item\">" +
      "<label style=\"display:flex; align-items:center; gap:6px; cursor:pointer;\">" +
        "<input type=\"checkbox\" id=\"douarsLegendToggle\" style=\"margin:0\" " + (showDouars ? "checked" : "") + ">" +
        "<span class=\"map-legend-label\">Douars</span>" +
      "</label>" +
      "</div>";
    
    html += "</div>";
    mapLegendEl.innerHTML = html;
    
    // Listener pour le checkbox Communes
    // NOTE: Pour adapter à d'autres axes, remplacer:
    // - currentCommunesLayer (ou window.__L_COMMUNES) par la variable du layer communes de l'axe
    // - mapLegendEl par l'élément container de la légende
    const communesToggle = mapLegendEl.querySelector("#communesLegendToggle");
    if (communesToggle){
      communesToggle.checked = !!showCommunes;
      communesToggle.addEventListener("change", (e) => {
        const checked = !!e.target.checked;
        showCommunes = checked; // Préserver l'état showCommunes
        
        // Récupérer le layer communes (même logique que applyCommunesVisibility)
        const communesLayer = (typeof window !== "undefined" && window.__L_COMMUNES) 
          ? window.__L_COMMUNES 
          : currentCommunesLayer;
        
        // Toggle directement la couche sur la carte
        if (communesLayer && map) {
          if (checked) {
            if (!map.hasLayer(communesLayer)) communesLayer.addTo(map);
          } else {
            if (map.hasLayer(communesLayer)) map.removeLayer(communesLayer);
          }
        }
        
        // Sauvegarder l'état dans localStorage
        try{
          if (typeof localStorage !== "undefined"){
            localStorage.setItem("ui_showCommunes", showCommunes ? "1" : "0");
          }
        } catch(_){ }
        
        // Synchroniser avec le toggle principal (si présent)
        const mainToggle = document.getElementById("santeCommunesToggle");
        if (mainToggle) mainToggle.checked = showCommunes;
        
        console.info("[UI] communes=" + (showCommunes ? "on" : "off"));
       });
     }
     
     // Toggle Douars
     const douarsToggle = mapLegendEl.querySelector("#douarsLegendToggle");
     if (douarsToggle){
       douarsToggle.checked = !!showDouars;
       douarsToggle.addEventListener("change", (e) => {
         showDouars = !!e.target.checked;
         try{
           if (typeof localStorage !== "undefined"){
             localStorage.setItem("ui_showDouars", showDouars ? "1" : "0");
           }
         } catch(_){ }
         applyDouarsToggle();
       });
     }
   }

  function estimateChefLieuLabelSize(name){
    const label = String(name || "");
    const width = Math.max(40, Math.round(label.length * 6.4) + 8);
    return { w: width, h: 14 };
  }

  function makeBox(x, y, w, h){
    return { x1: x, y1: y, x2: x + w, y2: y + h };
  }

  function boxesIntersect(a, b){
    return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
  }

  function intersectsAny(box, boxes){
    for (let i = 0; i < boxes.length; i++){
      if (boxesIntersect(box, boxes[i])) return true;
    }
    return false;
  }

  function buildChefLieuLabelHtml(name, offset){
    const dx = offset && isNumber(offset.dx) ? offset.dx : 14;
    const dy = offset && isNumber(offset.dy) ? offset.dy : -14;
    const style = "transform: translate(" + dx + "px," + dy + "px)";
    return "<div class=\"chef-lieu-label\" style=\"" + style + "\">" + escapeHtml(name) + "</div>";
  }

  function buildCommuneLabelHtml(name){
    return "<div class=\"commune-label\">" + escapeHtml(name) + "</div>";
  }

  function addCommuneLabels(communesLayer){
    if (!map || !communesLayer) return;
    
    // Supprimer les anciens labels s'ils existent
    if (window.__communeLabelsLayer){
      try{ map.removeLayer(window.__communeLabelsLayer); } catch(_){}
      window.__communeLabelsLayer = null;
    }
    
    const labelLayer = L.layerGroup();
    communesLayer.eachLayer((layer) => {
      const feature = layer.feature;
      if (!feature) return;
      const name = getFeatureName(feature, 0);
      if (!name) return;
      
      // Obtenir le centre de la commune
      const bounds = layer.getBounds();
      if (!bounds || !bounds.isValid()) return;
      const center = bounds.getCenter();
      
      // Créer le label
      const label = L.marker(center, {
        icon: L.divIcon({
          className: "commune-label-wrap",
          html: buildCommuneLabelHtml(name),
          iconSize: [null, null],
          iconAnchor: [0, 0]
        }),
        interactive: false,
        zIndexOffset: 500,
        pane: "pane-communes"
      });
      labelLayer.addLayer(label);
    });
    
    labelLayer.addTo(map);
    window.__communeLabelsLayer = labelLayer;
  }

  function updateEtabVisibility(){
    if (!map || !santeEtabLayer || !santeEtabMarkers.length) return;
    const shouldShow = !!santeEtabVisible;
    const hasLayer = map.hasLayer(santeEtabLayer);
    if (shouldShow && !hasLayer) santeEtabLayer.addTo(map);
    if (!shouldShow && hasLayer) map.removeLayer(santeEtabLayer);
    santeEtabMarkers.forEach((entry) => {
      entry.hidden = !shouldShow;
    });
  }

  function applyChefLieuLayout(){
    if (!map) return;
    const symbolBoxes = [];
    const labelBoxes = [];
    const etabBoxes = [];
    const iconSize = 18;
    const halfIcon = iconSize / 2;
    const offsets = [
      { key: "ne", dx: 14, dy: -14 },
      { key: "n", dx: 0, dy: -18 },
      { key: "nw", dx: -14, dy: -14 }
    ];

    chefLieuPoints.forEach((entry) => {
      const point = map.latLngToLayerPoint(entry.latlng);
      symbolBoxes.push(makeBox(point.x - halfIcon, point.y - halfIcon, iconSize, iconSize));
    });

    if (santeEtabVisible){
      santeEtabMarkers.forEach((entry) => {
        const point = map.latLngToLayerPoint(entry.latlng);
        const size = entry.size || 26;
        etabBoxes.push(makeBox(point.x - size / 2, point.y - size / 2, size, size));
      });
    }

    chefLieuLabelMarkers.forEach((entry) => {
      const point = map.latLngToLayerPoint(entry.latlng);
      const size = estimateChefLieuLabelSize(entry.name);
      let chosen = offsets[0];
      let box = null;
      for (let i = 0; i < offsets.length; i++){
        const candidate = offsets[i];
        const candidateBox = makeBox(point.x + candidate.dx, point.y + candidate.dy, size.w, size.h);
        if (!intersectsAny(candidateBox, labelBoxes) &&
            !intersectsAny(candidateBox, etabBoxes) &&
            !intersectsAny(candidateBox, symbolBoxes)){
          chosen = candidate;
          box = candidateBox;
          break;
        }
      }
      if (!box){
        box = makeBox(point.x + chosen.dx, point.y + chosen.dy, size.w, size.h);
      }
      if (entry.offsetKey !== chosen.key){
        const html = buildChefLieuLabelHtml(entry.name, chosen);
        entry.marker.setIcon(L.divIcon({
          className: "chef-lieu-label-wrap",
          html
        }));
        entry.offsetKey = chosen.key;
      }
      labelBoxes.push(box);
    });

    updateEtabVisibility();
  }

  function scheduleChefLieuLayout(){
    if (!map) return;
    if (chefLieuLayoutTimer) return;
    chefLieuLayoutTimer = setTimeout(() => {
      chefLieuLayoutTimer = null;
      applyChefLieuLayout();
    }, 60);
  }

  function ensureChefLieuLayoutEvents(){
    if (!map || chefLieuLayoutBound) return;
    chefLieuLayoutBound = true;
    map.on("zoomend moveend", scheduleChefLieuLayout);
  }

  // Data + choropleth
  const COMMUNES_PATH = "data/axis/COMMUNES.geojson";
  const ETAB_PATH = "data/axis/ETAB_SANTE.geojson";
  const PV_PATH = "data/boundaries/pv_figuig.geojson";
  const CHEF_LIEU_PATH = "data/boundaries/chef_lieu.geojson";
  const DOUARS_PATH = "data/boundaries/douars.geojson";
  const DOUARS_LABEL_MIN_ZOOM = 12;

  let geojsonData = null;
  let axisSampleProps = null;
  let healthByCommune = new Map();
  let geoLayer = null;
  let currentCommunesLayer = null;
  let boundaryLayer = null;
  let provinceLayer = null;
  let santeEtabLayer = null;
  let santeEtabLayerGroup = null;
  let santeEtabVisible = true;
  let showCommunes = true;
  let douarsPointsLayer = null;
  let douarsLabelsLayer = null;
  let showDouars = false;
  try{
    if (typeof localStorage !== "undefined"){
      const saved = localStorage.getItem("ui_showDouars");
      if (saved === "1") showDouars = true;
    }
  } catch(_){ }
  try{
    if (typeof localStorage !== "undefined"){
      const saved = localStorage.getItem("ui_showCommunes");
      if (saved === "0") showCommunes = false;
    }
  } catch(_){ }
  let santeEtabStats = null;
  let etabCommField = "";
  let etabTypeField = "";
  let etabEtatField = "";
  let mapLegendControl = null;
  let mapLegendEl = null;
  const mapNameToLayer = new Map();
  let chefLieuPoints = [];
  let chefLieuLabelMarkers = [];
  let santeEtabMarkers = [];
  let chefLieuLayoutTimer = null;
  let chefLieuLayoutBound = false;
  let appReadyFired = false;
  let santeReadyLogged = false;
  const axisId = "sante";
  let santeReadyCommunes = false;
  let santeReadyEtab = false;
  let santeChartsPending = false;
  let santeBoundaryIsFallback = false;
  let santeBoundaryLogged = false;
  let santeJoinMissLogged = false;
  let santeJoinGenericLogged = false;
  let santeEtabKeysLogged = false;
  let santeEtabTypeLogged = false;
  let santeEtabStatsLogged = false;
  let santeEtabFieldsLogged = false;
  let santeUiLogged = false;
  let themeSanteLogged = false;
  let themeClassesReady = false;
  let themeGaugesReady = false;
  let santeGaugesSaasLogged = false;
  let santeGaugesReady = false;
  let santeCompareReady = false;
  let santeDataLogged = false;
  let lastSanteIndicField = null;
  let lastSanteFieldEmpty = null;
  let lastSanteClassFilterSig = null;
  let santeFieldEmpty = false;
  let santeDataCounts = { communes: null, etab: null, pv: null, chef_lieu: null };
  let santeDataStats = { ipmMin: null, ipmMax: null, hMin: null, hMax: null, ready: false };
  let santeRefreshTimer = null;
  let lastSanteKpiSig = null;
  let lastSanteChartsSig = null;
  let lastSanteGaugesSig = null;
  let lastSanteCrossSig = null;
  let lastSanteCompareKpiSig = null;
  let lastSanteBatSig = null;
  let lastSanteBatDetailSig = null;
  let lastSanteTableSig = null;
  let lastSanteFieldsSig = null;
  let lastSanteLinesSig = null;
  let lastSanteLinesFilterSig = null;
  let lastSanteEtabBarsSig = null;
  let lastSanteFamilyTabsSig = null;
  let lastSanteEtabScopeSig = null;
  const DISABLE_COMPARE_COMMUNES = true;
  const DISABLE_GAUGES = true;
  const gaugeCharts = new Map();
  const gaugeChartSigs = new Map();

  let activeClassIndex = null;
  let isolatedClassIndex = null;

  // UI requirement: 4 classes only.
  const DEFAULT_CLASS_COUNT = 4;
  const DEFAULT_METHOD = "quantile";
  const DEFAULT_SELECTED_FIELD = "ipm_sante_pct";
  function cssVar(name){
    if (typeof document === "undefined" || !document.documentElement) return "";
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function resolveCssColor(value, fallback){
    if (!value) return fallback || "";
    const match = String(value).match(/var\((--[^)]+)\)/);
    if (match){
      const resolved = cssVar(match[1]);
      return resolved || fallback || value;
    }
    return value;
  }

  const SANTE_THEME = {
    indicators: {
      population: "var(--sante-ink)",
      isf: "var(--sante-indigo)",
      handicap: "var(--sante-cyan)",
      ipm_sante: "var(--sante-blue)",
      ipm_conditions: "var(--sante-violet)"
    },
    classes: {
      acceptable: "#ef4444",
      moderee: "var(--sante-cyan)",
      critique: "var(--sante-blue)",
      tres_critique: "#1DE9B6"
    },
    gaugeStops: [
      { from: 0, to: 40, color: "var(--sante-mint)" },
      { from: 40, to: 70, color: "var(--sante-blue)" },
      { from: 70, to: 100, color: "var(--sante-violet)" }
    ],
    etabTypes: {
      hopital: "var(--sante-violet)",
      cs_urbain: "var(--sante-blue)",
      cs_rural: "var(--sante-cyan)",
      dispensaire: "var(--sante-mint)",
      autre: "var(--sante-muted)"
    }
  };
  let santeThemeCache = null;
  function getSanteTheme(){
    if (santeThemeCache) return santeThemeCache;
    const resolve = (token, fallback) => resolveCssColor(token, fallback);
    const theme = {
      indicators: {
        population: resolve(SANTE_THEME.indicators.population, "#263238"),
        isf: resolve(SANTE_THEME.indicators.isf, "#5C6BC0"),
        handicap: resolve(SANTE_THEME.indicators.handicap, "#26C6DA"),
        ipm_sante: resolve(SANTE_THEME.indicators.ipm_sante, "#42A5F5"),
        ipm_conditions: resolve(SANTE_THEME.indicators.ipm_conditions, "#7E57C2")
      },
      classes: {
        acceptable: resolve(SANTE_THEME.classes.acceptable, "#ef4444"),
        moderee: resolve(SANTE_THEME.classes.moderee, "#26C6DA"),
        critique: resolve(SANTE_THEME.classes.critique, "#42A5F5"),
        tres_critique: resolve(SANTE_THEME.classes.tres_critique, "#1DE9B6")
      },
      gaugeStops: (SANTE_THEME.gaugeStops || []).map((stop) => ({
        from: stop.from,
        to: stop.to,
        color: resolve(stop.color, "#1DE9B6")
      })),
      etabTypes: {
        hopital: resolve(SANTE_THEME.etabTypes.hopital, "#7E57C2"),
        cs_urbain: resolve(SANTE_THEME.etabTypes.cs_urbain, "#42A5F5"),
        cs_rural: resolve(SANTE_THEME.etabTypes.cs_rural, "#26C6DA"),
        dispensaire: resolve(SANTE_THEME.etabTypes.dispensaire, "#1DE9B6"),
        autre: resolve(SANTE_THEME.etabTypes.autre, "#90A4AE")
      },
      ink: resolve("var(--sante-ink)", "#263238"),
      muted: resolve("var(--sante-muted)", "#90A4AE"),
      border: resolve("var(--sante-border)", "#E6EEF5"),
      accent: resolve("var(--sante-cyan)", "#26C6DA")
    };
    santeThemeCache = theme;
    return theme;
  }

  function getSanteClassPalette(){
    const theme = getSanteTheme();
    // Inverser l'ordre des couleurs
    return [
      theme.classes.tres_critique,
      theme.classes.critique,
      theme.classes.moderee,
      theme.classes.acceptable
    ];
  }

  function getSanteLineColors(){
    const theme = getSanteTheme();
    return {
      population_2024: theme.indicators.population,
      isf: theme.indicators.isf,
      handicap_pct: theme.indicators.handicap,
      ipm_sante_pct: theme.indicators.ipm_sante,
      ipm_conditions_pct: theme.indicators.ipm_conditions
    };
  }

  function getSanteGaugeSegments(){
    const theme = getSanteTheme();
    if (Array.isArray(theme.gaugeStops) && theme.gaugeStops.length){
      return theme.gaugeStops.map((seg) => ({
        from: seg.from,
        to: seg.to,
        color: seg.color
      }));
    }
    return [];
  }

  function getSanteEtabColors(){
    const theme = getSanteTheme();
    return {
      hopital: colorWithAlpha(theme.etabTypes.hopital, 0.4),
      cs_urbain: colorWithAlpha(theme.etabTypes.cs_urbain, 0.4),
      cs_rural: colorWithAlpha(theme.etabTypes.cs_rural, 0.4),
      dispensaire: colorWithAlpha(theme.etabTypes.dispensaire, 0.4),
      autre: colorWithAlpha(theme.etabTypes.autre, 0.4)
    };
  }

  function getSanteEtabBorders(){
    const theme = getSanteTheme();
    return {
      hopital: colorWithAlpha(theme.etabTypes.hopital, 0.75),
      cs_urbain: colorWithAlpha(theme.etabTypes.cs_urbain, 0.75),
      cs_rural: colorWithAlpha(theme.etabTypes.cs_rural, 0.75),
      dispensaire: colorWithAlpha(theme.etabTypes.dispensaire, 0.75),
      autre: colorWithAlpha(theme.etabTypes.autre, 0.75)
    };
  }

  const THEME = {
    aqua: "#34E6D2",
    cyan: "#18C6FF",
    blue: "#2F7BFF",
    indigo: "#5B5FF5",
    mintLt: "#BFF7F0",
    skyLt: "#CFEFFF",
    text: "#24324A",
    grid: "#E9F1F7",
    card: "#FFFFFF",
    primary: "#18C6FF",
    cardBg: "#FFFFFF"
  };
  const GAUGE_STEPS = ["#BFF7F0", "#34E6D2", "#18C6FF", "#2F7BFF", "#5B5FF5"];
  const GAUGE_TRACK = "#E9F1F7";
  const GAUGE_TEXT = "#24324A";
  const GAUGE_UP = "#34E6D2";
  const GAUGE_DOWN = "#E35D6A";
  const SEG_GAUGE_COLORS = ["#C63D2F", "#E2724B", "#F2B66D", "#8BC8B0", "#0B7A6E"];
  const SEG_GAUGE_TRACK = "#E5E7EB";
  const SEG_GAUGE_TICK = "#9CA3AF";
  const SEG_GAUGE_TICK_LINE = "#CBD5E1";
  const SEG_GAUGE_NEEDLE = "#111111";
  const SEG_GAUGE_VALUE = "#C63D2F";
  function getThemePalette(){
    if (axisId === "sante"){
      const theme = getSanteTheme();
      return {
        classesPalette: getSanteClassPalette(),
        chartPalette: [
          theme.indicators.handicap,
          theme.indicators.ipm_sante,
          theme.indicators.ipm_conditions,
          theme.indicators.isf,
          theme.indicators.population
        ],
        gaugePalette: getSanteGaugeSegments().map(seg => seg.color),
        gridColor: theme.border,
        textColor: theme.ink,
        accentColor: theme.accent,
        cardBg: THEME.card || THEME.cardBg
      };
    }
    return {
      classesPalette: [THEME.aqua, THEME.cyan || THEME.primary, THEME.blue, THEME.indigo],
      chartPalette: [THEME.aqua, THEME.cyan || THEME.primary, THEME.blue, THEME.indigo, THEME.mintLt],
      gaugePalette: [THEME.mintLt, THEME.aqua, THEME.cyan || THEME.primary, THEME.blue, THEME.indigo],
      gridColor: THEME.grid,
      textColor: THEME.text,
      accentColor: THEME.cyan || THEME.primary,
      cardBg: THEME.card || THEME.cardBg
    };
  }
  if (typeof window !== "undefined") window.getThemePalette = getThemePalette;
  const CLASS_ID_BY_INDEX = ["faible", "moderee", "elevee", "prioritaire"];
  const CLASS_LABELS = ["Faible","Mod\u00e9r\u00e9e","\u00c9lev\u00e9e","Tr\u00e8s \u00e9lev\u00e9e"];
  const POVERTY_CLASS_LABELS = CLASS_LABELS;

  let selectedField = null;
  let classCount = DEFAULT_CLASS_COUNT;
  let method = DEFAULT_METHOD;

  let breaks = [];
  let classRanges = [];

  const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
  const MISSING = "\u2014";
  const FIELD_MAP = {
    commune: ["Nom_Commun","nom_commun","Commune","NOM","NOM_COMM","name","libelle"],
    population: ["Population 2024","R \u2014 Indicateurs_Communes_RGPH_2024_Population 2024","Pop2024","POP_2024","Population","pop2024","pop"],
    pauvrete: ["Taux de pauvret\u00e9 (en %)","Pauvret\u00e9","Pauvrete","pauvrete","taux_pauvrete","poverty"],
    chomage: ["Taux de ch\u00f4mage (%)","T  de ch\u00f4mage (%)","T de ch\u00f4mage (%)","Ch\u00f4mage","Chomage","chomage","taux_chomage","unemployment"],
    analphabetisme: ["Taux d'analphab\u00e9tisme des 10 ans et plus (%)","T analphab\u00e9tisme 10 ans et plus (%)","Analphab\u00e9tisme","Analphabetisme","analphabetisme","taux_analphabetisme"],
    eau: ["Eau courante (%)","Eau","eau","taux_eau","water"],
    electricite: ["\u00c9lectricit\u00e9 (%)","Electricite (%)","\u00c9lectricit\u00e9","Electricite","electricite","taux_electricite","power"],
    assainissement: ["Assainissement (%)","Assainissement","assainissement","taux_assainissement"],
    activite: ["Taux d'activité (%)","Taux d'activite (%)","Taux d'activité","Taux activite (%)","Taux activite","taux_activite","activite"],
    scolarisation: ["Taux de scolarisation (%)","Taux de scolarisation (en %)","Scolarisation","taux_scolarisation","scolarisation"],
    vulnerabilite: ["Taux de vulnérabilité (en %)","Taux de vulnerabilite (en %)","Taux de vulnérabilité (%)","Taux de vulnerabilite (%)","Vulnérabilité","Vulnerabilite","taux_vulnerabilite"],
  };
  const SANTE_FIELD_CANDIDATES = {
    commune: ["nom_commun","nom_commune","commune","COMMUNE","Nom_Commun"].concat(FIELD_MAP.commune),
    ipm: [
      "IPM par source de privation (en %): Sant\u00e9",
      "IPM par source de privation (en %): Sante"
    ],
    handicap: [
      "T pr\u00e9valence -handicap (%)",
      "T prevalence -handicap (%)"
    ],
    pop: [
      "Pop2014"
    ]
  };
  const SANTE_INDICATORS_BASE = [
    { key: "ipm_sante_pct", label: "IPM Sant\u00e9 (%)", unit: "%", direction: "badHigh" },
    { key: "handicap_pct", label: "Handicap (%)", unit: "%", direction: "badHigh" }
  ];

  function buildSanteIndicators(sampleProps){
    const hasIndex = sampleProps && Object.prototype.hasOwnProperty.call(sampleProps, "sante_index");
    const list = hasIndex
      ? [{ key: "sante_index", label: "Indice Sant\u00e9", unit: "", direction: "goodHigh" }, ...SANTE_INDICATORS_BASE]
      : SANTE_INDICATORS_BASE.slice();
    return list;
  }
  const ETAB_FIELD_CANDIDATES = {
    commune: ["nom_commun","commune","nom_commune","Nom_Commun","Nom_Commune","NOM_COMMUN"],
    type: ["type_etab","Type_Etablissement","type_etablissement","etab_type"],
    etat: ["etat_bat","Batiment_etat","batiment_etat","Etat_Batiment","Etat_batiment"]
  };
  const METRIC_META = {
    population: { label: "Population 2014", unit: "hab", isPercent: false },
    pauvrete: { label: "IPM Sante", unit: "%", isPercent: true },
    chomage: { label: "Handicap", unit: "%", isPercent: true },
    analphabetisme: { label: "Indice Sante", unit: "index", isPercent: false },
    couverture_etab: { label: "Couverture etablissements (par 10k hab)", unit: "per10k", isPercent: false },
    eau: { label: "Eau courante", unit: "%", isPercent: true },
    electricite: { label: "Electricite", unit: "%", isPercent: true },
    assainissement: { label: "Assainissement", unit: "%", isPercent: true }
  };
  const POP_KPIS = [
    { key: "pauvrete", label: "Taux de pauvreté", icon: "assets/icons/taux-pauverete.png", unit: "%" },
    { key: "chomage", label: "Taux de chômage", icon: "assets/icons/taux-chaumage.png", unit: "%" },
    { key: "analphabetisme", label: "Analphabétisme", icon: "assets/icons/taux-analphabetisme.png", unit: "%" },
    { key: "eau", label: "Eau courante", icon: "assets/icons/eau-potable.png", unit: "%" },
    { key: "electricite", label: "Électricité", icon: "assets/icons/electricite.png", unit: "%" },
    { key: "assainissement", label: "Accès à l’assainissement", icon: "assets/icons/Assainissement.png", unit: "%" }
  ];
  const ASSAINISSEMENT_MODE = "access";
  const KPI_GAUGES = [
    { key:"population", label:"Population 2024", unit:"hab", icon:"assets/icons/emploi.png", invert:false, theme:"blue" },
    { key:"pauvrete", label:"Taux de pauvreté", unit:"%", icon:"assets/icons/taux-pauverete.png", invert:true, theme:"traffic" },
    { key:"chomage", label:"Taux de chômage", unit:"%", icon:"assets/icons/taux-chaumage.png", invert:true, theme:"traffic" },
    { key:"analphabetisme", label:"Analphabétisme", unit:"%", icon:"assets/icons/taux-analphabetisme.png", invert:true, theme:"traffic" },
    { key:"eau", label:"Eau courante", unit:"%", icon:"assets/icons/eau-potable.png", invert:false, theme:"traffic" },
    { key:"electricite", label:"Électricité", unit:"%", icon:"assets/icons/electricite.png", invert:false, theme:"traffic" },
    { key:"assainissement", label:"Assainissement", unit:"%", icon:"assets/icons/Assainissement.png", invert:ASSAINISSEMENT_MODE === "no_access", theme:"traffic" }
  ];
  const KPI_ORDER_FALLBACK = [
    "population",
    "pauvrete",
    "chomage",
    "analphabetisme",
    "eau",
    "electricite",
    "assainissement",
    "activite",
    "scolarisation",
    "vulnerabilite"
  ];
  const SANTE_KPI_ORDER = [
    "pauvrete",
    "chomage",
    "analphabetisme",
    "couverture_etab"
  ];
  const KPI_INVERT_FALLBACK = new Set([
    "pauvrete",
    "chomage",
    "analphabetisme",
    "vulnerabilite"
  ]);
  const KPI_KEYS = ["pauvrete","chomage","analphabetisme","couverture_etab"];
  const RADAR_KEYS = ["population","pauvrete","analphabetisme","eau","electricite"];
  const RADAR_COLORS = ["#0f766e","#ea580c","#2563eb"];
  const TABLE_KEYS = ["commune","population","pauvrete","chomage","analphabetisme","eau","electricite"];
  const TABLE_COLUMNS_SANTE = [
    { key:"commune", label:"Commune", type:"text", aliases:["commune","nom_commun","Nom_Commun","Nom_Commune","Nom Commun"] },
    { key:"pop2024", label:"Population 2024", type:"int", aliases:["pop2024","Population 2024","Population2024","Pop2024","Population_2024","Population"] },
    { key:"isf", label:"ISF", type:"float2", aliases:["isf","Indice synthetique de fecondite","Indice synth\u00e9tique de f\u00e9condit\u00e9 -ISF-","ISF"] },
    { key:"handicap", label:"Handicap (%)", type:"pct1", aliases:["handicap","Taux de prevalence du handicap (%)","Taux de pr\u00e9valence du handicap (%)","handicap_pct"] },
    { key:"ipm_sante", label:"IPM Sant\u00e9 (%)", type:"pct1", aliases:["ipm_sante","IPM Sante","D\u00e9composition de l\u2019IPM par source de privation (en %): Sant\u00e9","IPM par source de privation (en %): Sant\u00e9"] },
    { key:"ipm_conditions", label:"IPM Conditions de vie (%)", type:"pct1", aliases:["ipm_conditions","Conditions de vie","D\u00e9composition de l\u2019IPM par source de privation (en %): Conditions de vie","IPM par source de privation (en %): Conditions de vie"] }
  ];
  const NUMERIC_KEYS = ["population","pauvrete","chomage","analphabetisme","eau","electricite"];
  const ALLOWED_KPIS = [
    "pauvrete",
    "chomage",
    "analphabetisme",
    "acces_assainissement",
    "acces_eau",
    "acces_electricite",
    "population_normalisee"
  ];
  const KPI_STYLE = {
    pauvrete: { label: "Pauvreté", family: "socio", color: "#d64b4b", dataKey: "pauvrete", isPercent: true },
    chomage: { label: "Chômage", family: "socio", color: "#e16a6a", dataKey: "chomage", isPercent: true },
    analphabetisme: { label: "Analphabétisme", family: "socio", color: "#f08a8a", dataKey: "analphabetisme", isPercent: true },
    acces_eau: { label: "Eau", family: "services", color: "#3b82f6", dataKey: "eau", isPercent: true },
    acces_electricite: { label: "Électricité", family: "services", color: "#60a5fa", dataKey: "electricite", isPercent: true },
    acces_assainissement: { label: "Assainissement", family: "services", color: "#93c5fd", dataKey: "assainissement", isPercent: true },
    population_normalisee: { label: "Population", family: "demo", color: "#6d28d9", dataKey: "population", isPercent: false }
  };
  const INDICATOR_COLORS = {
    pauvrete: "#D946EF",
    chomage: "#005F73",
    analphabetisme: "#5B21B6",
    acces_eau: "#1D4ED8",
    acces_electricite: "#F97316",
    acces_assainissement: "#16A34A",
    population_normalisee: "#000000"
  };
  const INDICATOR_DASHES = {
    pauvrete: [8, 5],
    chomage: [8, 5],
    analphabetisme: [10, 4, 2, 4]
  };
  const KPI_FAMILIES = {
    sante: { label: "Sant\u00e9", color: "#b91c1c", accent: "#f97316" },
    socio: { label: "Pressions socio-\u00e9conomiques", color: "#D64545", accent: "#F59E0B" },
    services: { label: "Acc\u00e8s aux services essentiels", color: "#1D4ED8", accent: "#14B8A6" },
    capital: { label: "Capital humain & activit\u00e9", color: "#6D28D9", accent: "#A78BFA" },
    demo: { label: "D\u00e9mographie", color: "#15803D", accent: "#22C55E" }
  };
  const KPI_FAMILY_ORDER = ["sante","socio","services","capital","demo"];
  const KPI_FAMILY_FALLBACK = {
    pauvrete: "socio",
    chomage: "socio",
    analphabetisme: "socio",
    vulnerabilite: "socio",
    eau: "services",
    electricite: "services",
    assainissement: "services",
    scolarisation: "capital",
    activite: "capital",
    population: "demo",
    couverture_etab: "sante"
  };
  const KPI_FAMILY_KEYS = {
    sante: ["ipm_sante_pct","handicap_pct","ipm_condvie_pct","isf","pop_2024"],
    socio: ["pauvrete","chomage","analphabetisme","vulnerabilite"],
    services: ["eau","electricite","assainissement"],
    capital: ["scolarisation","activite"],
    demo: ["population"]
  };
  const LINE_GROUPS = [
    { title: "Socio-économique", keys: ["pauvrete", "chomage", "analphabetisme"] },
    { title: "Services de base", keys: ["acces_eau", "acces_electricite", "acces_assainissement"] },
    { title: "Pression démographique", keys: ["population_normalisee"] }
  ];
  const LINES_SERIES = ALLOWED_KPIS
    .map((key) => KPI_STYLE[key] ? ({
      key,
      label: KPI_STYLE[key].label,
      isPercent: KPI_STYLE[key].isPercent,
      color: INDICATOR_COLORS[key] || KPI_STYLE[key].color,
      dataKey: KPI_STYLE[key].dataKey
    }) : null)
    .filter(Boolean);
  const SANTE_LINE_STYLE = {
    population_2024: { label: "Population 2024", isPercent: false },
    isf: { label: "ISF", isPercent: true },
    handicap_pct: { label: "Handicap (%)", isPercent: true },
    ipm_sante_pct: { label: "IPM Santé (%)", isPercent: true },
    ipm_conditions_pct: { label: "IPM Conditions de vie (%)", isPercent: true }
  };
  const SANTE_LINE_DASHES = {};
  const SANTE_ETAB_TICK_COLORS = {
    hopital: "rgba(255, 107, 107, 0.35)",
    cs_urbain: "rgba(255, 159, 67, 0.35)",
    cs_rural: "rgba(29, 209, 161, 0.35)",
    dispensaire: "rgba(95, 39, 205, 0.35)",
    sres: "rgba(255, 193, 7, 0.35)"
  };
  const SANTE_ETAB_BAR_BORDERS = {
    hopital: "rgba(255, 107, 107, 0.60)",
    cs_urbain: "rgba(255, 159, 67, 0.60)",
    cs_rural: "rgba(29, 209, 161, 0.60)",
    dispensaire: "rgba(95, 39, 205, 0.60)",
    sres: "rgba(255, 193, 7, 0.60)"
  };
  const ETAB_ABBR = {
    hopital: "H",
    cs_urbain: "CSU",
    cs_rural: "CSR",
    dispensaire: "DR"
  };
  const SANTE_LINE_GROUPS = [
    { title: "Santé", keys: ["handicap_pct","ipm_sante_pct"] }
  ];
  const SANTE_LINE_SERIES = [
    { key: "handicap_pct", label: "Handicap (%)", dataKey: "handicap_pct", isPercent: true },
    { key: "ipm_sante_pct", label: "IPM Santé (%)", dataKey: "ipm_sante_pct", isPercent: true },
    { key: "population_2024", label: "Population 2024", dataKey: "population_2024", isPercent: false, yAxisID: "yPop" }
  ];
  const PODIUM_DATA = [
    { name: "Bouarfa (Mun.)", score: 98.6, services: 99.0, pauvrete: 3.0, population: 27485 },
    { name: "Figuig (Mun.)", score: 84.2, services: 98.2, pauvrete: 5.9, population: 9903 },
    { name: "Bni Tadjite", score: 77.8, services: 81.0, pauvrete: 16.6, population: 17087 }
  ];
  const COMMUNE_PROFILE_ITEMS = [
    {
      id: "population",
      label: "Population 2024",
      format: "int",
      icons: ["assets/icons/emploi.png"],
      fieldCandidates: FIELD_MAP.population
    },
    {
      id: "pauvrete",
      label: "Taux de pauvrete",
      format: "percent",
      icons: ["assets/icons/taux-pauverete.png"],
      fieldCandidates: FIELD_MAP.pauvrete
    },
    {
      id: "chomage",
      label: "Taux de chomage",
      format: "percent",
      icons: ["assets/icons/taux-chaumage.png"],
      fieldCandidates: FIELD_MAP.chomage
    },
    {
      id: "analphabetisme",
      label: "Analphabetisme",
      format: "percent",
      icons: ["assets/icons/taux-analphabetisme.png"],
      fieldCandidates: FIELD_MAP.analphabetisme
    },
    {
      id: "eau",
      label: "Eau courante",
      format: "percent",
      icons: ["assets/icons/eau-potable.png"],
      fieldCandidates: FIELD_MAP.eau
    },
    {
      id: "electricite",
      label: "Electricite",
      format: "percent",
      icons: ["assets/icons/electricite.png"],
      fieldCandidates: FIELD_MAP.electricite
    }
  ];

  let radarChart = null;
  let selectedCommuneQueue = [];
  let userTouchedSelection = false;
  let dashboardRows = [];
  let dashboardFieldKeys = null;
  let dashboardContext = null;
  let tableSortKey = "commune";
  let tableSortDir = "asc";
  let tableFilterText = "";
  let currentTableRows = [];
  let currentTableColumns = null;
  const warnedFields = new Set();
  let dataDiagnosticsLogged = false;
  let joinDiagnosticsLogged = false;
  let dataEmptyAlerted = false;
  const communesByName = new Map();
  let selectedProfileLayer = null;
  let selectedProfileName = "";
  let profileInitialized = false;
  let communeProfileStats = new Map();

  function escapeHtml(s){
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(v){
    if (!isNumber(v)) return "—";
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  }

  function formatInt(v){
    if (!isNumber(v)) return MISSING;
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  }

  function formatPercent(v){
    if (!isNumber(v)) return MISSING;
    return v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function formatNumber(v){
    if (!isNumber(v)) return MISSING;
    return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  }

  function pickField(properties, candidates){
    if (!properties || !Array.isArray(candidates)) return "";
    for (const c of candidates){
      if (Object.prototype.hasOwnProperty.call(properties, c)) return c;
    }
    const keys = Object.keys(properties);
    const lowerMap = {};
    keys.forEach((k) => { lowerMap[k.toLowerCase()] = k; });
    for (const c of candidates){
      const key = lowerMap[String(c).toLowerCase()];
      if (key) return key;
    }
    for (const c of candidates){
      const frag = String(c).toLowerCase();
      if (!frag) continue;
      const matches = keys.filter((k) => k.toLowerCase().includes(frag));
      if (!matches.length) continue;
      const noColon = matches.filter((k) => !k.includes(":"));
      return noColon[0] || matches[0] || "";
    }
    return "";
  }

  function parseNumberSafe(value){
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;
    const noSpace = raw.replace(/\s+/g, "").replace(/%/g, "");
    let normalized = noSpace;
    if (normalized.includes(",") && normalized.includes(".")){
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(",", ".");
    }
    normalized = normalized.replace(/[^0-9.\-]/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  function parseNumberSmart(input, isPercentField){
    const parsed = (axisId === "sante") ? parseNumberFR(input) : parseNumberSafe(input);
    if (!isNumber(parsed)) return NaN;
    if (axisId !== "sante" && isPercentField){
      const hasPct = typeof input === "string" && input.includes("%");
      if (!hasPct && parsed > 0 && parsed <= 1) return parsed * 100;
    }
    return parsed;
  }

  function parseNumberFR(v){
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string") return null;
    const s = v.trim().replace(/\s+/g, "").replace("%", "").replace(",", ".");
    if (!s) return null;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  function getIndicatorValue(props, field){
    if (!props || !field) return null;
    if (axisId === "sante") return parseNumberFR(props[field]);
    return parseNumberSafe(props[field]);
  }

  const DEBUG_GAUGE_VALUES = false;
  const debugGaugeCommuneNames = new Set();

  function getPercentValue(raw){
    const parsed = parseNumberSafe(raw);
    if (!isNumber(parsed)) return null;
    const hasPct = typeof raw === "string" && raw.includes("%");
    if (!hasPct && parsed <= 1) return parsed * 100;
    return parsed;
  }

  function logGaugeValues(name, items){
    if (!DEBUG_GAUGE_VALUES) return;
    if (!name) return;
    if (!debugGaugeCommuneNames.has(name)){
      if (debugGaugeCommuneNames.size >= 3) return;
      debugGaugeCommuneNames.add(name);
    }
    const rows = items.map((item) => ({
      kpi: item.key,
      raw: item.rawValue,
      percent: item.percentValue,
      gauge: item.gaugeValuePct,
      display: item.gaugeDisplayText
    }));
    console.info("[GAUGE] raw -> final:", name);
    try{ console.table(rows); } catch(_){ console.log(rows); }
  }

  function safeJsonSize(obj){
    try{ return JSON.stringify(obj).length; } catch(_){ return 0; }
  }

  function normalizeCommuneName(value){
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\u2019\u2018]/g, "'")
      .replace(/\s+/g, " ");
  }

  function removeAccentsSimple(value){
    const raw = String(value || "");
    return raw
      .replace(/[\u00e9\u00e8\u00ea\u00eb]/g, "e")
      .replace(/[\u00c9\u00c8\u00ca\u00cb]/g, "E")
      .replace(/[\u00e0\u00e2\u00e4]/g, "a")
      .replace(/[\u00c0\u00c2\u00c4]/g, "A")
      .replace(/[\u00ee\u00ef]/g, "i")
      .replace(/[\u00ce\u00cf]/g, "I")
      .replace(/[\u00f4\u00f6]/g, "o")
      .replace(/[\u00d4\u00d6]/g, "O")
      .replace(/[\u00f9\u00fb\u00fc]/g, "u")
      .replace(/[\u00d9\u00db\u00dc]/g, "U")
      .replace(/[\u00e7]/g, "c")
      .replace(/[\u00c7]/g, "C");
  }

  function stripAccents(value){
    const raw = String(value || "");
    if (raw.normalize){
      return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    return removeAccentsSimple(raw);
  }

  function normalizeKey(value){
    return stripAccents(String(value || ""))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeCommuneKey(value){
    return stripAccents(String(value || ""))
      .trim()
      .toUpperCase()
      .replace(/[\u2019\u2018]/g, "'")
      .replace(/\s+/g, " ");
  }

  function computeMinMax(values){
    const nums = values.filter(isNumber);
    if (!nums.length) return { min: null, max: null };
    let min = nums[0];
    let max = nums[0];
    nums.forEach((v) => {
      if (v < min) min = v;
      if (v > max) max = v;
    });
    return { min, max };
  }

  const ETAB_SYMBOLS = {
    hopital: { symbol: "&#9733;", size: 31 },
    cs_urbain: { symbol: "&#9679;", size: 25 },
    cs_rural: { symbol: "&#9650;", size: 25 },
    dispensaire: { symbol: "&#9632;", size: 22 },
    autre: { symbol: "&#9670;", size: 20 }
  };

  function normalizeEtabType(value){
    const raw = stripAccents(String(value || "")).toLowerCase().trim();
    if (!raw) return "autre";
    const compact = raw.replace(/[^a-z0-9]/g, "");
    if (compact.includes("hp") || compact.includes("hop") || compact.includes("hopital")) return "hopital";
    if (compact.includes("csu")) return "cs_urbain";
    if (compact.includes("csr")) return "cs_rural";
    if (compact.includes("dr") || compact.includes("disp")) return "dispensaire";
    if (compact.includes("sres")) return "sres";
    return "autre";
  }

  function normalizeEtatBat(value){
    const raw = stripAccents(String(value || "")).toLowerCase().trim();
    if (!raw) return "nc";
    if (raw.includes("bon")) return "bon";
    if (raw.includes("moy")) return "moyen";
    if (raw.includes("mauv")) return "mauvais";
    return "nc";
  }

  function formatEtatBatLabel(key){
    if (key === "bon") return "Bon";
    if (key === "moyen") return "Moyen";
    if (key === "mauvais") return "Mauvais";
    return "NC";
  }

  function normalizeOuiNon(value){
    const state = parseFonctionnel(value);
    if (state === true) return "oui";
    if (state === false) return "non";
    return "nc";
  }

  function getFeaturePointCoords(feature){
    const coordsList = [];
    const geom = feature && feature.geometry ? feature.geometry : null;
    if (!geom) return coordsList;
    if (geom.type === "Point" && Array.isArray(geom.coordinates)){
      coordsList.push(geom.coordinates);
    } else if (geom.type === "MultiPoint" && Array.isArray(geom.coordinates)){
      geom.coordinates.forEach((coords) => coordsList.push(coords));
    }
    return coordsList.filter((coords) => {
      if (!Array.isArray(coords) || coords.length < 2) return false;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
  }

  function resolveEtabFieldKey(features, candidates){
    if (!Array.isArray(features) || !candidates || !candidates.length) return "";
    for (const feature of features){
      const props = feature && feature.properties ? feature.properties : null;
      if (!props) continue;
      const key = resolveFieldByCandidates(props, candidates);
      if (key) return key;
    }
    return "";
  }

  function getEtabFieldValue(props, key, candidates){
    if (!props) return null;
    if (key){
      const val = props[key];
      if (val !== undefined) return val;
    }
    if (!candidates || !candidates.length) return null;
    return resolveProp(props, candidates);
  }

  function getActiveEtabFeatures(){
    const stats = santeEtabStats || {};
    const all = Array.isArray(stats.features) ? stats.features : [];
    const selected = Array.isArray(selectedCommuneQueue) ? selectedCommuneQueue : [];
    const selectedKeys = selected.map(normalizeCommuneKey).filter(Boolean);
    let scope = "all";
    let list = all;
    if (selectedKeys.length){
      scope = "selected";
      const set = new Set(selectedKeys);
      list = all.filter((feature) => {
        const props = feature && feature.properties ? feature.properties : {};
        const raw = getEtabFieldValue(props, etabCommField, ETAB_FIELD_CANDIDATES.commune);
        const norm = normalizeCommuneKey(raw);
        return norm && set.has(norm);
      });
    }
    const total = list.reduce((sum, feature) => sum + getFeaturePointCoords(feature).length, 0);
    const sig = [scope, total, selectedKeys.join(",")].join("|");
    if (sig !== lastSanteEtabScopeSig){
      lastSanteEtabScopeSig = sig;
      console.info("[SANTE_ETAB_SCOPE] scope=" + scope + " n=" + total);
    }
    return list;
  }

  function computeRHTotals({ features, communeName = null, allowedCommunes = null, useCommunesData = false }){
    const rhFields = [
      "Medecin specialiste",
      "Medecin generaliste",
      "Infirmier polyvalent",
      "Sage-femme",
      "Technicien",
      "TECH AMBULANCIER",
      "ADJ TECHNIQUE",
      "Administrateur",
      "Total"
    ];
    
    // Valeurs fixes pour la province (actualisées)
    const provinceFixedValues = {
      "Medecin generaliste": 23,
      "Infirmier polyvalent": 127,
      "Sage-femme": 34,
      "Technicien": 93,
      "Total": 307
    };
    
    // Mapping des champs COMMUNES.geojson vers les noms internes
    const communesFieldMap = {
      "Medecin specialiste": ["Médecin spécialiste public", "Medecin specialiste"],
      "Medecin generaliste": ["Médecin généraliste public", "Medecin generaliste"],
      "Infirmier polyvalent": ["Infirmier polyvalent public", "Infirmier polyvalent"],
      "Sage-femme": ["Sage-femme public", "Sage-femme"],
      "Technicien": ["Technicien public", "Technicien"],
      "TECH AMBULANCIER": ["TECH AMBULANCIER"],
      "ADJ TECHNIQUE": ["ADJ TECHNIQUE"],
      "Administrateur": ["Administrateur public", "Administrateur"]
    };
    
    const totals = {};
    rhFields.forEach(field => { totals[field] = 0; });
    
    // Si on calcule pour la province (pas de communeName ni allowedCommunes spécifiques) et useCommunesData est true
    if (!communeName && (!allowedCommunes || !Array.isArray(allowedCommunes) || allowedCommunes.length === 0) && useCommunesData) {
      // Utiliser les valeurs fixes pour la province
      Object.keys(provinceFixedValues).forEach(field => {
        totals[field] = provinceFixedValues[field];
      });
      
      // Calculer les autres champs depuis les données si disponibles
      if (Array.isArray(features) && features.length) {
        features.forEach((feature) => {
          const props = feature && feature.properties ? feature.properties : {};
          rhFields.forEach(field => {
            // Ne pas écraser les valeurs fixes
            if (!provinceFixedValues.hasOwnProperty(field)) {
              const candidates = communesFieldMap[field] || [field];
              let value = null;
              for (const candidate of candidates) {
                if (Object.prototype.hasOwnProperty.call(props, candidate)) {
                  value = props[candidate];
                  break;
                }
              }
              totals[field] += Number(value) || 0;
            }
          });
        });
      }
      
      return totals;
    }
    
    if (!Array.isArray(features) || !features.length) return totals;
    let filtered = features;
    if (communeName){
      const normCommune = normalizeCommuneKey(communeName);
      filtered = features.filter((feature) => {
        const props = feature && feature.properties ? feature.properties : {};
        const raw = props["nom_commun"] || props["Commune"] || getEtabFieldValue(props, etabCommField, ETAB_FIELD_CANDIDATES.commune);
        const norm = normalizeCommuneKey(raw);
        return norm === normCommune;
      });
    } else if (allowedCommunes && Array.isArray(allowedCommunes) && allowedCommunes.length){
      const allowedSet = new Set(allowedCommunes.map(normalizeCommuneKey).filter(Boolean));
      filtered = features.filter((feature) => {
        const props = feature && feature.properties ? feature.properties : {};
        const raw = props["nom_commun"] || props["Commune"] || getEtabFieldValue(props, etabCommField, ETAB_FIELD_CANDIDATES.commune);
        const norm = normalizeCommuneKey(raw);
        return norm && allowedSet.has(norm);
      });
    }
    filtered.forEach((feature) => {
      const props = feature && feature.properties ? feature.properties : {};
      rhFields.forEach(field => {
        let value = null;
        if (useCommunesData) {
          // Utiliser le mapping pour COMMUNES.geojson
          const candidates = communesFieldMap[field] || [field];
          for (const candidate of candidates) {
            if (Object.prototype.hasOwnProperty.call(props, candidate)) {
              value = props[candidate];
              break;
            }
          }
        } else {
          // Utiliser directement le nom du champ (pour ETAB_SANTE.geojson)
          value = props[field];
        }
        totals[field] += Number(value) || 0;
      });
    });
    
    // Calculer le total (toujours calculer pour COMMUNES.geojson, ou si non trouvé dans ETAB_SANTE.geojson)
    if (useCommunesData || totals["Total"] === 0) {
      totals["Total"] = totals["Medecin specialiste"] + totals["Medecin generaliste"] + 
                        totals["Infirmier polyvalent"] + totals["Sage-femme"] + 
                        totals["Technicien"] + totals["TECH AMBULANCIER"] + 
                        totals["ADJ TECHNIQUE"] + totals["Administrateur"];
    }
    
    return totals;
  }

  function getFilteredCommunesByClass(){
    const communes = [];
    if (!geojsonData || !Array.isArray(geojsonData.features)) return communes;
    const filterIdx = getActiveClassFilter();
    if (filterIdx === null) {
      geojsonData.features.forEach((f, idx) => {
        const name = getFeatureName(f, idx);
        if (name) communes.push(name);
      });
      return communes;
    }
    const classMap = buildSanteClassByCommune();
    geojsonData.features.forEach((f, idx) => {
      const name = getFeatureName(f, idx);
      if (!name) return;
      const normName = normalizeCommuneName(name);
      const classIdx = classMap.get(normName);
      if (classIdx === filterIdx) communes.push(name);
    });
    return communes;
  }

  function destroyRHSanteChart(){
    if (rhSanteChart){
      try{ rhSanteChart.destroy(); } catch(_){ }
      rhSanteChart = null;
    }
  }

  function initRHSanteChart(){
    if (!podiumChartCanvas) return null;
    destroyRHSanteChart();
    const ctx = podiumChartCanvas.getContext("2d");
    if (!ctx) return null;
    const theme = getThemePalette();
    const santeTheme = (axisId === "sante") ? getSanteTheme() : null;
    const textColor = santeTheme && santeTheme.textColor ? santeTheme.textColor : theme.textColor;
    const gridColor = santeTheme && santeTheme.gridColor ? santeTheme.gridColor : theme.gridColor;
    const cardBg = santeTheme && santeTheme.cardBg ? santeTheme.cardBg : theme.cardBg;
    const accentColor = santeTheme && santeTheme.accentColor ? santeTheme.accentColor : theme.accentColor;
    const labels = [
      "Medecin specialiste",
      "Medecin generaliste",
      "Infirmier polyvalent",
      "Sage-femme",
      "Technicien",
      "TECH AMBULANCIER",
      "ADJ TECHNIQUE",
      "Administrateur",
      "Total"
    ];
    rhSanteChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Effectif",
          data: new Array(labels.length).fill(0),
          backgroundColor: santeTheme && santeTheme.chartPalette ? santeTheme.chartPalette[0] : theme.chartPalette[0],
          borderColor: santeTheme && santeTheme.chartPalette ? santeTheme.chartPalette[0] : theme.chartPalette[0],
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 6, bottom: 0, left: 0, right: 0 } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              font: { size: 10 },
              color: textColor,
              precision: 0
            },
            grid: { color: gridColor }
          },
          y: {
            ticks: {
              font: { size: 10 },
              color: textColor
            },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cardBg,
            titleColor: textColor,
            bodyColor: textColor,
            borderColor: accentColor,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const label = ctx.label || "";
                const value = isNumber(ctx.parsed.x) ? ctx.parsed.x : 0;
                return label + ": " + formatInt(value);
              }
            }
          }
        }
      }
    });
    return rhSanteChart;
  }

  function updateRHSanteChart(totalsObj, subtitle){
    if (!rhSanteChart){
      initRHSanteChart();
    }
    if (!rhSanteChart) return;
    const labels = [
      "Medecin specialiste",
      "Medecin generaliste",
      "Infirmier polyvalent",
      "Sage-femme",
      "Technicien",
      "TECH AMBULANCIER",
      "ADJ TECHNIQUE",
      "Administrateur",
      "Total"
    ];
    const data = labels.map(label => totalsObj[label] || 0);
    rhSanteChart.data.datasets[0].data = data;
    rhSanteChart.update("none");
    if (podiumTitleEl){
      podiumTitleEl.textContent = "Ressources humaines – Santé" + (subtitle ? " (" + subtitle + ")" : "");
    }
  }

  function aggregateEtabStats(etabFeatures){
    const countsByType = { hopital: 0, cs_urbain: 0, cs_rural: 0, dispensaire: 0, sres: 0, autre: 0 };
    const countsBatimentEtat = { bon: 0, moyen: 0, mauvais: 0, nc: 0 };
    const countsAmbulance = { oui: 0, non: 0, nc: 0 };
    const hasBatimentEtat = !!etabEtatField;
    const hasAmbulance = false;
    if (!Array.isArray(etabFeatures)) return {
      countsByType,
      countsBatimentEtat,
      countsAmbulance,
      hasBatimentEtat,
      hasAmbulance
    };

    etabFeatures.forEach((feature) => {
      const props = feature && feature.properties ? feature.properties : {};
      const coordsList = getFeaturePointCoords(feature);
      const count = coordsList.length;
      if (!count) return;
      const rawType = getEtabFieldValue(props, etabTypeField, ETAB_FIELD_CANDIDATES.type);
      const typeKey = normalizeEtabType(rawType || "");
      countsByType[typeKey] = (countsByType[typeKey] || 0) + count;

      const val = getEtabFieldValue(props, etabEtatField, ETAB_FIELD_CANDIDATES.etat);
      const norm = normalizeEtatBat(val);
      countsBatimentEtat[norm] = (countsBatimentEtat[norm] || 0) + count;
    });

    return {
      countsByType,
      countsBatimentEtat,
      countsAmbulance,
      hasBatimentEtat,
      hasAmbulance
    };
  }

  function buildEtabIndexByCommune(etabFeatures, communeField, typeField){
    const index = new Map();
    if (!Array.isArray(etabFeatures) || !etabFeatures.length || !communeField || !typeField) {
      return index;
    }
    etabFeatures.forEach((feature) => {
      const props = feature && feature.properties ? feature.properties : {};
      const coordsList = getFeaturePointCoords(feature);
      const count = coordsList.length;
      if (!count) return;
      const rawCommune = getEtabFieldValue(props, communeField, ETAB_FIELD_CANDIDATES.commune);
      if (!rawCommune) return;
      const norm = normalizeCommuneKey(rawCommune);
      if (!norm) return;
      const rawType = getEtabFieldValue(props, typeField, ETAB_FIELD_CANDIDATES.type);
      const typeKey = normalizeEtabType(rawType || "");
      let rec = index.get(norm);
      if (!rec) {
        rec = { total: 0, hopital: 0, cs_urbain: 0, cs_rural: 0, dispensaire: 0, sres: 0, autre: 0 };
        index.set(norm, rec);
      }
      rec.total += count;
      rec[typeKey] = (rec[typeKey] || 0) + count;
    });
    return index;
  }

  function parseFonctionnel(value){
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return value !== 0;
    const raw = removeAccentsSimple(value).toLowerCase().trim();
    if (!raw) return null;
    if (["1","oui","o","yes","y","true","vrai"].includes(raw)) return true;
    if (["0","non","n","no","false","faux"].includes(raw)) return false;
    const compact = raw.replace(/[^a-z0-9]/g, "");
    if (!compact) return null;
    if (compact.startsWith("oui") || compact.startsWith("o") || compact.startsWith("yes") || compact.startsWith("true") || compact.startsWith("vrai")) return true;
    if (compact.startsWith("non") || compact.startsWith("n") || compact.startsWith("no") || compact.startsWith("false") || compact.startsWith("faux")) return false;
    return null;
  }

  function formatFonctionnelLabel(value){
    const state = parseFonctionnel(value);
    if (state === true) return "Oui";
    if (state === false) return "Non";
    return MISSING;
  }

  function getEtabProp(props, candidates){
    return resolveProp(props, candidates || []);
  }

  function cleanText(value){
    if (value === null || value === undefined) return "";
    const text = String(value).trim();
    return text;
  }

  function buildEtabInfo(props){
    const name = cleanText(props && (props.nom_etab || props.nom || props.name));
    const rawType = cleanText(getEtabFieldValue(props, etabTypeField, ETAB_FIELD_CANDIDATES.type));
    const typeKey = normalizeEtabType(rawType || "");
    const etatRaw = getEtabFieldValue(props, etabEtatField, ETAB_FIELD_CANDIDATES.etat);
    const etatBatKey = normalizeEtatBat(etatRaw);
    const etatBatLabel = formatEtatBatLabel(etatBatKey);
    const ambulanceRaw = props ? props.ambulance : null;
    const ambulance = cleanText(ambulanceRaw);
    const adresse = cleanText(props && props.adresse);
    const circonscri = cleanText(getEtabFieldValue(props, etabCommField, ETAB_FIELD_CANDIDATES.commune));
    return {
      name: name || MISSING,
      rawType,
      typeKey,
      etatBatKey,
      etatBatLabel,
      ambulance: ambulanceRaw,
      ambulanceLabel: ambulance || "nc",
      adresse,
      circonscri,
      circonscriLabel: circonscri || "nc"
    };
  }

  function formatEtabPopupLabel(key){
    if (!key) return "";
    return String(key).replace(/_/g, " ");
  }

  function buildEtabPopupHtml(props){
    const muted = (axisId === "sante") ? getSanteTheme().muted : "#6b7280";
    const items = [];
    if (props && typeof props === "object"){
      Object.keys(props).forEach((key) => {
        const raw = props[key];
        if (raw === null || raw === undefined || raw === "") return;
        items.push({ label: formatEtabPopupLabel(key), value: String(raw) });
      });
    }
    if (!items.length){
      return "<div style='min-width:180px'>" + escapeHtml(MISSING) + "</div>";
    }
    const rows = items.map((item) => {
      return "<div style='display:flex; justify-content:space-between; gap:10px; font-size:12px'>" +
        "<span style='color:" + muted + "'>" + escapeHtml(item.label) + "</span>" +
        "<span style='text-align:right'>" + escapeHtml(item.value) + "</span>" +
      "</div>";
    }).join("");
    return "<div style='min-width:220px'>" + rows + "</div>";
  }

  function buildEtabTooltipHtml(meta){
    const typeText = meta.rawType ? (meta.rawType + " (" + meta.typeKey + ")") : meta.typeKey;
    const lines = [
      "<div style='font-weight:700; margin-bottom:2px'>" + escapeHtml(meta.name) + "</div>",
      "<div>Type: " + escapeHtml(typeText) + "</div>",
      "<div>Etat du batiment: " + escapeHtml(meta.etatBatLabel) + "</div>"
    ];
    return "<div style='font-size:12px'>" + lines.join("") + "</div>";
  }

  function createEtabIcon(typeKey, isNonFunctional){
    const iconMap = {
      hopital: "assets/formes/hopital.png",
      cs_urbain: "assets/formes/cs_urbain.png",
      cs_rural: "assets/formes/cs_rural.png",
      dispensaire: "assets/formes/disponsaire.png",
      sres: "assets/formes/SRES.png",
      autre: "assets/formes/cs_rural.png"
    };
    const iconUrl = iconMap[typeKey] || iconMap.autre;
    const baseSize = 26;
    const size = typeKey === "hopital" ? Math.round(baseSize * 1.3) : baseSize;
    const half = size / 2;
    return L.icon({
      iconUrl,
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half],
      className: isNonFunctional ? "etab-marker is-non-functional" : "etab-marker"
    });
  }

  function buildEtabMarker(latlng, props, metaOverride){
    const meta = metaOverride || buildEtabInfo(props || {});
    const isNonFunctional = meta.etatBatKey === "mauvais";
    const icon = createEtabIcon(meta.typeKey, isNonFunctional);
    const size = meta.typeKey === "hopital" ? 34 : 26;
    const marker = L.marker(latlng, {
      icon,
      pane: "pane-etab",
      opacity: isNonFunctional ? 0.5 : 1,
      zIndexOffset: 1000,
      riseOnHover: true,
      riseOffset: 2000
    });
    marker.bindPopup(buildEtabPopupHtml(props || {}), { pane: "pane-popup" });
    return { marker, typeKey: meta.typeKey, size };
  }

  function setSanteEtabVisible(next){
    santeEtabVisible = !!next;
    // Note: santeEtabLegendToggle supprimé de la légende (légende simplifiée)
    if (!map || !santeEtabLayer) return;
    if (santeEtabVisible) santeEtabLayer.addTo(map);
    else map.removeLayer(santeEtabLayer);
    scheduleChefLieuLayout();
  }

  function applyCommunesVisibility(){
    if (!map) return;
    const layer = (typeof window !== "undefined" && window.__L_COMMUNES) ? window.__L_COMMUNES : currentCommunesLayer;
    if (!layer) return;
    const onMap = map.hasLayer(layer);
    if (showCommunes && !onMap) layer.addTo(map);
    if (!showCommunes && onMap) map.removeLayer(layer);
  }

  function ensureCommunesToggle(){
    if (!legendItemsEl || !legendItemsEl.parentElement) return;
    let wrap = document.getElementById("santeCommunesToggleWrap");
    if (!wrap){
      wrap = document.createElement("label");
      wrap.id = "santeCommunesToggleWrap";
      wrap.style.cssText = "display:flex; align-items:center; gap:8px; font-size:11px; margin:6px 0 8px;";
      wrap.innerHTML =
        "<input type='checkbox' id='santeCommunesToggle' style='margin:0'>" +
        "<span>Communes</span>";
      const input = wrap.querySelector("input");
      if (input) input.addEventListener("change", (e) => {
        showCommunes = !!e.target.checked;
        try{
          if (typeof localStorage !== "undefined"){
            localStorage.setItem("ui_showCommunes", showCommunes ? "1" : "0");
          }
        } catch(_){ }
        applyCommunesVisibility();
        console.info("[UI] communes=" + (showCommunes ? "on" : "off"));
      });
      const etabWrap = document.getElementById("santeEtabToggleWrap");
      if (etabWrap && etabWrap.parentElement){
        legendItemsEl.parentElement.insertBefore(wrap, etabWrap);
      } else {
        legendItemsEl.parentElement.insertBefore(wrap, legendItemsEl);
      }
    }
    const checkbox = wrap.querySelector("input");
    if (checkbox) checkbox.checked = !!showCommunes;
  }

  function ensureSanteEtabToggle(){
    if (!legendItemsEl || !legendItemsEl.parentElement) return;
    let wrap = document.getElementById("santeEtabToggleWrap");
    if (!wrap){
      wrap = document.createElement("label");
      wrap.id = "santeEtabToggleWrap";
      wrap.style.cssText = "display:flex; align-items:center; gap:8px; font-size:11px; margin:6px 0 8px;";
      wrap.innerHTML =
        "<input type='checkbox' id='santeEtabToggle' style='margin:0'>" +
        "<span>&Eacute;tablissements de sant&eacute;</span>";
      const input = wrap.querySelector("input");
      if (input) input.addEventListener("change", (e) => setSanteEtabVisible(e.target.checked));
      legendItemsEl.parentElement.insertBefore(wrap, legendItemsEl);
    }
    const checkbox = wrap.querySelector("input");
    if (checkbox) checkbox.checked = santeEtabVisible;
  }

  async function loadSanteEtablissements(map){
    if (!map) return;
    if (santeEtabLayer){
      try{ map.removeLayer(santeEtabLayer); } catch(_){ }
      santeEtabLayer = null;
    }
    let counts = { hopital: 0, cs_urbain: 0, cs_rural: 0, dispensaire: 0, sres: 0, autre: 0 };
    const stats = {
      total: 0,
      counts,
      features: [],
      ambulanceYes: 0,
      ambulanceNo: 0,
      ambulanceNc: 0,
      byCommune: new Map(),
      communeFieldFound: false,
      communeKeyFieldFound: false,
      byCommuneType: new Map(),
      byCommuneComputed: false,
      points: [],
      countsBatimentEtat: null,
      countsAmbulance: null,
      hasBatimentEtat: false,
      hasAmbulance: false
    };
    santeEtabStats = stats;
    santeEtabTypeLogged = false;
    santeEtabStatsLogged = false;
    const rawTypeValues = new Set();
    const typeFieldUsed = new Set();
    const typeSamples = [];
    try{
      const fc = await tryFetchJson(ETAB_PATH, "sante_etab");
      if (!fc){
        console.warn("[SANTE_ETAB_ERROR] ETAB_SANTE indisponible");
        santeReadyEtab = true;
        reportSanteDataCount("etab", 0);
        requestSanteChartsRefresh();
        return;
      }
      const features = fc && Array.isArray(fc.features) ? fc.features : [];
      stats.features = features;
      etabCommField = resolveEtabFieldKey(features, ETAB_FIELD_CANDIDATES.commune);
      etabTypeField = resolveEtabFieldKey(features, ETAB_FIELD_CANDIDATES.type);
      etabEtatField = resolveEtabFieldKey(features, ETAB_FIELD_CANDIDATES.etat);
      if (!santeEtabFieldsLogged){
        console.info(
          "[SANTE_ETAB_FIELDS] commune=", etabCommField,
          "type=", etabTypeField,
          "etat=", etabEtatField
        );
        santeEtabFieldsLogged = true;
      }
      state.etabIndexByCommune = buildEtabIndexByCommune(features, etabCommField, etabTypeField);
      state.etabCountsReady = (state.etabIndexByCommune && state.etabIndexByCommune.size > 0);
      const aggregated = aggregateEtabStats(features);
      counts = aggregated.countsByType;
      stats.counts = counts;
      stats.countsBatimentEtat = aggregated.countsBatimentEtat;
      stats.countsAmbulance = aggregated.countsAmbulance;
      stats.hasBatimentEtat = aggregated.hasBatimentEtat;
      stats.hasAmbulance = aggregated.hasAmbulance;
      stats.ambulanceYes = (stats.countsAmbulance && stats.countsAmbulance.oui) ? stats.countsAmbulance.oui : 0;
      stats.ambulanceNo = (stats.countsAmbulance && stats.countsAmbulance.non) ? stats.countsAmbulance.non : 0;
      stats.ambulanceNc = (stats.countsAmbulance && stats.countsAmbulance.nc) ? stats.countsAmbulance.nc : 0;
      if (!santeEtabKeysLogged){
        const firstFeature = features.find(f => f && f.properties);
        const firstProps = firstFeature ? firstFeature.properties : null;
        const keys = firstProps ? Object.keys(firstProps) : [];
        console.info("[SANTE_ETAB_KEYS]", keys);
        santeEtabKeysLogged = true;
      }
      if (etabTypeField) typeFieldUsed.add(etabTypeField);
      const group = L.layerGroup();
      santeEtabMarkers = [];
      santeEtabLayerGroup = group;
      features.forEach((feature) => {
        const geom = feature && feature.geometry ? feature.geometry : null;
        if (!geom) return;
        const props = feature.properties || {};
        const rawType = getEtabFieldValue(props, etabTypeField, ETAB_FIELD_CANDIDATES.type);
        if (rawType !== null && rawType !== undefined){
          const text = String(rawType).trim();
          if (text){
            rawTypeValues.add(text);
            if (typeSamples.length < 10 && !typeSamples.includes(text)) typeSamples.push(text);
          }
        }
        const meta = buildEtabInfo(props);
        const coordsList = getFeaturePointCoords(feature);
        if (!coordsList.length) return;
        coordsList.forEach((coords) => {
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          stats.points.push([lng, lat]);
          const result = buildEtabMarker([lat, lng], props, meta);
          if (!result || !result.marker) return;
          group.addLayer(result.marker);
          santeEtabMarkers.push({
            marker: result.marker,
            latlng: L.latLng(lat, lng),
            typeKey: result.typeKey || "autre",
            size: result.size || 26,
            hidden: false
          });
          stats.total += 1;
          if (meta.circonscri){
            const norm = normalizeCommuneKey(meta.circonscri);
            if (norm){
              stats.communeFieldFound = true;
              stats.communeKeyFieldFound = true;
              stats.byCommune.set(norm, (stats.byCommune.get(norm) || 0) + 1);
              const typeKey = result.typeKey || "autre";
              const bucket = stats.byCommuneType.get(norm) || { hopital: 0, cs_urbain: 0, cs_rural: 0, dispensaire: 0, sres: 0, autre: 0 };
              bucket[typeKey] = (bucket[typeKey] || 0) + 1;
              stats.byCommuneType.set(norm, bucket);
            }
          }
        });
      });
      getEtabCountsByCommune();
      if (!santeEtabTypeLogged){
        const fields = Array.from(typeFieldUsed);
        const fieldLabel = fields.length ? fields.join(", ") : "unknown";
        const list = Array.from(rawTypeValues)
          .sort((a, b) => a.localeCompare(b, "fr"))
          .slice(0, 30);
        console.info("[SANTE_ETAB_TYPE_FIELD] field=" + fieldLabel);
        console.info("[SANTE_ETAB_TYPE_SAMPLES] " + JSON.stringify(typeSamples));
        console.info("[SANTE_ETAB_TYPES_RAW] " + JSON.stringify(list));
        santeEtabTypeLogged = true;
      }
      if (!santeEtabStatsLogged){
        const typeCounts = stats.counts || {};
        const batCounts = stats.countsBatimentEtat || {};
        const ambCounts = stats.countsAmbulance || {};
        console.info(
          "[SANTE_ETAB_STATS] types=" + JSON.stringify({
            hopital: typeCounts.hopital || 0,
            cs_urbain: typeCounts.cs_urbain || 0,
            cs_rural: typeCounts.cs_rural || 0,
            dispensaire: typeCounts.dispensaire || 0,
            autre: typeCounts.autre || 0
          }) +
          " bat=" + JSON.stringify({
            bon: batCounts.bon || 0,
            moyen: batCounts.moyen || 0,
            mauvais: batCounts.mauvais || 0,
            nc: batCounts.nc || 0
          }) +
          " amb=" + JSON.stringify({
            oui: ambCounts.oui || 0,
            non: ambCounts.non || 0,
            nc: ambCounts.nc || 0
          })
        );
        santeEtabStatsLogged = true;
      }
      santeEtabLayer = group;
      if (santeEtabVisible) group.addTo(map);
      ensureChefLieuLayoutEvents();
      scheduleChefLieuLayout();
      console.info("[SANTE_ETAB] loaded " + stats.total + " points");
      console.info(
        "[VISIBILITY] chefLieu markers=" + (chefLieuPoints ? chefLieuPoints.length : 0) +
        " sante markers=" + (santeEtabMarkers ? santeEtabMarkers.length : 0) +
        " zoom-independent=true"
      );
      console.info(
        "[SANTE_ETAB] types: hopital=" + (counts.hopital || 0) +
        ", cs_urbain=" + (counts.cs_urbain || 0) +
        ", cs_rural=" + (counts.cs_rural || 0) +
        ", dispensaire=" + (counts.dispensaire || 0) +
        ", autre=" + (counts.autre || 0)
      );
      reportSanteDataCount("etab", stats.total);
      santeReadyEtab = true;
      requestSanteChartsRefresh();
      if (axisId === "sante"){
        rebuildDashboard();
        if (selectedProfileName) renderCommuneProfile(selectedProfileName, null);
      }
    } catch (err){
      santeEtabStats = stats;
      console.warn("[SANTE_ETAB_ERROR]", err);
      santeReadyEtab = true;
      reportSanteDataCount("etab", 0);
      requestSanteChartsRefresh();
    }
  }

  function resolveHealthFieldKeys(fc){
    const resolved = { commune: "", ipm: "", handicap: "", pop: "" };
    if (!fc || !Array.isArray(fc.features)) return resolved;
    for (const f of fc.features){
      const p = f && f.properties ? f.properties : {};
      if (!resolved.commune) resolved.commune = resolveFieldByCandidates(p, SANTE_FIELD_CANDIDATES.commune);
      if (!resolved.ipm) resolved.ipm = resolveFieldByCandidates(p, SANTE_FIELD_CANDIDATES.ipm);
      if (!resolved.handicap) resolved.handicap = resolveFieldByCandidates(p, SANTE_FIELD_CANDIDATES.handicap);
      if (!resolved.pop) resolved.pop = resolveFieldByCandidates(p, SANTE_FIELD_CANDIDATES.pop);
      if (resolved.commune && resolved.ipm && resolved.handicap && resolved.pop) break;
    }
    return resolved;
  }

  function buildHealthByCommune(fc){
    const map = new Map();
    if (!fc || !Array.isArray(fc.features)) return { map, keys: resolveHealthFieldKeys(fc) };
    fc.features.forEach((f, idx) => {
      const p = f && f.properties ? f.properties : {};
      const rawName = resolveProp(p, SANTE_FIELD_CANDIDATES.commune) || getCommuneName(f, idx, null);
      const norm = normalizeCommuneKey(rawName);
      if (!norm) return;
      const ipmRaw = resolveProp(p, SANTE_FIELD_CANDIDATES.ipm);
      const handicapRaw = resolveProp(p, SANTE_FIELD_CANDIDATES.handicap);
      const popRaw = resolveProp(p, SANTE_FIELD_CANDIDATES.pop);
      const ipm = parseNumberSafe(ipmRaw);
      const handicap = parseNumberSafe(handicapRaw);
      const pop = parseNumberSafe(popRaw);
      map.set(norm, {
        name: rawName ? String(rawName).trim() : "",
        ipm: isNumber(ipm) ? ipm : null,
        handicap: isNumber(handicap) ? handicap : null,
        pop: isNumber(pop) ? pop : null
      });
    });
    return { map, keys: resolveHealthFieldKeys(fc) };
  }

  function joinHealthToBoundary(boundaryFc, healthMap){
    if (!boundaryFc || !Array.isArray(boundaryFc.features)) return 0;
    let matched = 0;
    const missing = new Set();
    boundaryFc.features.forEach((feature, idx) => {
      const props = feature.properties || {};
      const name = getCommuneName(feature, idx, null);
      const norm = normalizeCommuneKey(name);
      const entry = norm ? healthMap.get(norm) : null;
      if (entry) matched += 1;
      else if (name){
        const label = normalizeCommuneKey(name);
        if (label) missing.add(label);
      }
      props.sante_ipm = entry && isNumber(entry.ipm) ? entry.ipm : null;
      props.sante_handicap = entry && isNumber(entry.handicap) ? entry.handicap : null;
      props.sante_pop = entry && isNumber(entry.pop) ? entry.pop : null;
      feature.properties = props;
    });
    if (missing.size && !santeJoinMissLogged){
      console.warn("[SANTE_JOIN_MISS]", Array.from(missing));
      santeJoinMissLogged = true;
    }
    return matched;
  }

  function computeSanteIndex(boundaryFc){
    if (!boundaryFc || !Array.isArray(boundaryFc.features)) return;
    const ipmValues = [];
    const handicapValues = [];
    boundaryFc.features.forEach((feature) => {
      const p = feature.properties || {};
      const ipmVal = parseNumberSafe(p.sante_ipm);
      const handicapVal = parseNumberSafe(p.sante_handicap);
      if (isNumber(ipmVal)) ipmValues.push(ipmVal);
      if (isNumber(handicapVal)) handicapValues.push(handicapVal);
    });
    const ipmRange = computeMinMax(ipmValues);
    const handicapRange = computeMinMax(handicapValues);
    reportSanteDataStats(ipmRange, handicapRange);

    boundaryFc.features.forEach((feature) => {
      const p = feature.properties || {};
      const ipmVal = parseNumberSafe(p.sante_ipm);
      const handicapVal = parseNumberSafe(p.sante_handicap);

      let santeIndex = null;
      if (isNumber(ipmVal) && isNumber(handicapVal) && isNumber(ipmRange.min) && isNumber(ipmRange.max) && isNumber(handicapRange.min) && isNumber(handicapRange.max)){
        const ipmDen = ipmRange.max - ipmRange.min;
        const hDen = handicapRange.max - handicapRange.min;
        if (ipmDen !== 0 && hDen !== 0){
          const ipmNorm = clamp01((ipmVal - ipmRange.min) / ipmDen);
          const handicapNorm = clamp01((handicapVal - handicapRange.min) / hDen);
          if (isNumber(ipmNorm) && isNumber(handicapNorm)){
            const risk = (0.6 * ipmNorm) + (0.4 * handicapNorm);
            santeIndex = Math.round((1 - risk) * 100);
          }
        }
      }
      p.sante_index = isNumber(santeIndex) ? santeIndex : null;
      feature.properties = p;
    });
  }

  function computeSanteIndexEntriesFromMap(healthMap){
    const entries = [];
    if (!healthMap || !(healthMap instanceof Map) || !healthMap.size) return entries;
    const ipmValues = [];
    const handicapValues = [];
    healthMap.forEach((entry) => {
      const ipmVal = parseNumberSafe(entry ? entry.ipm : null);
      const handicapVal = parseNumberSafe(entry ? entry.handicap : null);
      if (isNumber(ipmVal)) ipmValues.push(ipmVal);
      if (isNumber(handicapVal)) handicapValues.push(handicapVal);
    });
    const ipmRange = computeMinMax(ipmValues);
    const handicapRange = computeMinMax(handicapValues);
    reportSanteDataStats(ipmRange, handicapRange);

    healthMap.forEach((entry, key) => {
      const ipmVal = parseNumberSafe(entry ? entry.ipm : null);
      const handicapVal = parseNumberSafe(entry ? entry.handicap : null);
      const popVal = parseNumberSafe(entry ? entry.pop : null);
      let santeIndex = null;
      if (isNumber(ipmVal) && isNumber(handicapVal) && isNumber(ipmRange.min) && isNumber(ipmRange.max) && isNumber(handicapRange.min) && isNumber(handicapRange.max)){
        const ipmDen = ipmRange.max - ipmRange.min;
        const hDen = handicapRange.max - handicapRange.min;
        if (ipmDen !== 0 && hDen !== 0){
          const ipmNorm = clamp01((ipmVal - ipmRange.min) / ipmDen);
          const handicapNorm = clamp01((handicapVal - handicapRange.min) / hDen);
          if (isNumber(ipmNorm) && isNumber(handicapNorm)){
            const risk = (0.6 * ipmNorm) + (0.4 * handicapNorm);
            santeIndex = Math.round((1 - risk) * 100);
          }
        }
      }
      const name = entry && entry.name ? String(entry.name).trim() : (key ? String(key) : "");
      entries.push({
        name,
        ipm: isNumber(ipmVal) ? ipmVal : null,
        handicap: isNumber(handicapVal) ? handicapVal : null,
        pop: isNumber(popVal) ? popVal : null,
        index: isNumber(santeIndex) ? santeIndex : null
      });
    });
    return entries;
  }

  function logDataEmpty(issues){
    if (dataEmptyAlerted || !issues.length) return;
    dataEmptyAlerted = true;
    console.warn("[DATA] DATA EMPTY:", issues);
    if (axisId !== "sante"){
      alert("DATA EMPTY: " + issues.join(" | "));
    }
  }

  function logSanteReady(){
    if (santeReadyLogged) return;
    santeReadyLogged = true;
    console.info("[SANTE_READY] true");
  }

  function logResolvedFields(fieldKeys, sampleProps){
    if (dataDiagnosticsLogged) return;
    const resolved = {};
    TABLE_KEYS.forEach((k) => { resolved[k] = fieldKeys[k] || ""; });
    console.info("[FIELDS] resolved");
    console.table(resolved);
    if (sampleProps){
      const kpiRows = KPI_KEYS.map((k) => {
        const field = fieldKeys[k] || "";
        return { kpi: k, field, sample: field ? sampleProps[field] : undefined };
      });
      console.table(kpiRows);
    }
    dataDiagnosticsLogged = true;
  }

  function logJoinDiagnostics(rows){
    if (axisId === "sante"){
      if (!santeJoinGenericLogged){
        console.info("[SANTE_PIPELINE] mode=sante join_generic=skipped");
        santeJoinGenericLogged = true;
      }
      return;
    }
    if (joinDiagnosticsLogged) return;
    if (!rows || !rows.length) return;
    const layerKeys = [];
    mapNameToLayer.forEach((_, k) => { layerKeys.push(k); });
    const normalizedLayers = new Map();
    layerKeys.forEach((name) => { normalizedLayers.set(normalizeCommuneName(name), name); });
    let matched = 0;
    const unmatched = [];
    rows.forEach((row) => {
      const key = normalizeCommuneName(row.name);
      if (normalizedLayers.has(key)) matched += 1;
      else unmatched.push(row.name);
    });
    console.info("[JOIN] matched communes = " + matched + "/" + rows.length);
    if (unmatched.length){
      console.warn("[JOIN] unmatched names (sample):", unmatched.slice(0, 20));
    }
    joinDiagnosticsLogged = true;
  }

  function resolveFieldByCandidates(props, candidates){
    return pickField(props, candidates || []);
  }

  function normalizeFieldToken(value){
    return normalizeKey(value);
  }

  function findKeyByPatterns(props, patterns){
    if (!props || !patterns || !patterns.length) return "";
    const keys = Object.keys(props);
    if (!keys.length) return "";
    const normalizedKeys = keys.map((key) => ({ key, token: normalizeKey(key) }));
    for (const pattern of patterns){
      const tokens = Array.isArray(pattern) ? pattern : [pattern];
      const normalizedTokens = tokens.map((token) => normalizeKey(token)).filter(Boolean);
      if (!normalizedTokens.length) continue;
      const match = normalizedKeys.find((entry) =>
        entry.token && normalizedTokens.every((token) => entry.token.includes(token))
      );
      if (match && match.key) return match.key;
    }
    return "";
  }

  function resolvePropWithKey(props, candidates){
    if (!props || !Array.isArray(candidates)) return { key: "", value: null };
    for (const c of candidates){
      if (!Object.prototype.hasOwnProperty.call(props, c)) continue;
      const v = props[c];
      if (v !== null && v !== undefined && String(v).trim() !== "") return { key: c, value: v };
    }
    const keys = Object.keys(props);
    const lowerMap = {};
    keys.forEach((k) => { lowerMap[k.toLowerCase()] = k; });
    for (const c of candidates){
      const key = lowerMap[String(c).toLowerCase()];
      if (!key) continue;
      const v = props[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") return { key, value: v };
    }
    const normalizedMap = {};
    keys.forEach((k) => {
      const token = normalizeFieldToken(k);
      if (token) normalizedMap[token] = k;
    });
    for (const c of candidates){
      const token = normalizeFieldToken(c);
      const key = token ? normalizedMap[token] : "";
      if (!key) continue;
      const v = props[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") return { key, value: v };
    }
    const normalizedKeys = keys.map((k) => ({ key: k, token: normalizeFieldToken(k) }));
    for (const c of candidates){
      const frag = normalizeFieldToken(c);
      if (!frag) continue;
      const matches = normalizedKeys.filter((entry) => entry.token && entry.token.includes(frag));
      if (!matches.length) continue;
      const preferred = matches.find((entry) => !entry.key.includes(":")) || matches[0];
      const v = props[preferred.key];
      if (v !== null && v !== undefined && String(v).trim() !== "") return { key: preferred.key, value: v };
    }
    return { key: "", value: null };
  }

  function resolveProp(props, candidates){
    if (Array.isArray(props) && candidates && typeof candidates === "object" && !Array.isArray(candidates)){
      return resolvePropWithKey(candidates, props).value;
    }
    return resolvePropWithKey(props, candidates).value;
  }

  function formatFixed2(v){
    if (!isNumber(v)) return MISSING;
    return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatFixed1(v){
    if (!isNumber(v)) return MISSING;
    return v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function formatSigned(v, formatter){
    if (!isNumber(v)) return MISSING;
    const sign = v > 0 ? "+" : v < 0 ? "-" : "";
    const abs = Math.abs(v);
    const formatted = formatter(abs);
    if (formatted === MISSING) return MISSING;
    return sign + formatted;
  }

  function formatProfileValue(item, value){
    if (!isNumber(value)) return MISSING;
    if (item.format === "int") return formatInt(value);
    if (item.format === "percent") return formatPercent(value);
    if (item.format === "fixed2") return formatFixed2(value);
    return formatNumber(value);
  }

  function getCommuneFieldValue(props, item){
    if (!props || !item) return null;
    const key = resolveFieldByCandidates(props, item.fieldCandidates);
    if (!key) return null;
    const isPercent = item.format === "percent";
    const val = parseNumberSmart(props[key], isPercent);
    return Number.isFinite(val) ? val : null;
  }

  function buildCommuneProfileStats(fc){
    const stats = new Map();
    const features = fc && Array.isArray(fc.features) ? fc.features : [];
    const total = features.length;
    const nameKeys = resolveFieldKeys(fc);
    COMMUNE_PROFILE_ITEMS.forEach((item) => {
      const valuesByName = new Map();
      const values = [];
      features.forEach((f, idx) => {
        const props = f && f.properties ? f.properties : {};
        const name = getCommuneName(f, idx, nameKeys);
        const value = getCommuneFieldValue(props, item);
        if (isNumber(value)){
          valuesByName.set(normalizeCommuneName(name), value);
          values.push(value);
        }
      });
      const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      const ranks = new Map();
      if (valuesByName.size){
        const sorted = [...valuesByName.entries()].sort((a, b) => b[1] - a[1]);
        sorted.forEach(([normName], idx) => {
          ranks.set(normName, idx + 1);
        });
      }
      stats.set(item.id, { mean, ranks, total });
    });
    return stats;
  }

  function applyIconFallback(img, icons){
    if (!img || !icons || !icons.length) return;
    let idx = 0;
    img.src = icons[idx];
    img.onerror = () => {
      idx += 1;
      if (idx < icons.length) img.src = icons[idx];
      else img.onerror = null;
    };
  }

  function getKpiOrder(){
    if (axisId === "sante") return SANTE_KPI_ORDER;
    if (typeof window !== "undefined" && Array.isArray(window.KPI_ORDER) && window.KPI_ORDER.length){
      return window.KPI_ORDER;
    }
    return KPI_ORDER_FALLBACK;
  }

  function computeKpiStats(rows, kpiKey, isPercentField){
    const values = rows
      .map(r => parseNumberSmart(r[kpiKey], isPercentField))
      .filter(isNumber);
    if (!values.length) return { min: null, max: null, mean: null, total: 0 };
    let min = values[0];
    let max = values[0];
    values.forEach((v) => {
      if (v < min) min = v;
      if (v > max) max = v;
    });
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return { min, max, mean, total: values.length };
  }

  function getKpiDirection(kpiKey, fallbackInvert){
    if (axisId === "sante"){
      if (kpiKey === "analphabetisme" || kpiKey === "couverture_etab") return "higher_is_better";
      if (kpiKey === "pauvrete" || kpiKey === "chomage") return "higher_is_worse";
    } else if (typeof KPI_REGISTRY !== "undefined" && KPI_REGISTRY[kpiKey] && KPI_REGISTRY[kpiKey].direction){
      return KPI_REGISTRY[kpiKey].direction;
    }
    return fallbackInvert ? "higher_is_worse" : "higher_is_better";
  }

  function normalizeMinMax(value, min, max){
    if (!isNumber(value) || !isNumber(min) || !isNumber(max)) return null;
    if (max === min) return 50;
    const raw = ((value - min) / (max - min)) * 100;
    if (!isNumber(raw)) return null;
    if (raw < 0) return 0;
    if (raw > 100) return 100;
    return raw;
  }

  function clamp01(value){
    if (!isNumber(value)) return null;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function pointInRing(point, ring){
    if (!Array.isArray(point) || !Array.isArray(ring) || ring.length < 3) return false;
    const x = point[0];
    const y = point[1];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++){
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(point, polygon){
    if (!Array.isArray(polygon) || !polygon.length) return false;
    if (!pointInRing(point, polygon[0])) return false;
    for (let i = 1; i < polygon.length; i++){
      if (pointInRing(point, polygon[i])) return false;
    }
    return true;
  }

  function pointInGeometry(point, geom){
    if (!geom || !geom.type) return false;
    if (geom.type === "Polygon") return pointInPolygon(point, geom.coordinates);
    if (geom.type === "MultiPolygon"){
      return Array.isArray(geom.coordinates) && geom.coordinates.some((poly) => pointInPolygon(point, poly));
    }
    return false;
  }

  function computeEtabCountsByPip(points, fc){
    const counts = new Map();
    if (!Array.isArray(points) || !points.length || !fc || !Array.isArray(fc.features)) return counts;
    const items = [];
    fc.features.forEach((f, idx) => {
      const geom = f && f.geometry ? f.geometry : null;
      if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return;
      const name = getCommuneName(f, idx, null);
      const norm = normalizeCommuneKey(name);
      if (!norm) return;
      items.push({ norm, geom });
    });
    if (!items.length) return counts;
    points.forEach((pt) => {
      if (!Array.isArray(pt) || pt.length < 2) return;
      for (const item of items){
        if (pointInGeometry(pt, item.geom)){
          counts.set(item.norm, (counts.get(item.norm) || 0) + 1);
          break;
        }
      }
    });
    return counts;
  }

  function getEtabCountsByCommune(){
    const stats = santeEtabStats;
    if (!stats) return new Map();
    if (stats.byCommuneComputed) return stats.byCommune || new Map();
    if (stats.communeFieldFound && stats.byCommune && stats.byCommune.size){
      stats.byCommuneComputed = true;
      return stats.byCommune;
    }
    const points = Array.isArray(stats.points) ? stats.points : [];
    if (!points.length || !geojsonData || !Array.isArray(geojsonData.features)){
      stats.byCommuneComputed = true;
      return stats.byCommune || new Map();
    }
    const counts = computeEtabCountsByPip(points, geojsonData);
    stats.byCommune = counts;
    stats.byCommuneComputed = true;
    return counts;
  }

  function computeKpiRank(rows, kpiKey, higherIsWorse, name){
    const list = rows.filter(r => isNumber(r[kpiKey])).slice();
    list.sort((a, b) => higherIsWorse ? a[kpiKey] - b[kpiKey] : b[kpiKey] - a[kpiKey]);
    const idx = list.findIndex(r => normalizeCommuneName(r.name) === normalizeCommuneName(name));
    if (idx < 0) return null;
    return { rank: idx + 1, total: list.length };
  }

  function computeSanteGaugeRows(rowsAll){
    const counts = getEtabCountsByCommune();
    return (rowsAll || []).map((row) => {
      const name = row && row.name ? row.name : "";
      const ipm = isNumber(row.pauvrete) ? row.pauvrete : null;
      const handicap = isNumber(row.chomage) ? row.chomage : null;
      const condvie = isNumber(row.analphabetisme) ? row.analphabetisme : null;
      const popVal = isNumber(row.population) ? row.population : null;
      const isfVal = isNumber(row.isf) ? row.isf : null;
      const norm = normalizeCommuneKey(name);
      const count = norm && counts ? (counts.get(norm) || 0) : 0;
      return { name, ipm, handicap, condvie, pop: popVal, isf: isfVal, etab: count };
    });
  }

  function computeSanteGaugeStats(rows, key){
    const values = (rows || []).map(r => r[key]).filter(isNumber);
    if (!values.length) return { min: null, max: null, mean: null, total: 0 };
    const range = computeMinMax(values);
    const mean = average(values);
    return { min: range.min, max: range.max, mean, total: values.length };
  }

  function computeSanteGaugeRank(rows, key, name){
    const list = (rows || [])
      .map(r => ({ name: r.name, value: r[key] }))
      .filter(r => isNumber(r.value));
    list.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name, "fr");
    });
    const idx = list.findIndex(r => normalizeCommuneName(r.name) === normalizeCommuneName(name));
    if (idx < 0) return null;
    return { rank: idx + 1, total: list.length };
  }

  function buildCrossCommuneRows(){
    const stats = santeEtabStats;
    if (!stats || !stats.communeKeyFieldFound) return { ok: false, reason: "no_commune_key", rows: [] };
    if (!geojsonData || !Array.isArray(geojsonData.features)) return { ok: false, reason: "no_communes", rows: [] };
    const byType = stats.byCommuneType || new Map();
    const rows = [];
    geojsonData.features.forEach((f, idx) => {
      const p = f && f.properties ? f.properties : {};
      const name = getFeatureName(f, idx);
      const norm = normalizeCommuneKey(name);
      const typeCounts = (norm && byType.has(norm)) ? byType.get(norm) : null;
      const hopital = typeCounts ? (typeCounts.hopital || 0) : 0;
      const csUrbain = typeCounts ? (typeCounts.cs_urbain || 0) : 0;
      const csRural = typeCounts ? (typeCounts.cs_rural || 0) : 0;
      const dispensaire = typeCounts ? (typeCounts.dispensaire || 0) : 0;
      const total = hopital + csUrbain + csRural + dispensaire;
      const popVal = parseNumberFR(p.pop_2024);
      const isfVal = parseNumberFR(p.isf);
      rows.push({
        name,
        total,
        hopital,
        cs_urbain: csUrbain,
        cs_rural: csRural,
        dispensaire,
        pop: isNumber(popVal) ? popVal : null,
        isf: isNumber(isfVal) ? isfVal : null
      });
    });
    if (!rows.length) return { ok: false, reason: "no_communes", rows: [] };
    const statsTotal = stats && isNumber(stats.total) ? stats.total : 0;
    const sig = [rows.length, statsTotal].join("|");
    if (sig !== lastSanteCrossSig){
      lastSanteCrossSig = sig;
      console.info("[SANTE_CROSS] ok communes=" + rows.length + " etab=" + statsTotal);
    }
    return { ok: true, reason: "", rows };
  }

  function buildSanteGaugeItem(options){
    const value = options.value;
    const unit = options.unit;
    const stats = options.stats || {};
    const valueOk = isNumber(value);
    const baseScore = valueOk ? normalizeMinMax(value, stats.min, stats.max) : null;
    let gaugeValuePct = null;
    if (valueOk){
      if (unit === "%" || unit === "index") gaugeValuePct = Math.max(0, Math.min(100, value));
      else if (isNumber(baseScore)) gaugeValuePct = baseScore;
    }
    const gaugeDisplayText = valueOk ? formatKpiValue(value, unit) : MISSING;
    const rankInfo = options.rankInfo || null;
    const delta = valueOk && isNumber(stats.mean) ? (value - stats.mean) : null;
    return {
      key: options.key,
      label: options.label,
      unit,
      theme: options.theme || "traffic",
      icon: options.icon || "",
      familyId: "sante",
      value: valueOk ? value : null,
      rawValue: valueOk ? value : null,
      percentValue: unit === "%" ? (valueOk ? value : null) : null,
      direction: options.direction || "higher_is_worse",
      scoreBase: baseScore,
      scorePct: baseScore,
      gaugeValuePct,
      gaugeDisplayText,
      gaugeMin: isNumber(stats.min) ? stats.min : null,
      gaugeMax: isNumber(stats.max) ? stats.max : null,
      rank: rankInfo ? rankInfo.rank : null,
      total: rankInfo ? rankInfo.total : null,
      delta,
      note: options.note || ""
    };
  }

  function logSanteGauges(name, values){
    if (axisId !== "sante" || DISABLE_GAUGES) return;
    const communeLabel = name || MISSING;
    const ipmSig = formatSignatureNumber(values.ipm, 1);
    const handicapSig = formatSignatureNumber(values.handicap, 1);
    const condvieSig = formatSignatureNumber(values.condvie, 1);
    const auxSig = formatSignatureNumber(values.aux, 1);
    const sig = [normalizeCommuneName(communeLabel), ipmSig, handicapSig, condvieSig, auxSig].join("|");
    if (sig === lastSanteGaugesSig) return;
    lastSanteGaugesSig = sig;
    const ipmLog = isNumber(values.ipm) ? Math.round(values.ipm * 10) / 10 : "NA";
    const handicapLog = isNumber(values.handicap) ? Math.round(values.handicap * 10) / 10 : "NA";
    const condvieLog = isNumber(values.condvie) ? Math.round(values.condvie * 10) / 10 : "NA";
    const auxLog = isNumber(values.aux) ? Math.round(values.aux * 10) / 10 : "NA";
    console.info(
      "[SANTE_GAUGES] commune=" + communeLabel +
      " ipm=" + ipmLog +
      " handicap=" + handicapLog +
      " condvie=" + condvieLog +
      " aux=" + auxLog
    );
  }

  function computeCommuneCardModel(communeName){
    const rowsAll = dashboardRows || [];
    const row = findRowByName(communeName);
    const name = row ? row.name : (communeName || MISSING);
    if (axisId === "sante"){
      const gaugeRows = computeSanteGaugeRows(rowsAll);
      const current = gaugeRows.find(r => normalizeCommuneName(r.name) === normalizeCommuneName(name)) || null;
      const ipmVal = current ? current.ipm : null;
      const handicapVal = current ? current.handicap : null;
      const popVal = current ? current.pop : null;

      const ipmStats = computeSanteGaugeStats(gaugeRows, "ipm");
      const handicapStats = computeSanteGaugeStats(gaugeRows, "handicap");
      const popStats = computeSanteGaugeStats(gaugeRows, "pop");

      const items = [
        buildSanteGaugeItem({
          key: "pop_2024",
          label: "Population 2024",
          unit: "",
          direction: "higher_is_better",
          value: popVal,
          stats: popStats,
          rankInfo: computeSanteGaugeRank(gaugeRows, "pop", name),
          icon: "assets/icons/emploi.png",
          theme: "blue"
        }),
        buildSanteGaugeItem({
          key: "ipm_sante_pct",
          label: "IPM Sant\u00e9 (%)",
          unit: "%",
          direction: "higher_is_worse",
          value: ipmVal,
          stats: ipmStats,
          rankInfo: computeSanteGaugeRank(gaugeRows, "ipm", name),
          icon: "assets/icons/taux-pauverete.png"
        }),
        buildSanteGaugeItem({
          key: "handicap_pct",
          label: "Handicap (%)",
          unit: "%",
          direction: "higher_is_worse",
          value: handicapVal,
          stats: handicapStats,
          rankInfo: computeSanteGaugeRank(gaugeRows, "handicap", name),
          icon: "assets/icons/taux-chaumage.png"
        })
      ];
      logSanteGauges(name, {
        ipm: ipmVal,
        handicap: handicapVal,
        condvie: null,
        aux: null
      });
      return { name, items };
    }
    const registry = (axisId === "sante")
      ? null
      : ((typeof KPI_REGISTRY !== "undefined") ? KPI_REGISTRY : null);
    const keys = getKpiOrder();
    const items = keys.map((kpiKey) => {
      const entry = registry && registry[kpiKey] ? registry[kpiKey] : null;
      const label = entry && entry.label
        ? entry.label
        : (METRIC_META[kpiKey] ? METRIC_META[kpiKey].label : kpiKey);
      const unit = entry && entry.unit
        ? entry.unit
        : (METRIC_META[kpiKey]
          ? (METRIC_META[kpiKey].isPercent ? "%" : (METRIC_META[kpiKey].unit || ""))
          : "");
      const fallbackInvert = KPI_INVERT_FALLBACK.has(kpiKey);
      const direction = getKpiDirection(kpiKey, fallbackInvert);
      const higherIsWorse = direction === "higher_is_worse";
      const rawValue = row ? row[kpiKey] : null;
      const isPercentField = unit === "%";
      const percentValue = isPercentField ? getPercentValue(rawValue) : null;
      const value = isPercentField
        ? (Number.isFinite(percentValue) ? percentValue : NaN)
        : (isNumber(rawValue) ? rawValue : parseNumberSmart(rawValue, isPercentField));
      const stats = computeKpiStats(rowsAll, kpiKey, isPercentField);
      const baseScore = normalizeMinMax(value, stats.min, stats.max);
      const scoreBase = isNumber(baseScore) ? baseScore : null;
      const scorePct = isNumber(baseScore)
        ? Math.max(0, Math.min(100, higherIsWorse ? (100 - baseScore) : baseScore))
        : null;
      let gaugeValuePct = null;
      if (isPercentField){
        gaugeValuePct = Number.isFinite(percentValue) ? Math.max(0, Math.min(100, percentValue)) : null;
      } else if (unit === "index"){
        gaugeValuePct = isNumber(value) ? Math.max(0, Math.min(100, value)) : null;
      } else {
        gaugeValuePct = scoreBase;
      }
      const gaugeDisplayText = isPercentField
        ? formatPercent(percentValue)
        : formatKpiValue(value, unit);
      const rankInfo = row ? computeKpiRank(rowsAll, kpiKey, higherIsWorse, row.name) : null;
      const delta = isNumber(value) && isNumber(stats.mean) ? (value - stats.mean) : null;
      const theme = entry && entry.palette === "blue" ? "blue" : "traffic";
      const icon = entry && entry.iconFile ? ("assets/icons/" + entry.iconFile) : "";
      const familyId = entry && entry.familyId
        ? entry.familyId
        : (axisId === "sante" ? "sante" : (KPI_FAMILY_FALLBACK[kpiKey] || "socio"));
      return {
        key: kpiKey,
        label,
        unit,
        theme,
        icon,
        familyId,
        value,
        rawValue,
        percentValue,
        direction,
        scoreBase,
        scorePct,
        gaugeValuePct,
        gaugeDisplayText,
        rank: rankInfo ? rankInfo.rank : null,
        total: rankInfo ? rankInfo.total : null,
        delta
      };
    });
    logGaugeValues(name, items);
    return { name, items };
  }

  const GAUGE_CLASS_COLORS = {
    low: "#F5C84C",
    mid: "#F2994A",
    high: "#EB5757",
    vhigh: "#7A0C16"
  };

  function escapeSvgText(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function gaugeClampPercent(value){
    if (!Number.isFinite(value)) return null;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
  }

  function gaugePolarToCartesian(cx, cy, r, angleDeg){
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + (r * Math.cos(rad)),
      y: cy - (r * Math.sin(rad))
    };
  }

  function gaugeArcPath(cx, cy, r, startAngle, endAngle){
    const start = gaugePolarToCartesian(cx, cy, r, endAngle);
    const end = gaugePolarToCartesian(cx, cy, r, startAngle);
    const largeArc = Math.abs(endAngle - startAngle) <= 180 ? 0 : 1;
    return "M " + start.x.toFixed(2) + " " + start.y.toFixed(2) +
      " A " + r + " " + r + " 0 " + largeArc + " 0 " +
      end.x.toFixed(2) + " " + end.y.toFixed(2);
  }

  function hexToRgb(hex){
    const raw = String(hex || "").trim();
    const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return null;
    let value = match[1];
    if (value.length === 3){
      value = value.split("").map((c) => c + c).join("");
    }
    const n = parseInt(value, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b){
    const toHex = (v) => v.toString(16).padStart(2, "0");
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  function mixChannel(a, b, t){
    return Math.round(a + (b - a) * t);
  }

  function desaturateColor(hex, amount){
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const neutral = { r: 244, g: 244, b: 245 };
    const t = Number.isFinite(amount) ? amount : 0.45;
    return rgbToHex(
      mixChannel(rgb.r, neutral.r, t),
      mixChannel(rgb.g, neutral.g, t),
      mixChannel(rgb.b, neutral.b, t)
    );
  }

  function renderGaugeSVG(options){
    const opts = options || {};
    const valueRaw = Number(opts.valuePct);
    const valuePct = gaugeClampPercent(valueRaw);
    const displayText = opts.displayText != null
      ? String(opts.displayText)
      : (Number.isFinite(valueRaw) ? Math.round(valueRaw) + "%" : MISSING);
    const ariaValue = opts.ariaValue != null ? String(opts.ariaValue) : displayText;
    const direction = opts.direction === "higher_is_worse" ? "higher_is_worse" : "higher_is_better";
    const inactiveMix = Number.isFinite(opts.inactiveMix) ? opts.inactiveMix : 0.45;
    const baseColors = direction === "higher_is_worse"
      ? [GAUGE_CLASS_COLORS.vhigh, GAUGE_CLASS_COLORS.high, GAUGE_CLASS_COLORS.mid, GAUGE_CLASS_COLORS.low]
      : [GAUGE_CLASS_COLORS.low, GAUGE_CLASS_COLORS.mid, GAUGE_CLASS_COLORS.high, GAUGE_CLASS_COLORS.vhigh];
    const defaultSegments = [
      { from: 0, to: 25, color: baseColors[0] },
      { from: 25, to: 50, color: baseColors[1] },
      { from: 50, to: 75, color: baseColors[2] },
      { from: 75, to: 100, color: baseColors[3] }
    ];
    const segments = Array.isArray(opts.segments) && opts.segments.length
      ? opts.segments
      : defaultSegments;
    const minLabel = opts.minLabel != null ? String(opts.minLabel) : "0";
    const maxLabel = opts.maxLabel != null ? String(opts.maxLabel) : "100";
    const centerLabel = opts.centerLabel != null ? String(opts.centerLabel) : "";
    const subLabel = opts.subLabel != null ? String(opts.subLabel) : "";
    const ariaLabel = opts.ariaLabel != null
      ? String(opts.ariaLabel)
      : (centerLabel ? (centerLabel + " " + (ariaValue || "")) : "Gauge");
    const needleColor = resolveCssColor(opts.needleColor, "#111827");
    const valueColor = resolveCssColor(opts.valueColor, "#111827");
    const labelColor = resolveCssColor(opts.labelColor, "#374151");
    const subLabelColor = resolveCssColor(opts.subLabelColor, "#6b7280");
    const minMaxColor = resolveCssColor(opts.minMaxColor, "#6b7280");
    const tickColor = resolveCssColor(opts.tickColor, "#9ca3af");

    const width = Number(opts.width) || 220;
    const height = Number(opts.height) || 130;
    const cx = width / 2;
    const cy = height - 12;
    const radius = Math.min(width / 2 - 8, height - 20);
    const stroke = Math.max(10, Math.round(radius * 0.18));
    const gapDeg = Number.isFinite(opts.gapDeg) ? opts.gapDeg : 2;

    const pctToAngle = (pct) => 180 - (pct / 100) * 180;

    let svg =
      "<svg class=\"variance-gauge\" viewBox=\"0 0 " + width + " " + height +
      "\" role=\"img\" aria-label=\"" + escapeSvgText(ariaLabel) + "\">";

    svg += "<g fill=\"none\" stroke-linecap=\"butt\">";
    segments.forEach((seg) => {
      const from = gaugeClampPercent(Number(seg.from));
      const to = gaugeClampPercent(Number(seg.to));
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
      let startAngle = pctToAngle(from);
      let endAngle = pctToAngle(to);
      startAngle = startAngle - gapDeg / 2;
      endAngle = endAngle + gapDeg / 2;
      if (startAngle <= endAngle) return;
      const path = gaugeArcPath(cx, cy, radius, startAngle, endAngle);
      const baseColor = seg.color || "#e5e7eb";
      const isActive = Number.isFinite(valuePct)
        ? (valuePct >= from && (valuePct < to || (to === 100 && valuePct === 100)))
        : true;
      const segColor = isActive ? baseColor : desaturateColor(baseColor, inactiveMix);
      svg += "<path d=\"" + path + "\" stroke=\"" + segColor +
        "\" stroke-width=\"" + stroke + "\" />";
    });
    svg += "</g>";

    if (Number.isFinite(valuePct)){
      const angle = pctToAngle(valuePct);
      const needleLen = radius - stroke / 2 - 2;
      const needle = gaugePolarToCartesian(cx, cy, needleLen, angle);
      svg += "<line x1=\"" + cx.toFixed(2) + "\" y1=\"" + cy.toFixed(2) +
        "\" x2=\"" + needle.x.toFixed(2) + "\" y2=\"" + needle.y.toFixed(2) +
        "\" stroke=\"rgba(255,255,255,0.75)\" stroke-width=\"4\" stroke-linecap=\"round\" />";
      svg += "<line x1=\"" + cx.toFixed(2) + "\" y1=\"" + cy.toFixed(2) +
        "\" x2=\"" + needle.x.toFixed(2) + "\" y2=\"" + needle.y.toFixed(2) +
        "\" stroke=\"" + needleColor + "\" stroke-width=\"2\" stroke-linecap=\"round\" />";
    }
    svg += "<circle cx=\"" + cx.toFixed(2) + "\" cy=\"" + cy.toFixed(2) +
      "\" r=\"4\" fill=\"" + needleColor + "\" />";

    const valueY = cy - radius * 0.55;
    svg += "<text x=\"" + cx.toFixed(2) + "\" y=\"" + valueY.toFixed(2) +
      "\" text-anchor=\"middle\" font-size=\"30\" font-weight=\"900\" fill=\"" + valueColor + "\">" +
      escapeSvgText(displayText) + "</text>";

    if (centerLabel){
      svg += "<text x=\"" + cx.toFixed(2) + "\" y=\"" + (valueY + 16).toFixed(2) +
        "\" text-anchor=\"middle\" font-size=\"11\" font-weight=\"700\" fill=\"" + labelColor + "\">" +
        escapeSvgText(centerLabel) + "</text>";
    }
    if (subLabel){
      svg += "<text x=\"" + cx.toFixed(2) + "\" y=\"" + (valueY + 30).toFixed(2) +
        "\" text-anchor=\"middle\" font-size=\"10\" font-weight=\"600\" fill=\"" + subLabelColor + "\">" +
        escapeSvgText(subLabel) + "</text>";
    }

    const minPos = gaugePolarToCartesian(cx, cy, radius, 180);
    const maxPos = gaugePolarToCartesian(cx, cy, radius, 0);
    const labelY = cy + 12;
    svg += "<text x=\"" + minPos.x.toFixed(2) + "\" y=\"" + labelY +
      "\" text-anchor=\"start\" font-size=\"10\" fill=\"" + minMaxColor + "\">" +
      escapeSvgText(minLabel) + "</text>";
    svg += "<text x=\"" + maxPos.x.toFixed(2) + "\" y=\"" + labelY +
      "\" text-anchor=\"end\" font-size=\"10\" fill=\"" + minMaxColor + "\">" +
      escapeSvgText(maxLabel) + "</text>";

    if (Array.isArray(opts.ticks)){
      opts.ticks.forEach((tick) => {
        const val = gaugeClampPercent(Number(tick.value));
        if (!Number.isFinite(val) || val <= 0 || val >= 100) return;
        const angle = pctToAngle(val);
        const pos = gaugePolarToCartesian(cx, cy, radius + stroke / 2 + 6, angle);
        svg += "<text x=\"" + pos.x.toFixed(2) + "\" y=\"" + (pos.y - 2).toFixed(2) +
          "\" text-anchor=\"middle\" font-size=\"9\" fill=\"" + tickColor + "\">" +
          escapeSvgText(tick.label) + "</text>";
      });
    }

    svg += "</svg>";
    return svg;
  }

  if (typeof window !== "undefined") window.renderGaugeSVG = renderGaugeSVG;

  function formatKpiValue(value, unit){
    if (!isNumber(value)) return MISSING;
    if (unit === "%"){
      return (Math.round(value * 10) / 10).toFixed(1).replace(".", ",") + "%";
    }
    if (unit === "index" || unit === "per10k"){
      return formatFixed1(value);
    }
    return formatInt(value);
  }

  function formatDelta(value, unit){
    if (!isNumber(value)) return MISSING;
    const sign = value >= 0 ? "+" : "";
    if (unit === "%"){
      return sign + (Math.round(value * 10) / 10).toFixed(1).replace(".", ",") + "%";
    }
    if (unit === "index" || unit === "per10k"){
      return sign + formatFixed1(value);
    }
    return sign + formatInt(value);
  }

  function getSemiGaugeProgressColor(valuePct){
    if (!isNumber(valuePct)) return GAUGE_STEPS[2];
    if (valuePct < 25) return GAUGE_STEPS[1];
    if (valuePct < 50) return GAUGE_STEPS[2];
    if (valuePct < 75) return GAUGE_STEPS[3];
    return GAUGE_STEPS[4];
  }

  function formatHealthGaugeDeltaLabel(deltaValue, valueLabel){
    if (!isNumber(deltaValue)) return "";
    const hasPercent = typeof valueLabel === "string" && valueLabel.indexOf("%") !== -1;
    let label = formatDelta(deltaValue, hasPercent ? "%" : "index");
    if (deltaValue === 0) label = label.replace(/^\+/, "");
    return label;
  }

  function buildGaugeBins(min, max, segments){
    if (!isNumber(min) || !isNumber(max) || !isNumber(segments) || segments <= 0){
      return [0, 1];
    }
    const start = min;
    const end = max;
    const span = end - start;
    if (span === 0){
      return Array.from({ length: segments + 1 }, (_, i) => start + i);
    }
    return Array.from({ length: segments + 1 }, (_, i) => start + (span * (i / segments)));
  }

  function buildGaugeTicks(min, max, count){
    if (!isNumber(min) || !isNumber(max) || !isNumber(count) || count < 2) return [];
    const start = min;
    const end = max;
    const span = end - start;
    if (span === 0) return Array.from({ length: count }, () => start);
    return Array.from({ length: count }, (_, i) => start + (span * (i / (count - 1))));
  }

  function formatGaugeTickValue(value, max){
    if (!isNumber(value)) return "";
    const absMax = Math.abs(max);
    if (absMax >= 100000){
      return Math.round(value / 1000) + "k";
    }
    if (absMax >= 1000){
      const v = Math.round((value / 1000) * 10) / 10;
      const text = v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
      return text.replace(".", ",") + "k";
    }
    if (absMax <= 10) return formatFixed1(value);
    return formatNumber(value);
  }

  const segGaugePlugin = {
    id: "segGauge",
    afterDraw: (chart, _args, opts) => {
      if (!chart || !opts) return;
      const meta = chart.getDatasetMeta(0);
      const arc = meta && meta.data && meta.data[0] ? meta.data[0] : null;
      if (!arc) return;
      const ctx = chart.ctx;
      const cx = arc.x;
      const cy = arc.y;
      const rOuter = arc.outerRadius || 0;
      const rInner = arc.innerRadius || 0;
      const min = isNumber(opts.min) ? opts.min : 0;
      const max = isNumber(opts.max) ? opts.max : 100;
      const span = max - min;
      const ticks = Array.isArray(opts.ticks) ? opts.ticks : [];
      const formatTick = typeof opts.formatTick === "function"
        ? opts.formatTick
        : (v) => (isNumber(v) ? String(v) : "");
      const formatValue = typeof opts.formatValue === "function"
        ? opts.formatValue
        : (v) => (isNumber(v) ? String(v) : MISSING);
      const title = opts.title || "";
      const value = isNumber(opts.value) ? opts.value : null;
      const startA = Math.PI;
      const endA = 2 * Math.PI;

      if (ticks.length && span !== 0){
        const areaTop = chart.chartArea ? chart.chartArea.top : 0;
        const maxLabelR = Math.max(0, cy - areaTop - 4);
        const labelR = maxLabelR > 0 ? Math.min(rOuter + 16, maxLabelR) : (rOuter + 10);
        let tickR2 = Math.min(rOuter + 8, labelR - 4);
        let tickR1 = Math.min(rOuter + 2, tickR2 - 2);
        if (tickR2 < tickR1) tickR2 = tickR1;
        ctx.save();
        ctx.strokeStyle = SEG_GAUGE_TICK_LINE;
        ctx.fillStyle = SEG_GAUGE_TICK;
        ctx.lineWidth = 1;
        ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ticks.forEach((t) => {
          if (!isNumber(t)) return;
          const p = span !== 0 ? (t - min) / span : 0;
          const clamped = Math.max(0, Math.min(1, p));
          const ang = startA + (endA - startA) * clamped;
          const x1 = cx + Math.cos(ang) * tickR1;
          const y1 = cy + Math.sin(ang) * tickR1;
          const x2 = cx + Math.cos(ang) * tickR2;
          const y2 = cy + Math.sin(ang) * tickR2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          const text = formatTick(t);
          if (text){
            const lx = cx + Math.cos(ang) * labelR;
            const ly = cy + Math.sin(ang) * labelR;
            ctx.fillText(text, lx, ly);
          }
        });
        ctx.restore();
      }

      if (isNumber(value) && span !== 0){
        const pv = Math.max(min, Math.min(max, value));
        const p = (pv - min) / span;
        const ang = startA + (endA - startA) * p;
        const px = cx;
        const py = cy + rInner * 0.15;
        const needleLen = rOuter * 0.8;
        const tipX = px + Math.cos(ang) * needleLen;
        const tipY = py + Math.sin(ang) * needleLen;
        const baseW = Math.max(12, rOuter * 0.18);
        const baseL = Math.max(14, rOuter * 0.22);
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const b1x = px + nx * (baseW / 2);
        const b1y = py + ny * (baseW / 2);
        const b2x = px - nx * (baseW / 2);
        const b2y = py - ny * (baseW / 2);
        const backX = px - Math.cos(ang) * baseL;
        const backY = py - Math.sin(ang) * baseL;

        ctx.save();
        ctx.fillStyle = SEG_GAUGE_NEEDLE;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.quadraticCurveTo(b1x, b1y, backX, backY);
        ctx.quadraticCurveTo(b2x, b2y, tipX, tipY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, Math.max(6, rOuter * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (title){
        const area = chart.chartArea || { left: 0, top: 0 };
        ctx.save();
        ctx.fillStyle = "#111827";
        ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(title, area.left, Math.max(0, area.top - 6));
        ctx.restore();
      }

      const valueText = formatValue(isNumber(value) ? value : null);
      if (valueText){
        ctx.save();
        ctx.fillStyle = SEG_GAUGE_VALUE;
        ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(valueText, cx, cy + rOuter * 0.55);
        ctx.restore();
      }
    }
  };

  function renderSegmentedGauge(targetElOrCanvas, cfg){
    if (DISABLE_GAUGES) return;
    if (!targetElOrCanvas || !window.Chart) return;
    const config = cfg || {};
    let canvasEl = targetElOrCanvas;
    if (canvasEl.tagName !== "CANVAS"){
      canvasEl = targetElOrCanvas.querySelector("canvas");
      if (!canvasEl){
        canvasEl = document.createElement("canvas");
        targetElOrCanvas.appendChild(canvasEl);
      }
    }
    const key = canvasEl.getAttribute("data-gauge-key") || canvasEl.id || "";
    let min = isNumber(config.min) ? config.min : 0;
    let max = isNumber(config.max) ? config.max : 100;
    if (max < min){
      const tmp = min;
      min = max;
      max = tmp;
    }
    if (max === min){
      max = min + 1;
    }
    const bins = Array.isArray(config.bins) && config.bins.length >= 2
      ? config.bins
      : buildGaugeBins(min, max, 5);
    let weights = bins.slice(0, -1).map((v, i) => Math.max(0, bins[i + 1] - v));
    if (!weights.length || !weights.some((v) => v > 0)){
      weights = [1, 1, 1, 1, 1];
    }
    const colors = Array.isArray(config.colors) && config.colors.length >= weights.length
      ? config.colors
      : SEG_GAUGE_COLORS;
    const ticks = Array.isArray(config.ticks) && config.ticks.length
      ? config.ticks
      : buildGaugeTicks(min, max, 6);
    const formatValue = typeof config.formatValue === "function"
      ? config.formatValue
      : (v) => (isNumber(v) ? String(v) : MISSING);
    const formatTick = typeof config.formatTick === "function"
      ? config.formatTick
      : (v) => (isNumber(v) ? String(v) : "");
    const sig = [
      "seg",
      key,
      config.title || "",
      formatSignatureNumber(config.value, 2),
      formatSignatureNumber(min, 2),
      formatSignatureNumber(max, 2),
      bins.map((v) => formatSignatureNumber(v, 2)).join(",")
    ].join("|");
    if (key && gaugeChartSigs.get(key) === sig) return;
    if (key) gaugeChartSigs.set(key, sig);

    const existing = key ? gaugeCharts.get(key) : null;
    if (existing){
      try{ existing.destroy(); } catch(_){}
      gaugeCharts.delete(key);
    }

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: weights,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        events: [],
        rotation: -Math.PI,
        circumference: Math.PI,
        cutout: "72%",
        radius: "90%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          segGauge: {
            title: config.title || "",
            value: config.value,
            min,
            max,
            ticks,
            formatTick,
            formatValue
          }
        }
      },
      plugins: [segGaugePlugin]
    });
    if (key) gaugeCharts.set(key, chart);
  }

  function cleanupGaugeCharts(activeKeys){
    if (!activeKeys || !activeKeys.size) return;
    gaugeCharts.forEach((chart, key) => {
      if (activeKeys.has(key)) return;
      try{ chart.destroy(); } catch(_){}
      gaugeCharts.delete(key);
      gaugeChartSigs.delete(key);
    });
  }

  const centerTextGauge = {
    id: "centerTextGauge",
    afterDraw: (chart, _args, opts) => {
      const meta = chart.getDatasetMeta(0);
      const arc = meta && meta.data && meta.data[0] ? meta.data[0] : null;
      if (!arc) return;
      const ctx = chart.ctx;
      const area = chart.chartArea || null;
      const cx = arc.x;
      const cy = arc.y;
      const innerR = arc.innerRadius || 0;
      const outerR = arc.outerRadius || 0;
      const valueText = opts && opts.valueLabel ? opts.valueLabel : MISSING;
      const deltaText = opts && opts.deltaLabel ? opts.deltaLabel : "";
      const deltaValue = opts && isNumber(opts.deltaValue) ? opts.deltaValue : null;
      const textColor = (opts && opts.textColor) ? opts.textColor : GAUGE_TEXT;
      const labelColor = colorWithAlpha(textColor, 0.65);
      let deltaColor = textColor;
      let deltaPrefix = "• ";
      if (isNumber(deltaValue)){
        if (deltaValue > 0){
          deltaColor = GAUGE_UP;
          deltaPrefix = "▲ ";
        } else if (deltaValue < 0){
          deltaColor = GAUGE_DOWN;
          deltaPrefix = "▼ ";
        }
      }
      const valueFont = "800 24px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      const deltaFont = "600 11px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      const labelFont = "600 10px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

      const valueY = cy + innerR * 0.05;
      const deltaY = valueY + 16;
      const labelY = area ? Math.min(area.bottom - 2, cy + innerR * 0.65) : (cy + innerR * 0.65);
      const leftX = cx - outerR + 6;
      const rightX = cx + outerR - 6;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Afficher la valeur en vert et en gras
      ctx.fillStyle = "#16a34a";
      ctx.font = valueFont;
      ctx.fillText(valueText, cx, valueY);

      if (deltaText){
        ctx.fillStyle = deltaColor;
        ctx.font = deltaFont;
        ctx.fillText(deltaPrefix + deltaText, cx, deltaY);
      }

      ctx.font = labelFont;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("0%", leftX, labelY);
      ctx.textAlign = "right";
      ctx.fillText("100%", rightX, labelY);
      ctx.restore();
    }
  };

  function renderHealthGauge(targetElOrCanvas, options){
    if (DISABLE_GAUGES) return;
    if (!targetElOrCanvas || !window.Chart) return;
    const opts = options || {};
    let canvasEl = targetElOrCanvas;
    if (canvasEl.tagName !== "CANVAS"){
      canvasEl = targetElOrCanvas.querySelector("canvas");
      if (!canvasEl){
        canvasEl = document.createElement("canvas");
        targetElOrCanvas.appendChild(canvasEl);
      }
    }
    const key = canvasEl.getAttribute("data-gauge-key") || canvasEl.id || "";
    const valuePct = isNumber(opts.valuePct) ? Math.max(0, Math.min(100, opts.valuePct)) : 0;
    const valueLabel = opts.valueLabel || MISSING;
    const deltaValue = isNumber(opts.delta) ? opts.delta : null;
    const deltaLabel = formatHealthGaugeDeltaLabel(deltaValue, valueLabel);
    const sig = [
      key,
      formatSignatureNumber(valuePct, 1),
      valueLabel,
      deltaLabel,
      opts.direction || ""
    ].join("|");
    if (key && gaugeChartSigs.get(key) === sig) return;
    if (key) gaugeChartSigs.set(key, sig);

    const existing = key ? gaugeCharts.get(key) : null;
    if (existing){
      try{ existing.destroy(); } catch(_){}
      gaugeCharts.delete(key);
    }

    const progressColor = getSemiGaugeProgressColor(valuePct);
    const progressValue = Math.max(0, Math.min(100, valuePct));
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [100],
            backgroundColor: [GAUGE_TRACK],
            borderWidth: 0,
            hoverOffset: 0,
            circumference: 180,
            rotation: 270
          },
          {
            data: [progressValue, Math.max(0, 100 - progressValue)],
            backgroundColor: [progressColor, "rgba(0,0,0,0)"],
            borderWidth: 0,
            hoverOffset: 0,
            circumference: 180,
            rotation: 270
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        events: [],
        cutout: "80%",
        rotation: 270,
        circumference: 180,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          centerTextGauge: {
            valueLabel,
            deltaLabel,
            deltaValue,
            textColor: GAUGE_TEXT
          }
        }
      },
      plugins: [centerTextGauge]
    });
    if (key) gaugeCharts.set(key, chart);
  }

  function getHealthGaugeConfig(item){
    const value = item ? item.value : null;
    let valuePct = null;
    let direction = item && item.direction ? item.direction : "badHigh";
    if (axisId === "sante"){
      if (item && isNumber(item.gaugeValuePct)) valuePct = clampPercent(item.gaugeValuePct);
      else valuePct = clampPercent(isNumber(value) ? value : null);
    } else if (item && item.key === "pauvrete"){
      const scaled = isNumber(value) ? (value / 40) * 100 : null;
      valuePct = clampPercent(scaled);
      direction = "badHigh";
    } else if (item && item.key === "chomage"){
      const scaled = isNumber(value) ? (value / 15) * 100 : null;
      valuePct = clampPercent(scaled);
      direction = "badHigh";
    } else if (item && item.key === "analphabetisme"){
      valuePct = clampPercent(isNumber(value) ? value : null);
      direction = "badHigh";
    } else if (item && item.key === "couverture_etab"){
      const scaled = isNumber(value) ? (value / 6) * 100 : null;
      valuePct = clampPercent(scaled);
      direction = "goodHigh";
    } else {
      valuePct = clampPercent(isNumber(value) ? value : null);
    }
    const valueLabel = item && item.gaugeDisplayText ? item.gaugeDisplayText : MISSING;
    return {
      valuePct,
      direction,
      valueLabel
    };
  }

  function getSanteSegmentedGaugeConfig(item){
    if (!item) return null;
    const isPercent = item.unit === "%";
    const title = item.label || "";
    const value = isNumber(item.value) ? item.value : null;
    let min = isPercent ? 0 : (isNumber(item.gaugeMin) ? item.gaugeMin : null);
    let max = isPercent ? 100 : (isNumber(item.gaugeMax) ? item.gaugeMax : null);
    if (!isPercent){
      if (!isNumber(min) || !isNumber(max) || min === max){
        if (isNumber(item.value)){
          const pad = Math.max(1, Math.abs(item.value) * 0.25);
          min = item.value - pad;
          max = item.value + pad;
        } else {
          min = 0;
          max = 1;
        }
      }
      if (max < min){
        const tmp = min;
        min = max;
        max = tmp;
      }
    }
    const bins = buildGaugeBins(min, max, 5);
    const ticks = isPercent ? [0, 20, 40, 60, 80, 100] : buildGaugeTicks(min, max, 6);
    const formatValue = (v) => {
      if (!isNumber(v)) return MISSING;
      if (isPercent) return formatPercent(v);
      if (item.key === "isf") return formatFixed1(v);
      if (item.key === "pop_2024") return formatInt(v);
      return formatNumber(v);
    };
    const formatTick = isPercent
      ? (v) => String(Math.round(v))
      : (v) => formatGaugeTickValue(v, max);
    return {
      title,
      value,
      min,
      max,
      bins,
      ticks,
      colors: SEG_GAUGE_COLORS,
      formatValue,
      formatTick
    };
  }

  function destroyGaugeCharts(){
    if (!gaugeCharts || !gaugeCharts.size) return;
    gaugeCharts.forEach((chart) => {
      if (chart && typeof chart.destroy === "function"){
        try{ chart.destroy(); } catch(_){}
      }
    });
    gaugeCharts.clear();
    gaugeChartSigs.clear();
  }

  const SANTE_KPI_CANDIDATES = {
    population: ["pop_2024","Population 2024","Population_2024","Pop2024","Pop_2024","Pop2014","Pop2014"],
    isf: ["isf","ISF","Indice synth\u00e9tique de f\u00e9condit\u00e9 -ISF-","Indice_synthetique_de_fecundite_ISF","ISF_"],
    handicap: ["handicap_pct","Taux de pr\u00e9valence du handicap (%)","handicap","Handicap (%)","T_prevalence_handicap"],
    ipm_sante: ["ipm_sante_pct","D\u00e9composition de l\u2019IPM par source de privation (en %): Sant\u00e9","IPM Sant\u00e9 (%)","ipm_sante","IPM_Sante"],
    ipm_condvie: ["ipm_condvie_pct","D\u00e9composition de l\u2019IPM par source de privation (en %): Conditions de vie","IPM Conditions de vie (%)","ipm_conditions","IPM_Conditions"]
  };

  function getPropValue(props, candidates){
    if (!props || !Array.isArray(candidates)) return null;
    for (const key of candidates){
      if (Object.prototype.hasOwnProperty.call(props, key)) return props[key];
    }
    const keys = Object.keys(props || {});
    if (!keys.length) return null;
    const normalizedMap = new Map();
    keys.forEach((k) => {
      const token = normalizeKey(k);
      if (token && !normalizedMap.has(token)) normalizedMap.set(token, k);
    });
    for (const cand of candidates){
      const token = normalizeKey(cand);
      if (!token) continue;
      const match = normalizedMap.get(token);
      if (match) return props[match];
    }
    for (const cand of candidates){
      const token = normalizeKey(cand);
      if (!token) continue;
      const match = keys.find((k) => normalizeKey(k).includes(token));
      if (match) return props[match];
    }
    return null;
  }

  function getPropNumber(props, candidates){
    const raw = getPropValue(props, candidates);
    const num = parseNumberFR(raw);
    return isNumber(num) ? num : null;
  }

  function formatIsfValue(value){
    if (!isNumber(value)) return MISSING;
    if (Math.round(value) === value) return formatInt(value);
    return formatFixed1(value);
  }

  function computeSanteGaugeExtents(fc){
    const extents = {
      pop: { min: null, max: null },
      isf: { min: null, max: null }
    };
    if (!fc || !Array.isArray(fc.features)) return extents;
    fc.features.forEach((feature) => {
      const props = feature && feature.properties ? feature.properties : null;
      if (!props) return;
      const popVal = getPropNumber(props, SANTE_KPI_CANDIDATES.population);
      const isfVal = getPropNumber(props, SANTE_KPI_CANDIDATES.isf);
      if (isNumber(popVal)){
        if (!isNumber(extents.pop.min) || popVal < extents.pop.min) extents.pop.min = popVal;
        if (!isNumber(extents.pop.max) || popVal > extents.pop.max) extents.pop.max = popVal;
      }
      if (isNumber(isfVal)){
        if (!isNumber(extents.isf.min) || isfVal < extents.isf.min) extents.isf.min = isfVal;
        if (!isNumber(extents.isf.max) || isfVal > extents.isf.max) extents.isf.max = isfVal;
      }
    });
    return extents;
  }

  function renderCommuneGauges(name){
    if (!csGridEl) return;
    csGridEl.innerHTML = "";
    const model = computeCommuneCardModel(name);
    if (csCommuneNameEl) csCommuneNameEl.textContent = model.name || MISSING;
    if (DISABLE_GAUGES) destroyGaugeCharts();
    if (!model || !Array.isArray(model.items) || !model.items.length) return;

    const row = findRowByName(model.name || name);
    const norm = normalizeCommuneName(model.name || name);
    const entry = norm ? communesByName.get(norm) : null;
    const props = entry && entry.properties ? entry.properties : (row && row.feature ? row.feature.properties : null);
    const santeExtents = axisId === "sante" ? (state.santeGaugeExtents || {}) : null;
    const santeTheme = axisId === "sante" ? getSanteTheme() : null;
    const popExtent = santeExtents ? (santeExtents.pop || {}) : {};
    const isfExtent = santeExtents ? (santeExtents.isf || {}) : {};
    const popMin = isNumber(popExtent.min) ? popExtent.min : null;
    const popMax = isNumber(popExtent.max) ? popExtent.max : null;
    const isfMin = isNumber(isfExtent.min) ? isfExtent.min : null;
    const isfMax = isNumber(isfExtent.max) ? isfExtent.max : null;

    if (axisId === "sante" && props){
      const resolved = {
        pop_2024: getPropNumber(props, SANTE_KPI_CANDIDATES.population),
        isf: getPropNumber(props, SANTE_KPI_CANDIDATES.isf),
        handicap_pct: getPropNumber(props, SANTE_KPI_CANDIDATES.handicap),
        ipm_sante_pct: getPropNumber(props, SANTE_KPI_CANDIDATES.ipm_sante),
        ipm_condvie_pct: getPropNumber(props, SANTE_KPI_CANDIDATES.ipm_condvie)
      };
      model.items.forEach((item) => {
        if (!item || !item.key) return;
        const override = resolved[item.key];
        if (!isNumber(item.value) && isNumber(override)){
          item.value = override;
        }
        if (item.key === "isf") item.gaugeDisplayText = formatIsfValue(item.value);
        else if (item.key === "pop_2024") item.gaugeDisplayText = isNumber(item.value) ? formatInt(item.value) : MISSING;
        else if (item.unit === "%") item.gaugeDisplayText = isNumber(item.value) ? formatPercent(item.value) : MISSING;
        if (item.unit === "%"){
          item.gaugeValuePct = clampPercent(item.value);
        } else if (item.key === "pop_2024"){
          const popPct = normalizeMinMax(item.value, popMin, popMax);
          if (isNumber(popPct)) item.gaugeValuePct = popPct;
          if (isNumber(popMin) && isNumber(popMax)){
            item.gaugeMin = popMin;
            item.gaugeMax = popMax;
          }
        } else if (item.key === "isf"){
          const isfPct = normalizeMinMax(item.value, isfMin, isfMax);
          if (isNumber(isfPct)) item.gaugeValuePct = isfPct;
          if (isNumber(isfMin) && isNumber(isfMax)){
            item.gaugeMin = isfMin;
            item.gaugeMax = isfMax;
          }
        }
      });
    }

    const itemsByFamily = new Map();
    model.items.forEach((item) => {
      const familyId = item.familyId || "sante";
      if (!itemsByFamily.has(familyId)) itemsByFamily.set(familyId, []);
      itemsByFamily.get(familyId).push(item);
    });
    const orderedFamilies = KPI_FAMILY_ORDER.slice();
    itemsByFamily.forEach((_, key) => {
      if (!orderedFamilies.includes(key)) orderedFamilies.push(key);
    });

    orderedFamilies.forEach((familyId) => {
      const familyItems = itemsByFamily.get(familyId);
      if (!familyItems || !familyItems.length) return;
      const orderKeys = KPI_FAMILY_KEYS[familyId];
      if (Array.isArray(orderKeys) && orderKeys.length){
        familyItems.sort((a, b) => {
          const aIdx = orderKeys.indexOf(a.key);
          const bIdx = orderKeys.indexOf(b.key);
          const aPos = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
          const bPos = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
          if (aPos !== bPos) return aPos - bPos;
          return 0;
        });
      }
      const familyMeta = KPI_FAMILIES[familyId] || { label: familyId };
      const familyBlock =
        "<div class=\"kpi-family\" data-family=\"" + familyId + "\">" +
          "<div class=\"kpi-family-header\">" +
            "<span class=\"kpi-family-bar\"></span>" +
            "<span class=\"kpi-family-title\">" + escapeHtml(familyMeta.label || familyId) + "</span>" +
          "</div>" +
          "<div class=\"kpi-family-grid\"></div>" +
        "</div>";
      csGridEl.insertAdjacentHTML("beforeend", familyBlock);
      const familyEl = csGridEl.lastElementChild;
      const gridEl = familyEl ? familyEl.querySelector(".kpi-family-grid") : null;
      if (!gridEl) return;

      familyItems.forEach((item) => {
        const value = item.value;
        const gaugeValue = item.gaugeValuePct;
        const direction = item.direction || "higher_is_better";
        const isGauge = true;
        const gaugeText = item.gaugeDisplayText || MISSING;
        const valueText = gaugeText || MISSING;
        const valueClass = isNumber(value) ? "cs-value" : "cs-value missing";
        const subParts = [];
        if (item.note) subParts.push(item.note);
        if (isNumber(value) && item.rank){
          const deltaTxt = isNumber(item.delta) ? " | Ecart: " + formatDelta(item.delta, item.unit) : "";
          subParts.push("Rang: " + item.rank + "/" + item.total + deltaTxt);
        }
        const sub = subParts.join(" | ");

        const iconUrl = (typeof getKpiIconUrl === "function") ? getKpiIconUrl(item.key) : item.icon;
        const fallbackUrl = (typeof KPI_ICON_FALLBACK !== "undefined") ? KPI_ICON_FALLBACK : "assets/icons/emploi.png";
        const iconOnError = fallbackUrl
          ? "this.onerror=null;this.src='" + fallbackUrl + "';this.classList.add('is-fallback');"
          : "this.style.display='none';";
        const renderer = (typeof window !== "undefined" && typeof window.renderGaugeSVG === "function")
          ? window.renderGaugeSVG
          : renderGaugeSVG;
        const gaugeOptions = {
          valuePct: isNumber(gaugeValue) ? gaugeValue : NaN,
          direction,
          displayText: gaugeText
        };
        if (axisId === "sante"){
          gaugeOptions.segments = getSanteGaugeSegments();
          if (santeTheme){
            gaugeOptions.needleColor = santeTheme.ink;
            gaugeOptions.valueColor = santeTheme.accent;
            gaugeOptions.labelColor = santeTheme.ink;
            gaugeOptions.subLabelColor = santeTheme.muted;
            gaugeOptions.minMaxColor = santeTheme.muted;
            gaugeOptions.tickColor = santeTheme.muted;
          }
          if (item.key === "pop_2024"){
            gaugeOptions.minLabel = "";
            gaugeOptions.maxLabel = "";
            if (isNumber(item.gaugeMin) && isNumber(item.gaugeMax)){
              const minText = formatInt(item.gaugeMin);
              const maxText = formatInt(item.gaugeMax);
              gaugeOptions.subLabel = "min " + minText + " / max " + maxText;
            }
          } else if (item.key === "isf"){
            gaugeOptions.minLabel = "";
            gaugeOptions.maxLabel = "";
            if (isNumber(item.gaugeMin) && isNumber(item.gaugeMax)){
              const minText = formatIsfValue(item.gaugeMin);
              const maxText = formatIsfValue(item.gaugeMax);
              gaugeOptions.subLabel = "min " + minText + " / max " + maxText;
            }
          }
        }
        const gaugeSvg = isGauge
          ? renderer(gaugeOptions)
          : "<div class=\"" + valueClass + "\">" + escapeHtml(valueText) + "</div>";
        let rawText = isGauge ? formatKpiValue(value, item.unit) : "";
        if (axisId === "sante" && item.key === "isf"){
          rawText = isNumber(value) ? formatIsfValue(value) : MISSING;
        } else if (axisId === "sante" && item.key === "pop_2024"){
          rawText = isNumber(value) ? formatInt(value) : MISSING;
        }

        const card =
          "<div class=\"commune-kpi-card\" data-kpi=\"" + item.key + "\" data-family=\"" + familyId + "\">" +
            "<div class=\"commune-kpi-head\">" +
              "<img class=\"commune-kpi-ico\" src=\"" + iconUrl + "\" onerror=\"" + iconOnError + "\" alt=\"\">" +
              "<div class=\"commune-kpi-meta\">" +
                "<div class=\"commune-kpi-title\">" + escapeHtml(item.label) + "</div>" +
                "<div class=\"commune-kpi-sub\">" + escapeHtml(sub) + "</div>" +
              "</div>" +
            "</div>" +
            "<div class=\"commune-kpi-gauge\">" + gaugeSvg + "</div>" +
          "</div>";
        gridEl.insertAdjacentHTML("beforeend", card);
      });
    });
    const gaugesOk = axisId === "sante" && model.items && model.items.length;
    santeGaugesReady = !!gaugesOk;
    themeGaugesReady = !!gaugesOk;
  }

  function renderCommuneProfile(name, props){
    renderCommuneGauges(name);
  }

  function dockGlobalStats(){
    if (!globalStatsDockEl || !statsCardEl) return;
    if (!globalStatsDockEl.contains(statsCardEl)){
      globalStatsDockEl.appendChild(statsCardEl);
    }
    const titleEl = statsCardEl.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Statistiques Globales ";
  }

  function refreshCommuneList(){
    if (!communeListEl) return;
    communeListEl.innerHTML = "";
    const names = Array.from(communesByName.values())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "fr"));
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      communeListEl.appendChild(option);
    });
  }

  function selectCommuneByName(name, options){
    const raw = String(name || "").trim();
    if (!raw) return;
    const entry = communesByName.get(normalizeCommuneName(raw));
    if (!entry){
      renderCommuneProfile(raw || MISSING, null);
      return;
    }

    selectedProfileName = entry.name;
    renderCommuneProfile(entry.name, entry.properties || {});
    if (communeSearchEl) communeSearchEl.value = entry.name;

    if (selectedProfileLayer && geoLayer){
      try{ geoLayer.resetStyle(selectedProfileLayer); } catch(_){}
    }
    selectedProfileLayer = entry.layer || null;
    if (selectedProfileLayer){
      const stroke = (axisId === "sante") ? getSanteTheme().ink : "#111827";
      try{
        selectedProfileLayer.setStyle({ weight: 3, color: stroke, fillOpacity: 0.8 });
      } catch(_){}
    }

    const allowZoom = !(options && options.zoom === false);
    if (allowZoom && map && entry.layer){
      try{ map.fitBounds(entry.layer.getBounds(), { padding: [30, 30] }); } catch(_){}
    }
    if (linesChart) linesChart.draw();
    if (communePopEl){
      communePopEl.removeAttribute("data-open");
      communePopEl.setAttribute("aria-hidden", "true");
    }
    if (axisId === "sante" && rhSanteChart){
      const stats = santeEtabStats || {};
      const features = Array.isArray(stats.features) ? stats.features : [];
      if (features.length){
        const totals = computeRHTotals({ features, communeName: entry.name });
        updateRHSanteChart(totals, entry.name);
      }
    }
  }

  function initCommuneProfile(){
    if (profileInitialized || !communeSidebarEl) return;
    if (!communesByName.size) return;
    profileInitialized = true;
    if (communesByName.has(normalizeCommuneName("Figuig"))){
      selectCommuneByName("Figuig", { zoom: false });
      return;
    }
    const first = communesByName.values().next().value;
    if (first) selectCommuneByName(first.name, { zoom: false });
  }

  function getCommuneName(feature, fallbackIndex, fieldKeys){
    if (feature && feature._labelName) return feature._labelName;
    const p = feature && feature.properties ? feature.properties : {};
    if (p && p.nom_commun && String(p.nom_commun).trim()) return String(p.nom_commun).trim();
    if (p && p.nom_commune && String(p.nom_commune).trim()) return String(p.nom_commune).trim();
    if (p && p.commune && String(p.commune).trim()) return String(p.commune).trim();
    if (p && p.COMMUNE && String(p.COMMUNE).trim()) return String(p.COMMUNE).trim();
    if (p && p.Nom_Commun && String(p.Nom_Commun).trim()) return String(p.Nom_Commun).trim();
    let key = "";
    if (fieldKeys && fieldKeys.commune && Object.prototype.hasOwnProperty.call(p, fieldKeys.commune)){
      key = fieldKeys.commune;
    } else {
      key = pickField(p, FIELD_MAP.commune);
    }
    const name = key ? p[key] : (p.Nom_Commun || p.nom_commun || p.NOM || p.Commune || p.name || p.nom || p.Nom || p.NOM_COMM || p.libelle || "");
    if (name && String(name).trim()) return String(name).trim();
    if (typeof fallbackIndex === "number") return "Commune " + (fallbackIndex + 1);
    return "Commune";
  }

  function warnMissingField(key){
    if (!key || warnedFields.has(key)) return;
    if (axisId === "sante") return;
    console.warn("[Dashboard] Champ manquant pour: " + key);
    warnedFields.add(key);
  }

  function resolveSanteFieldKeys(fc){
    const resolved = {};
    Object.keys(FIELD_MAP).forEach((k) => { resolved[k] = ""; });
    if (!fc || !Array.isArray(fc.features)) return resolved;
    for (const f of fc.features){
      const p = f.properties || {};
      if (!resolved.commune && Object.prototype.hasOwnProperty.call(p, "commune")) resolved.commune = "commune";
      if (!resolved.population && Object.prototype.hasOwnProperty.call(p, "pop_2024")) resolved.population = "pop_2024";
      if (!resolved.pauvrete && Object.prototype.hasOwnProperty.call(p, "ipm_sante_pct")) resolved.pauvrete = "ipm_sante_pct";
      if (!resolved.chomage && Object.prototype.hasOwnProperty.call(p, "handicap_pct")) resolved.chomage = "handicap_pct";
      if (!resolved.analphabetisme && Object.prototype.hasOwnProperty.call(p, "ipm_condvie_pct")) resolved.analphabetisme = "ipm_condvie_pct";
      if (resolved.commune && resolved.population && resolved.pauvrete && resolved.chomage && resolved.analphabetisme) break;
    }
    return resolved;
  }

  function resolveFieldKeys(fc){
    if (axisId === "sante") return resolveSanteFieldKeys(fc);
    const resolved = {};
    Object.keys(FIELD_MAP).forEach((k) => { resolved[k] = ""; });
    if (!fc || !Array.isArray(fc.features)) return resolved;
    for (const f of fc.features){
      const p = f.properties || {};
      Object.keys(FIELD_MAP).forEach((k) => {
        if (resolved[k]) return;
        const found = pickField(p, FIELD_MAP[k]);
        if (found) resolved[k] = found;
      });
    }
    return resolved;
  }

  function getFeatureName(feature, fallbackIndex){
    return getCommuneName(feature, fallbackIndex, dashboardFieldKeys);
  }

  function getNumericFields(fc){
    const counts = new Map();
    fc.features.forEach(f => {
      const p = f.properties || {};
      Object.keys(p).forEach((k) => {
        const val = parseNumberSafe(p[k]);
        if (isNumber(val)) counts.set(k, (counts.get(k) || 0) + 1);
      });
    });
    const threshold = Math.ceil(fc.features.length * 0.6);
    return [...counts.entries()]
      .filter(([,c]) => c >= threshold)
      .map(([k]) => k)
      .sort((a,b) => a.localeCompare(b, "fr"));
  }

  function computeValues(fc, field){
    const vals = [];
    fc.features.forEach(f => {
      const v = getIndicatorValue(f.properties || null, field);
      if (isNumber(v)) vals.push(v);
    });
    vals.sort((a,b) => a-b);
    return vals;
  }

  function quantileBreaks(sortedVals, k){
    const n = sortedVals.length;
    if (n === 0) return [0, 1];
    const out = [sortedVals[0]];
    for (let i = 1; i < k; i++){
      const p = i / k;
      const idx = (n - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      const q = (lo === hi) ? sortedVals[lo] : (sortedVals[lo] + (sortedVals[hi]-sortedVals[lo])*(idx-lo));
      out.push(q);
    }
    out.push(sortedVals[n-1]);
    for (let i=1;i<out.length;i++){ if (out[i] < out[i-1]) out[i] = out[i-1]; }
    return out;
  }

  function equalIntervalBreaks(sortedVals, k){
    const n = sortedVals.length;
    if (n === 0) return [0, 1];
    const min = sortedVals[0];
    const max = sortedVals[n-1];
    if (min === max){
      const eps = Math.abs(min) * 0.01 + 1;
      const out = [];
      for (let i=0;i<=k;i++) out.push(min + (eps * i / k));
      return out;
    }
    const step = (max - min) / k;
    const out = [min];
    for (let i=1;i<k;i++) out.push(min + step*i);
    out.push(max);
    return out;
  }

  function buildClasses(breaksArr, paletteName="YlOrRd", labelsArr=CLASS_LABELS){
    const k = breaksArr.length - 1;
    const base = Array.isArray(paletteName) && paletteName.length >= k
      ? paletteName.slice(0, k)
      : chroma.scale(paletteName).mode("lab").colors(k);
    const ranges = [];
    for (let i=0;i<k;i++){
      const a = breaksArr[i];
      const b = breaksArr[i+1];
      const label = labelsArr && labelsArr[i] ? labelsArr[i] : (formatNumber(a) + " – " + formatNumber(b));
      ranges.push({ min:a, max:b, label, color: base[i] });
    }
    return ranges;
  }

  function getClassIndex(value, breaksArr){
    if (!isNumber(value)) return null;
    if (!Array.isArray(breaksArr) || breaksArr.length < 2) return null;
    const k = breaksArr.length - 1;
    for (let i=0; i<k; i++){
      const a = breaksArr[i];
      const b = breaksArr[i+1];
      const isLast = (i === k-1);
      if ((value >= a && value < b) || (isLast && value >= a && value <= b)) return i;
    }
    return null;
  }

  function classIndexForValue(v){
    return getClassIndex(v, breaks);
  }

  function styleFeature(feature){
    const v = getIndicatorValue(feature.properties || null, selectedField);
    const idx = classIndexForValue(v);
    const theme = (axisId === "sante") ? getSanteTheme() : null;
    const stroke = theme && theme.ink ? theme.ink : "#111827";
    const fallbackFill = theme && theme.border ? theme.border : "#d1d5db";

    const filtered =
      (isolatedClassIndex !== null) ? (idx !== isolatedClassIndex) :
      (activeClassIndex !== null) ? (idx !== activeClassIndex) :
      false;

    const fill = (idx === null) ? fallbackFill : classRanges[idx].color;

    return {
      weight: 1.2,
      color: filtered ? colorWithAlpha(stroke, 0.25) : colorWithAlpha(stroke, 0.75),
      opacity: 1,
      fillColor: fill,
      fillOpacity: filtered ? 0.12 : 0.62
    };
  }

  function highlight(e){
    const layer = e.target;
    const stroke = (axisId === "sante") ? getSanteTheme().ink : "#111827";
    layer.setStyle({ weight: 2.5, color: stroke, fillOpacity: 0.78 });
    layer.bringToFront();
  }
  function unhighlight(e){ geoLayer.resetStyle(e.target); }

  function popupHtml(f){
    const p = f.properties || {};
    const name = getCommuneName(f, null, dashboardFieldKeys);
    const popRaw = parseNumberFR(p.pop_2024);
    const ipmRaw = parseNumberFR(p.ipm_sante_pct);
    const handicapRaw = parseNumberFR(p.handicap_pct);
    const condvieRaw = parseNumberFR(p.ipm_condvie_pct);
    const popVal = isNumber(popRaw) ? formatInt(popRaw) : MISSING;
    const ipmVal = isNumber(ipmRaw) ? formatPercent(ipmRaw) : MISSING;
    const handicapVal = isNumber(handicapRaw) ? formatPercent(handicapRaw) : MISSING;
    const condvieVal = isNumber(condvieRaw) ? formatPercent(condvieRaw) : MISSING;
    const muted = (axisId === "sante") ? getSanteTheme().muted : "#6b7280";

    return "<div style='min-width:240px'>" +
      "<div style='font-weight:700; font-size:14px; margin-bottom:6px'>" + escapeHtml(name) + "</div>" +
      "<div style='display:grid; gap:6px'>" +
        "<div style='display:flex; justify-content:space-between; gap:10px; align-items:baseline'>" +
          "<div style='font-size:12px; color:" + muted + "'>Population 2024</div>" +
          "<div style='font-size:16px; font-weight:800'>" + escapeHtml(popVal) + "</div>" +
        "</div>" +
        "<div style='display:flex; justify-content:space-between; gap:10px; align-items:baseline'>" +
          "<div style='font-size:12px; color:" + muted + "'>IPM Sant\u00e9 (%)</div>" +
          "<div style='font-size:14px; font-weight:700'>" + escapeHtml(ipmVal) + "</div>" +
        "</div>" +
        "<div style='display:flex; justify-content:space-between; gap:10px; align-items:baseline'>" +
          "<div style='font-size:12px; color:" + muted + "'>Handicap (%)</div>" +
          "<div style='font-size:14px; font-weight:700'>" + escapeHtml(handicapVal) + "</div>" +
        "</div>" +
        "<div style='display:flex; justify-content:space-between; gap:10px; align-items:baseline'>" +
          "<div style='font-size:12px; color:" + muted + "'>Conditions de vie (%)</div>" +
          "<div style='font-size:14px; font-weight:700'>" + escapeHtml(condvieVal) + "</div>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function tooltipText(f){
    const p = f.properties || {};
    const name = getCommuneName(f, null, dashboardFieldKeys);
    const v = getIndicatorValue(p, selectedField);
    const text = formatSanteIndicatorValue(selectedField, v);
    return name + " \u2014 " + text;
  }

  function getFilteredFeatures(fc){
    if (!fc || !Array.isArray(fc.features)) return [];
    if (!selectedField || !breaks.length) return fc.features.slice();
    if (activeClassIndex === null && isolatedClassIndex === null) return fc.features.slice();
    const target = (isolatedClassIndex !== null) ? isolatedClassIndex : activeClassIndex;
    return fc.features.filter((f) => {
      const v = getIndicatorValue(f.properties || null, selectedField);
      const idx = getClassIndex(v, breaks);
      return idx === target;
    });
  }

  function buildMetricContext(fc, fieldKeys){
    const context = { maxPop: 0, missing: {} };
    RADAR_KEYS.forEach((k) => { context.missing[k] = true; });
    if (!fc || !Array.isArray(fc.features)) return context;
    let popCount = 0;
    fc.features.forEach((f) => {
      const p = f.properties || {};
      if (fieldKeys.population){
        const val = parseNumberSmart(p[fieldKeys.population], false);
        if (Number.isFinite(val)){
          popCount += 1;
          if (val > context.maxPop) context.maxPop = val;
        }
      }
      RADAR_KEYS.forEach((k) => {
        if (k === "population") return;
        const key = fieldKeys[k];
        if (!key) return;
        const val = parseNumberSmart(p[key], true);
        if (Number.isFinite(val)) context.missing[k] = false;
      });
    });
    context.missing.population = !(fieldKeys.population) || popCount === 0;
    if (!fieldKeys.population) context.maxPop = 0;
    return context;
  }

  function buildDashboardRows(features, fieldKeys, context){
    const percentKeys = ["pauvrete","chomage","analphabetisme","eau","electricite","assainissement","activite","scolarisation","vulnerabilite"];
    const rows = [];
    if (!Array.isArray(features)) return rows;
    features.forEach((f, idx) => {
      const p = f.properties || {};
      const name = getCommuneName(f, idx, fieldKeys);
      const row = { name, commune: name, feature: f };
      if (fieldKeys.population){
        const val = parseNumberSmart(p[fieldKeys.population], false);
        row.population = Number.isFinite(val) ? val : null;
      } else {
        row.population = null;
      }
      percentKeys.forEach((k) => {
        if (!fieldKeys[k]) { row[k] = null; return; }
        const val = parseNumberSmart(p[fieldKeys[k]], true);
        row[k] = Number.isFinite(val) ? val : null;
      });
      if (axisId === "sante"){
        const isfVal = parseNumberFR(p.isf);
        row.isf = isNumber(isfVal) ? isfVal : null;
        row.couverture_etab = null;
      }
      rows.push(row);
    });
    return rows;
  }

  function ensureDefaultSelection(rows){
    if (DISABLE_COMPARE_COMMUNES){
      selectedCommuneQueue = [];
      return;
    }
    const available = new Set(rows.map(r => r.name));
    selectedCommuneQueue = selectedCommuneQueue.filter((name) => available.has(name));
    if (userTouchedSelection && selectedCommuneQueue.length) return;
    if (!rows.length) return;
    const sorted = rows.slice();
    const hasPop = sorted.some(r => isNumber(r.population));
    if (hasPop){
      sorted.sort((a, b) => {
        const av = isNumber(a.population) ? a.population : -Infinity;
        const bv = isNumber(b.population) ? b.population : -Infinity;
        if (bv !== av) return bv - av;
        return a.name.localeCompare(b.name, "fr");
      });
    }
    const base = hasPop ? sorted : rows;
    selectedCommuneQueue = base.slice(0, 3).map(r => r.name);
  }

  function updateKpiValue(el, value, formatter){
    if (!el) return;
    const text = formatter(value);
    el.textContent = text;
    if (text === MISSING) el.classList.add("missing");
    else el.classList.remove("missing");
  }

  function updateKpiLabel(valueEl, text){
    if (!valueEl || !text) return;
    const card = valueEl.parentElement || null;
    const labelEl = card ? card.querySelector(".kpi-label") : null;
    if (labelEl) labelEl.textContent = text;
  }

  function setChartMessage(canvas, message){
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const id = canvas.id || "";
    const selector = ".chart-message" + (id ? "[data-for=\"" + id + "\"]" : "");
    let el = parent.querySelector(selector);
    const muted = (axisId === "sante") ? getSanteTheme().muted : "#6b7280";
    if (!message){
      if (el) el.remove();
      canvas.style.display = "";
      return;
    }
    if (!el){
      el = document.createElement("div");
      el.className = "chart-message";
      if (id) el.setAttribute("data-for", id);
      el.style.cssText = "position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; color:" + muted + "; text-align:center; padding:6px;";
      parent.appendChild(el);
    }
    try{
      if (window.getComputedStyle(parent).position === "static"){
        parent.style.position = "relative";
      }
    } catch(_){}
    el.textContent = message;
    canvas.style.display = "none";
  }

  function average(values){
    const list = values.filter(isNumber);
    if (!list.length) return null;
    const sum = list.reduce((a, b) => a + b, 0);
    return sum / list.length;
  }

  function formatSignatureNumber(value, decimals){
    if (!isNumber(value)) return "na";
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    return rounded.toFixed(decimals);
  }

  function maybeLogSanteUi(){
    if (santeUiLogged) return;
    if (santeGaugesReady && santeCompareReady){
      console.info("[SANTE_UI] gauges=ok compare=ok");
      santeUiLogged = true;
    }
  }

  function maybeLogThemeSante(){
    if (themeSanteLogged) return;
    if (!themeClassesReady || !themeGaugesReady) return;
    console.info("[THEME_SANTE] gauges=ok classes=ok");
    themeSanteLogged = true;
  }

  function formatSanteStat(value){
    if (!isNumber(value)) return "NA";
    return formatSignatureNumber(value, 2);
  }

  function maybeLogSanteData(){
    if (santeDataLogged) return;
    if (!santeDataStats || !santeDataStats.ready) return;
    const values = Object.values(santeDataCounts);
    if (!values.every((v) => v !== null)) return;
    console.info(
      "[SANTE_DATA] communes=" + santeDataCounts.communes +
      " etab=" + santeDataCounts.etab +
      " pv=" + santeDataCounts.pv +
      " chef_lieu=" + santeDataCounts.chef_lieu +
      " ipmMin=" + formatSanteStat(santeDataStats.ipmMin) +
      " ipmMax=" + formatSanteStat(santeDataStats.ipmMax) +
      " hMin=" + formatSanteStat(santeDataStats.hMin) +
      " hMax=" + formatSanteStat(santeDataStats.hMax)
    );
    santeDataLogged = true;
  }

  function reportSanteDataCount(key, count){
    if (!key || !santeDataCounts || !Object.prototype.hasOwnProperty.call(santeDataCounts, key)) return;
    santeDataCounts[key] = isNumber(count) ? count : 0;
    maybeLogSanteData();
  }

  function reportSanteDataStats(ipmRange, handicapRange){
    santeDataStats = {
      ipmMin: ipmRange && isNumber(ipmRange.min) ? ipmRange.min : null,
      ipmMax: ipmRange && isNumber(ipmRange.max) ? ipmRange.max : null,
      hMin: handicapRange && isNumber(handicapRange.min) ? handicapRange.min : null,
      hMax: handicapRange && isNumber(handicapRange.max) ? handicapRange.max : null,
      ready: true
    };
    maybeLogSanteData();
  }

  function logSanteIndicatorChange(){
    if (axisId !== "sante") return;
    if (!selectedField || !Array.isArray(breaks) || breaks.length < 2) return;
    if (selectedField === lastSanteIndicField) return;
    const formatted = breaks.map((v) => {
      if (!isNumber(v)) return v;
      return Math.round(v * 100) / 100;
    });
    console.info("[SANTE_INDIC] field=" + selectedField + " breaks=" + JSON.stringify(formatted));
    lastSanteIndicField = selectedField;
  }

  function scheduleSanteRefresh(){
    if (santeRefreshTimer) clearTimeout(santeRefreshTimer);
    santeRefreshTimer = setTimeout(() => {
      santeRefreshTimer = null;
      renderKpis(true);
      if (santeReadyCommunes && santeReadyEtab) refreshSanteCharts();
    }, 200);
  }

  function renderKpis(shouldLog){
    // 🔒 GLOBAL STATS FIGÉES — ne plus recalculer
    return;
    const allFeatures = geojsonData && Array.isArray(geojsonData.features) ? geojsonData.features : [];
    const features = (axisId === "sante") ? getFilteredFeatures(geojsonData) : allFeatures;
    const communesCount = features.length;
    const popValues = [];
    const ipmValues = [];
    const handicapValues = [];
    features.forEach((f) => {
      const p = f && f.properties ? f.properties : {};
      const popVal = parseNumberFR(p.pop_2024);
      const ipmVal = parseNumberFR(p.ipm_sante_pct);
      const handicapVal = parseNumberFR(p.handicap_pct);
      if (isNumber(popVal)) popValues.push(popVal);
      if (isNumber(ipmVal)) ipmValues.push(ipmVal);
      if (isNumber(handicapVal)) handicapValues.push(handicapVal);
    });

    const popTotal = popValues.length ? popValues.reduce((a, b) => a + b, 0) : null;
    const ipmAvg = average(ipmValues);
    const handicapAvg = average(handicapValues);

    const popSig = formatSignatureNumber(popTotal, 0);
    const ipmSig = formatSignatureNumber(ipmAvg, 1);
    const handicapSig = formatSignatureNumber(handicapAvg, 1);
    const sig = [communesCount, popSig, ipmSig, handicapSig].join("|");
    if (sig === lastSanteKpiSig) return;
    lastSanteKpiSig = sig;

    updateKpiLabel(kpiPopulationEl, "Population 2024");
    updateKpiLabel(kpiPauvreteEl, "IPM Sant\u00e9 moyen (%)");
    updateKpiLabel(kpiChomageEl, "Handicap moyen (%)");
    updateKpiValue(kpiPopulationEl, popTotal, formatInt);
    updateKpiValue(kpiPauvreteEl, ipmAvg, formatPercent);
    updateKpiValue(kpiChomageEl, handicapAvg, formatPercent);
    if (shouldLog !== false){
      const popLog = isNumber(popTotal) ? Math.round(popTotal) : "NA";
      const ipmLog = isNumber(ipmAvg) ? Math.round(ipmAvg * 10) / 10 : "NA";
      const handicapLog = isNumber(handicapAvg) ? Math.round(handicapAvg * 10) / 10 : "NA";
      console.info(
        "[SANTE_KPI] popTotal=" + popLog +
        " ipmAvg=" + ipmLog +
        " handicapAvg=" + handicapLog
      );
    }
  }

  function colorWithAlpha(color, alpha){
    const resolved = resolveCssColor(color, color);
    if (!resolved) return "rgba(17,24,39," + alpha + ")";
    const rgbMatch = String(resolved).match(/rgba?\(([^)]+)\)/i);
    if (rgbMatch){
      const parts = rgbMatch[1].split(",").map((p) => p.trim());
      if (parts.length >= 3){
        return "rgba(" + parts[0] + "," + parts[1] + "," + parts[2] + "," + alpha + ")";
      }
      return resolved;
    }
    if (resolved[0] !== "#") return resolved;
    let r = 17, g = 24, b = 39;
    if (resolved.length === 4){
      r = parseInt(resolved[1] + resolved[1], 16);
      g = parseInt(resolved[2] + resolved[2], 16);
      b = parseInt(resolved[3] + resolved[3], 16);
    } else if (resolved.length >= 7){
      r = parseInt(resolved.slice(1, 3), 16);
      g = parseInt(resolved.slice(3, 5), 16);
      b = parseInt(resolved.slice(5, 7), 16);
    }
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function darkenHexColor(hex, amount){
    try{
      if (typeof chroma !== "undefined" && chroma && hex) return chroma(hex).darken(amount || 0.6).hex();
    } catch(_){}
    return hex;
  }

  function destroyRadarChart(){
    if (radarChart){
      radarChart.destroy();
      radarChart = null;
    }
  }

  function ensureSanteCompareKpiEl(){
    if (!radarCanvas) return null;
    const parent = radarCanvas.parentElement;
    if (!parent) return null;
    let el = parent.querySelector("#santeCompareKpi");
    if (!el){
      el = document.createElement("div");
      el.id = "santeCompareKpi";
      el.style.cssText = "display:flex; flex-direction:column; gap:8px; padding:4px 2px;";
      parent.appendChild(el);
    }
    return el;
  }

  function renderRadar(){
    if (DISABLE_COMPARE_COMMUNES){
      destroyRadarChart();
      if (radarCanvas){
        setChartMessage(radarCanvas, "");
        radarCanvas.style.display = "none";
      }
      return { ok:false, reason: "disabled" };
    }
    if (!radarCanvas) return { ok:false, reason: "no_canvas" };
    const kpiEl = ensureSanteCompareKpiEl();
    if (!kpiEl) return { ok:false, reason: "no_container" };
    const theme = (axisId === "sante") ? getSanteTheme() : { muted: "#6b7280", ink: "#0f172a", etabTypes: {} };
    const muted = theme.muted || "#6b7280";
    const ink = theme.ink || "#0f172a";
    const etabColors = theme.etabTypes || {};

    destroyRadarChart();
    setChartMessage(radarCanvas, "");
    radarCanvas.style.display = "none";

    const selected = Array.isArray(selectedCommuneQueue)
      ? selectedCommuneQueue.slice(0, 3)
      : [];
    const selectedKeys = selected.map(normalizeCommuneKey).filter(Boolean);
    if (!selectedKeys.length){
      kpiEl.innerHTML =
        "<div style=\"color:" + muted + "; font-size:12px; text-align:center; padding:8px 6px;\">" +
          "S\u00e9lectionnez jusqu\u2019\u00e0 3 communes pour comparer." +
        "</div>";
      return { ok:false, reason: "no_selection" };
    }

    const stats = santeEtabStats || {};
    const features = Array.isArray(stats.features) ? stats.features : [];
    const etabTotal = isNumber(stats.total) ? stats.total : 0;
    if (!features.length || !etabTotal){
      kpiEl.innerHTML =
        "<div style=\"color:" + muted + "; font-size:12px; text-align:center; padding:8px 6px;\">" +
          "Donn\u00e9e indisponible" +
        "</div>";
      return { ok:false, reason: "no_etab" };
    }

    const statsByKey = new Map();
    selected.forEach((name) => {
      const key = normalizeCommuneKey(name);
      if (!key) return;
      statsByKey.set(key, {
        name: name || "",
        total: 0,
        hopital: 0,
        cs_urbain: 0,
        cs_rural: 0,
        dispensaire: 0,
        autre: 0
      });
    });
    if (!statsByKey.size){
      kpiEl.innerHTML =
        "<div style=\"color:" + muted + "; font-size:12px; text-align:center; padding:8px 6px;\">" +
          "S\u00e9lectionnez jusqu\u2019\u00e0 3 communes pour comparer." +
        "</div>";
      return { ok:false, reason: "no_selection" };
    }

    features.forEach((feature) => {
      const props = feature && feature.properties ? feature.properties : {};
      const rawCommune = getEtabFieldValue(props, etabCommField, ETAB_FIELD_CANDIDATES.commune);
      const key = normalizeCommuneKey(rawCommune);
      const entry = key ? statsByKey.get(key) : null;
      if (!entry) return;
      const rawType = getEtabFieldValue(props, etabTypeField, ETAB_FIELD_CANDIDATES.type);
      const typeKey = normalizeEtabType(rawType || "");
      const count = getFeaturePointCoords(feature).length;
      if (!count) return;
      entry.total += count;
      entry[typeKey] = (entry[typeKey] || 0) + count;
    });

    const entries = selectedKeys.map(key => statsByKey.get(key)).filter(Boolean);
    const selectedTotal = entries.reduce((sum, entry) => sum + (entry ? entry.total : 0), 0);
    if (!selectedTotal){
      kpiEl.innerHTML =
        "<div style=\"color:" + muted + "; font-size:12px; text-align:center; padding:8px 6px;\">" +
          "Donn\u00e9e indisponible" +
        "</div>";
      return { ok:false, reason: "no_etab_selected" };
    }

    const buildBadge = (label, value, color) => {
      const valText = isNumber(value) ? formatInt(value) : "0";
      const dot = "<span style=\"width:8px; height:8px; border-radius:999px; background:" + color + "; display:inline-block;\"></span>";
      return (
        "<span style=\"display:inline-flex; align-items:center; gap:6px; font-size:11px; color:" + ink + ";\">" +
          dot +
          "<span>" + label + " <strong>" + escapeHtml(valText) + "</strong></span>" +
        "</span>"
      );
    };

    const cards = entries.map((entry) => {
      const badges = [
        buildBadge("HP", entry.hopital || 0, etabColors.hopital || theme.accent),
        buildBadge("CSU", entry.cs_urbain || 0, etabColors.cs_urbain || theme.accent),
        buildBadge("CSR", entry.cs_rural || 0, etabColors.cs_rural || theme.accent),
        buildBadge("DR", entry.dispensaire || 0, etabColors.dispensaire || theme.accent),
        buildBadge("SRES", entry.sres || 0, etabColors.sres || theme.accent)
      ];
      if ((entry.autre || 0) > 0){
        badges.push(buildBadge("Autre", entry.autre || 0, etabColors.autre || muted));
      }
      return (
        "<div style=\"border:1px solid " + (theme.border || "#e2e8f0") + "; border-radius:10px; padding:8px 10px; background:#f8fafc;\">" +
          "<div style=\"font-weight:700; font-size:12px; color:" + ink + "; margin-bottom:4px;\">" +
            escapeHtml(entry.name || MISSING) +
          "</div>" +
          "<div style=\"font-size:12px; color:" + ink + "; margin-bottom:6px;\">" +
            "Total \u00e9tablissements: <strong>" + escapeHtml(formatInt(entry.total || 0)) + "</strong>" +
          "</div>" +
          "<div style=\"display:flex; flex-wrap:wrap; gap:6px;\">" + badges.join("") + "</div>" +
        "</div>"
      );
    });

    kpiEl.innerHTML = cards.join("");

    const logTotals = {};
    entries.forEach((entry) => {
      logTotals[entry.name || ""] = {
        total: entry.total || 0,
        hopital: entry.hopital || 0,
        cs_urbain: entry.cs_urbain || 0,
        cs_rural: entry.cs_rural || 0,
        dispensaire: entry.dispensaire || 0,
        autre: entry.autre || 0
      };
    });
    const sig = entries.map((entry) => [
      normalizeCommuneKey(entry.name),
      entry.total || 0,
      entry.hopital || 0,
      entry.cs_urbain || 0,
      entry.cs_rural || 0,
      entry.dispensaire || 0,
      entry.autre || 0
    ].join(",")).join("|");
    if (sig !== lastSanteCompareKpiSig){
      lastSanteCompareKpiSig = sig;
      console.info(
        "[SANTE_COMPARE_KPI] communes=" + JSON.stringify(entries.map(e => e.name)) +
        " totals=" + JSON.stringify(logTotals)
      );
    }
    return { ok:true };
  }

  function sortRows(rows, sortKey, sortDir){
    const dir = sortDir === "desc" ? -1 : 1;
    return rows.slice().sort((a, b) => {
      if (sortKey === "commune"){
        return dir * a.name.localeCompare(b.name, "fr");
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      const aNum = isNumber(av);
      const bNum = isNumber(bv);
      if (aNum && bNum){
        if (av !== bv) return dir * (av - bv);
        return a.name.localeCompare(b.name, "fr");
      }
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      return a.name.localeCompare(b.name, "fr");
    });
  }

  function updateTableHeader(){
    if (!dataTableEl) return;
    const ths = dataTableEl.querySelectorAll("thead th[data-field]");
    ths.forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      const key = th.getAttribute("data-field");
      if (key === tableSortKey){
        th.classList.add(tableSortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function formatIntFR(value){
    if (!isNumber(value)) return MISSING;
    return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  }

  function formatPctFR(value){
    if (!isNumber(value)) return MISSING;
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  function formatFloat2FR(value){
    if (!isNumber(value)) return MISSING;
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatSanteTableValue(col, value){
    if (!col) return value || MISSING;
    if (col.type === "text"){
      const text = value !== null && value !== undefined ? String(value).trim() : "";
      return text ? text : MISSING;
    }
    if (col.type === "int") return formatIntFR(value);
    if (col.type === "pct1") return formatPctFR(value);
    if (col.type === "float2") return formatFloat2FR(value);
    return value || MISSING;
  }

  function resolveTableFieldKey(props, aliases){
    return resolvePropWithKey(props, aliases || []).key || "";
  }

  function buildSanteTableRows(fc){
    const rows = [];
    const features = fc && Array.isArray(fc.features) ? fc.features : [];
    const resolved = {};
    TABLE_COLUMNS_SANTE.forEach((col) => { resolved[col.key] = ""; });
    const sampleProps = features[0] && features[0].properties ? features[0].properties : {};
    const ipmSanteCol = TABLE_COLUMNS_SANTE.find((col) => col.key === "ipm_sante");
    const ipmCondCol = TABLE_COLUMNS_SANTE.find((col) => col.key === "ipm_conditions");
    const ipmSanteAliases = ipmSanteCol ? ipmSanteCol.aliases : [];
    const ipmCondAliases = ipmCondCol ? ipmCondCol.aliases : [];
    let ipmSanteKey = findKeyByPatterns(sampleProps, [
      ["ipm","sante"],
      ["decomposition","ipm","sante"],
      ["privation","sante"],
      ["sante"]
    ]) || resolveTableFieldKey(sampleProps, ipmSanteAliases);
    let ipmCondKey = findKeyByPatterns(sampleProps, [
      ["ipm","conditionsdevie"],
      ["decomposition","ipm","conditionsdevie"],
      ["privation","conditionsdevie"],
      ["conditionsdevie"]
    ]) || resolveTableFieldKey(sampleProps, ipmCondAliases);
    if (ipmSanteKey) resolved.ipm_sante = ipmSanteKey;
    if (ipmCondKey) resolved.ipm_conditions = ipmCondKey;
    for (const f of features){
      const props = f && f.properties ? f.properties : {};
      TABLE_COLUMNS_SANTE.forEach((col) => {
        if (resolved[col.key]) return;
        const key = resolveTableFieldKey(props, col.aliases);
        if (key) resolved[col.key] = key;
      });
      if (TABLE_COLUMNS_SANTE.every((col) => resolved[col.key])) break;
    }
    ipmSanteKey = resolved.ipm_sante || ipmSanteKey || "";
    ipmCondKey = resolved.ipm_conditions || ipmCondKey || "";
    state.santeFieldKeys.ipm_sante = ipmSanteKey;
    state.santeFieldKeys.ipm_conditions = ipmCondKey;
    const fieldsSig = [ipmSanteKey || "", ipmCondKey || ""].join("|");
    if (fieldsSig !== lastSanteFieldsSig){
      lastSanteFieldsSig = fieldsSig;
      console.info(
        "[SANTE_FIELDS] ipm_sante=\"" + (ipmSanteKey || "null") +
        "\" ipm_conditions=\"" + (ipmCondKey || "null") + "\""
      );
    }
    features.forEach((f, idx) => {
      const props = f && f.properties ? f.properties : {};
      const name = getFeatureName(f, idx);
      const row = {
        name,
        commune: name
      };
      TABLE_COLUMNS_SANTE.forEach((col) => {
        if (col.key === "commune") return;
        const key = resolved[col.key];
        const raw = key ? props[key] : resolveProp(col.aliases, props);
        const parsed = parseNumberFR(raw);
        row[col.key] = isNumber(parsed) ? parsed : null;
      });
      rows.push(row);
    });
    const columns = TABLE_COLUMNS_SANTE.filter((col) => {
      if (col.key === "commune") return true;
      const hasValue = rows.some((row) => {
        const value = row[col.key];
        if (col.type === "text"){
          return value !== null && value !== undefined && String(value).trim() !== "";
        }
        return isNumber(value);
      });
      return hasValue;
    });
    const sig = [features.length, JSON.stringify(resolved), columns.length].join("|");
    if (sig !== lastSanteTableSig){
      lastSanteTableSig = sig;
      console.info(
        "[SANTE_TABLE] cols=" + columns.length +
        " rows=" + features.length +
        " resolved=" + JSON.stringify(resolved)
      );
    }
    return { rows, columns };
  }

  function ensureSanteTableHeader(columns){
    if (!dataTableEl) return;
    const thead = dataTableEl.querySelector("thead");
    const row = thead ? thead.querySelector("tr") : null;
    if (!row) return;
    const sig = columns.map((c) => c.key + ":" + c.label).join("|");
    if (row.getAttribute("data-sante-cols") === sig) return;
    row.setAttribute("data-sante-cols", sig);
    row.innerHTML = columns
      .map((col) => "<th data-field=\"" + col.key + "\">" + escapeHtml(col.label) + "</th>")
      .join("");
  }

  function formatTableCell(key, value){
    if (key === "commune") return value || MISSING;
    if (key === "population") return formatInt(value);
    return formatPercent(value);
  }

  function renderTable(rows){
    if (!dataTbodyEl) return;
    let columns = null;
    let baseRows = rows;
    if (axisId === "sante"){
      const tableData = buildSanteTableRows(geojsonData);
      columns = tableData.columns;
      currentTableColumns = columns;
      ensureSanteTableHeader(columns);
      baseRows = tableData.rows;
      const colKeys = new Set(columns.map((col) => col.key));
      if (!colKeys.has(tableSortKey)) tableSortKey = "commune";
    } else {
      currentTableColumns = null;
    }
    const query = String(tableFilterText || "").toLowerCase().trim();
    let list = Array.isArray(baseRows) ? baseRows.slice() : [];
    if (query){
      list = list.filter(r => String(r.name || r.commune || "").toLowerCase().includes(query));
    }
    list = sortRows(list, tableSortKey, tableSortDir);
    currentTableRows = list;
    dataTbodyEl.innerHTML = "";
    list.forEach((row) => {
      const tr = document.createElement("tr");
      const cells = (axisId === "sante" && columns)
        ? columns.map((col) => {
          const value = (col.key === "commune") ? row.commune : row[col.key];
          return "<td>" + escapeHtml(formatSanteTableValue(col, value)) + "</td>";
        })
        : TABLE_KEYS.map((key) => {
          const value = (key === "commune") ? row.name : row[key];
          return "<td>" + escapeHtml(formatTableCell(key, value)) + "</td>";
        });
      tr.innerHTML = cells.join("");
      tr.addEventListener("click", () => {
        const layer = mapNameToLayer.get(row.name);
        if (!layer || !map) return;
        const stroke = (axisId === "sante") ? getSanteTheme().ink : "#111827";
        const highlightStyle = { weight: 3.2, color: stroke, fillOpacity: 0.8 };
        try{
          map.fitBounds(layer.getBounds(), { padding: [30, 30] });
          layer.setStyle(highlightStyle);
          layer.bringToFront();
          setTimeout(() => {
            if (geoLayer && layer) geoLayer.resetStyle(layer);
          }, 900);
        } catch(_){}
      });
      dataTbodyEl.appendChild(tr);
    });
    updateTableHeader();
  }

  function csvEscape(value){
    const s = String(value ?? "");
    if (/[\";\n\r]/.test(s)) return "\"" + s.replace(/\"/g, "\"\"") + "\"";
    return s;
  }

  function getTableColumns(){
    if (axisId === "sante"){
      if (Array.isArray(currentTableColumns) && currentTableColumns.length){
        return currentTableColumns.map((col) => ({
          key: col.key,
          label: col.label,
          type: col.type
        }));
      }
    }
    if (!dataTableEl) return [];
    const cols = [];
    const ths = dataTableEl.querySelectorAll("thead th[data-field]");
    ths.forEach((th) => {
      cols.push({ key: th.getAttribute("data-field"), label: th.textContent.trim() });
    });
    return cols;
  }

  function exportCsv(){
    const cols = getTableColumns();
    if (!cols.length) return;
    const lines = [];
    lines.push(cols.map(c => csvEscape(c.label)).join(";"));
    currentTableRows.forEach((row) => {
      const line = cols.map((c) => {
        const key = c.key;
        const value = (key === "commune") ? (row.name || row.commune) : row[key];
        if (axisId === "sante"){
          return csvEscape(formatSanteTableValue(c, value));
        }
        return csvEscape(formatTableCell(key, value));
      });
      lines.push(line.join(";"));
    });
    const csv = "\ufeff" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donnees.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  function rebuildDashboard(){
    if (!geojsonData) return;
    dashboardFieldKeys = resolveFieldKeys(geojsonData);
    let sampleProps = axisSampleProps;
    if (!sampleProps && Array.isArray(geojsonData.features)){
      for (const f of geojsonData.features){
        if (f && f.properties){
          sampleProps = f.properties;
          break;
        }
      }
    }
    logResolvedFields(dashboardFieldKeys, sampleProps);
    TABLE_KEYS.forEach((k) => {
      if (k === "commune"){
        if (!dashboardFieldKeys.commune) warnMissingField("commune");
        return;
      }
      if (!dashboardFieldKeys[k]) warnMissingField(k);
    });

    const filtered = getFilteredFeatures(geojsonData);
    dashboardContext = buildMetricContext(geojsonData, dashboardFieldKeys);
    dashboardRows = buildDashboardRows(filtered, dashboardFieldKeys, dashboardContext);
    const issues = [];
    const featureCount = Array.isArray(geojsonData.features) ? geojsonData.features.length : 0;
    if (featureCount === 0) issues.push("features=0");
    const missingKpis = KPI_KEYS.filter((k) => {
      if (axisId === "sante" && k === "couverture_etab") return false;
      return !dashboardFieldKeys[k];
    });
    if (missingKpis.length) issues.push("kpi_fields_missing=" + missingKpis.join(","));
    const extraLineKeys = ["activite","scolarisation","vulnerabilite"];
    const unresolvedLines = extraLineKeys.filter((k) => !dashboardFieldKeys[k]);
    if (axisId !== "sante" && unresolvedLines.length && !warnedFields.has("kpi_unresolved")){
      const details = unresolvedLines.map((k) => k + ": [" + (FIELD_MAP[k] || []).join(", ") + "]");
      console.warn("[Dashboard] KPI unresolved: " + details.join(" | "));
      warnedFields.add("kpi_unresolved");
    }
    const anyNumeric = Array.isArray(geojsonData.features) && geojsonData.features.some((f) => {
      const p = f && f.properties ? f.properties : {};
      return NUMERIC_KEYS.some((k) => {
        const key = dashboardFieldKeys[k];
        if (!key) return false;
        const val = parseNumberSmart(p[key], k !== "population");
        return Number.isFinite(val);
      });
    });
    if (!anyNumeric) issues.push("all_numeric_nan");
    logDataEmpty(issues);
    logJoinDiagnostics(dashboardRows);
    if (dataSearchEl) tableFilterText = dataSearchEl.value || "";
    renderTable(dashboardRows);
    requestSanteChartsRefresh();
  }

  function toggleCommuneSelection(name){
    if (DISABLE_COMPARE_COMMUNES) return;
    if (!name) return;
    userTouchedSelection = true;
    const idx = selectedCommuneQueue.indexOf(name);
    if (idx !== -1){
      selectedCommuneQueue.splice(idx, 1);
    } else {
      if (selectedCommuneQueue.length >= 3) selectedCommuneQueue.shift();
      selectedCommuneQueue.push(name);
    }
    if (dashboardContext) renderRadar(dashboardRows, dashboardContext);
    else rebuildDashboard();
    if (axisId === "sante") requestSanteChartsRefresh();
  }

  // Legend
  const legendTitleEl = document.getElementById("legendTitle");
  const legendMetaEl  = document.getElementById("legendMeta");
  const legendItemsEl = document.getElementById("legendItems");
  const kpiPopulationEl = document.getElementById("kpiPopulation");
  const kpiPauvreteEl = document.getElementById("kpiPauvrete");
  const kpiChomageEl = document.getElementById("kpiChomage");
  const radarCanvas = document.getElementById("radarChart");
  const dataTableEl = document.getElementById("dataTable");
  const dataTbodyEl = document.getElementById("dataTbody");
  const dataSearchEl = document.getElementById("tableSearch");
  const exportBtn = document.getElementById("exportBtn");
  const podiumTabsEl = document.getElementById("podiumTabs");
  const podiumChartCanvas = document.getElementById("podiumChart");
  const podiumTitleEl = document.querySelector("#podiumCard .podium-title");
  const communePopEl = document.getElementById("communePop");
  const communePopNameEl = document.getElementById("communePopName");
  const communePopBodyEl = document.getElementById("communePopBody");
  const communePopCloseEl = document.getElementById("communePopClose");
  const communeSidebarEl = document.getElementById("communeSidebar");
  const globalStatsDockEl = document.getElementById("globalStatsDock");
  const statsCardEl = document.getElementById("statsCard");
  const csCommuneNameEl = document.getElementById("csCommuneName");
  const communeSearchEl = document.querySelector("#communeSidebar #csSearch");
  const communeListEl = document.getElementById("csCommuneList");
  const csGridEl = document.getElementById("csGrid");
  // Mini-chart (communes colorees par classe) — Chart.js
  const chartCanvas = document.getElementById("legendChart");
  const chartTitleEl = document.querySelector("#communeChartCard .legend-chart-title");
  const chartModeBtn = document.getElementById("chartModeBtn");
  const chartMode = "COMMUNES_BARS_COLORED_BY_CLASS";
  let legendChart = null;
  let podiumChart = null;
  let activePodiumIndex = 0;
  let rhSanteChart = null;
  const linesCanvas = document.getElementById("communeLinesChart");
  const linesControlsEl = document.getElementById("linesControls");
  const linesTitleEl = document.querySelector("#linesPanel .lines-title");
  let linesChart = null;
  let btnExpandChart = null;
  let btnExportPng = null;

  function initExpandChartButton(){
    if (btnExpandChart) return;
    btnExpandChart = document.getElementById("btnExpandChart");
    if (btnExpandChart){
      btnExpandChart.addEventListener("click", toggleLinesFocus);
      updateExpandChartButtonText();
    }
    btnExportPng = document.getElementById("btnExportPng");
    if (btnExportPng){
      btnExportPng.addEventListener("click", exportChartPng);
    }
  }

  function updateExpandChartButtonText(){
    if (!btnExpandChart) return;
    const isFocused = document.body.classList.contains("lines-focus");
    btnExpandChart.textContent = isFocused ? "⤡" : "⤢";
    btnExpandChart.title = isFocused ? "Réduire le graphe" : "Agrandir le graphe";
  }

  function downloadChartJpeg(chart, filenameBase = "comparaison_indicateurs_sante", quality = 0.95){
    if (!chart || !chart.canvas) return;
    try {
      const isFocus = document.body.classList.contains("lines-focus");
      const filename = `${filenameBase}${isFocus ? "_focus" : ""}.jpg`;

      const sourceCanvas = chart.canvas;

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = sourceCanvas.width;
      exportCanvas.height = sourceCanvas.height;

      const ctx = exportCanvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      ctx.drawImage(sourceCanvas, 0, 0);

      const jpegUrl = exportCanvas.toDataURL("image/jpeg", quality);

      const a = document.createElement("a");
      a.href = jpegUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err){
      console.warn("Erreur export JPEG:", err);
    }
  }

  function exportChartPng(){
    if (!linesChart) return;
    downloadChartJpeg(linesChart);
  }


  function destroyLegendChart(){
    if (legendChart){
      legendChart.destroy();
      legendChart = null;
    }
  }

  function buildCommuneChartData(){
    const items = [];
    if (!geojsonData || !selectedField || !breaks.length) return { items, labels: [], data: [], colors: [] };

    geojsonData.features.forEach((f, idx) => {
      const p = f.properties || {};
      const v = getIndicatorValue(p, selectedField);
      if (!isNumber(v)) return;
      const classIdx = getClassIndex(v, breaks);
      if (classIdx === null) return;

      if (isolatedClassIndex !== null && classIdx !== isolatedClassIndex) return;
      if (isolatedClassIndex === null && activeClassIndex !== null && classIdx !== activeClassIndex) return;

      const name = getFeatureName(f, idx);
      const fallback = (axisId === "sante") ? getSanteTheme().border : "#d1d5db";
      const color = classRanges[classIdx] ? classRanges[classIdx].color : fallback;
      const layer = mapNameToLayer.get(name) || null;
      items.push({ name, value: v, classIndex: classIdx, color, layer });
    });

    items.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name, "fr");
    });

    return {
      items,
      labels: items.map(i => i.name),
      data: items.map(i => i.value),
      colors: items.map(i => i.color)
    };
  }

  function buildSanteFieldClasses(fieldKey){
    if (!geojsonData) return { breaks: [], ranges: [] };
    const key = fieldKey || selectedField;
    if (!key) return { breaks: [], ranges: [] };
    if (key === selectedField && breaks.length && classRanges.length){
      return { breaks: breaks.slice(), ranges: classRanges.slice() };
    }
    const values = computeValues(geojsonData, key);
    if (!values.length) return { breaks: [], ranges: [] };
    const santeBreaks = quantileBreaks(values, DEFAULT_CLASS_COUNT);
    const classConfig = getSanteClassConfig(key);
    const ranges = buildClasses(santeBreaks, classConfig.palette, classConfig.labels);
    return { breaks: santeBreaks, ranges };
  }

  function getActiveClassFilter(){
    const active = (isolatedClassIndex !== null) ? isolatedClassIndex : activeClassIndex;
    state.activeClassFilter = (active === null || active === undefined) ? null : active;
    return state.activeClassFilter;
  }

  function getActiveClassMask(){
    const count = (Array.isArray(classRanges) && classRanges.length)
      ? classRanges.length
      : DEFAULT_CLASS_COUNT;
    if (!count) return null;
    const mask = {};
    for (let i = 0; i < count; i++) mask[i] = true;
    if (isolatedClassIndex !== null){
      for (let i = 0; i < count; i++) mask[i] = (i === isolatedClassIndex);
    } else if (activeClassIndex !== null){
      for (let i = 0; i < count; i++) mask[i] = (i === activeClassIndex);
    }
    return mask;
  }

  function isClassFilterActive(mask){
    if (!mask) return false;
    const values = Object.values(mask);
    if (!values.length) return false;
    return values.some(v => !v);
  }

  function passesClassFilter(row, mask){
    if (!mask) return true;
    if (!selectedField || !Array.isArray(breaks) || breaks.length < 2) return false;
    const props = row && row.feature && row.feature.properties
      ? row.feature.properties
      : (row && row.properties ? row.properties : null);
    if (!props) return false;
    const value = getIndicatorValue(props, selectedField);
    if (!isNumber(value)) return false;
    const idx = getClassIndex(value, breaks);
    if (idx === null || idx === undefined) return false;
    return !!mask[idx];
  }

  function buildSanteClassByCommune(){
    const classMap = new Map();
    if (!geojsonData || !Array.isArray(geojsonData.features) || !breaks.length) return classMap;
    geojsonData.features.forEach((f, idx) => {
      const p = f && f.properties ? f.properties : {};
      const v = getIndicatorValue(p, selectedField);
      const classIdx = getClassIndex(v, breaks);
      if (classIdx === null) return;
      const name = getFeatureName(f, idx);
      if (!name) return;
      classMap.set(normalizeCommuneName(name), classIdx);
    });
    return classMap;
  }

  function buildSanteRankingData(){
    const items = [];
    const allItems = [];
    if (!geojsonData || !Array.isArray(geojsonData.features)){
      return { items, labels: [], data: [], colors: [], totalItems: 0, filterActive: false };
    }
    const classData = buildSanteFieldClasses(selectedField);
    const breaksLocal = classData.breaks;
    const rangesLocal = classData.ranges;
    if (!breaksLocal.length || !rangesLocal.length){
      return { items, labels: [], data: [], colors: [], totalItems: 0, filterActive: false };
    }
    const classMap = (state && state.santeClassByCommune instanceof Map)
      ? state.santeClassByCommune
      : new Map();
    const filterIdx = getActiveClassFilter();

    geojsonData.features.forEach((f, idx) => {
      const p = f && f.properties ? f.properties : {};
      const v = getIndicatorValue(p, selectedField);
      if (!isNumber(v)) return;
      const name = getFeatureName(f, idx);
      const normName = name ? normalizeCommuneName(name) : "";
      const classIdx = (normName && classMap.has(normName))
        ? classMap.get(normName)
        : getClassIndex(v, breaksLocal);
      const fallback = (axisId === "sante") ? getSanteTheme().border : "#d1d5db";
      const color = rangesLocal[classIdx] ? rangesLocal[classIdx].color : fallback;
      const layer = mapNameToLayer.get(name) || null;
      const item = {
        name,
        value: v,
        classIndex: classIdx,
        color,
        layer
      };
      allItems.push(item);
      if (filterIdx === null || classIdx === filterIdx){
        items.push(item);
      }
    });

    items.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.name.localeCompare(b.name, "fr");
    });

    return {
      items,
      labels: items.map(i => i.name),
      data: items.map(i => i.value),
      colors: items.map(i => i.color),
      totalItems: allItems.length,
      filterActive: filterIdx !== null
    };
  }

  function fieldNameToMetricKey(fieldName){
    if (!fieldName) return "";
    const target = String(fieldName).toLowerCase();
    const keys = Object.keys(FIELD_MAP);
    for (const k of keys){
      const candidates = FIELD_MAP[k] || [];
      for (const c of candidates){
        if (String(c).toLowerCase() === target) return k;
      }
    }
    return "";
  }

  function renderLegendChart(){
    if (!chartCanvas) return { ok:false, reason: "no_canvas" };
    if (!geojsonData || !Array.isArray(geojsonData.features)){
      destroyLegendChart();
      setChartMessage(chartCanvas, "Donn\u00e9e indisponible");
      return { ok:false, reason: "no_data" };
    }

    const chartData = buildSanteRankingData();
    const filterIdx = getActiveClassFilter();
    const classLabel = (filterIdx === null)
      ? "none"
      : (classRanges[filterIdx] ? classRanges[filterIdx].label : (CLASS_LABELS[filterIdx] || String(filterIdx)));
    const filterSig = [selectedField || "", classLabel, chartData.items.length].join("|");
    if (filterSig !== lastSanteClassFilterSig){
      lastSanteClassFilterSig = filterSig;
      console.info(
        "[SANTE_CLASS_FILTER] field=" + (selectedField || "") +
        " class=" + classLabel +
        " count=" + chartData.items.length
      );
    }
    if (!chartData.items.length){
      destroyLegendChart();
      if (chartData.filterActive && chartData.totalItems > 0){
        setChartMessage(chartCanvas, "Aucune commune dans cette classe");
        return { ok:false, reason: "class_empty" };
      }
      setChartMessage(chartCanvas, "Donn\u00e9e indisponible");
      return { ok:false, reason: "no_communes" };
    }
    if (!window.Chart){
      destroyLegendChart();
      setChartMessage(chartCanvas, "Donn\u00e9e indisponible");
      console.warn("Chart.js not loaded; chart disabled.");
      return { ok:false, reason: "no_chartjs" };
    }
    setChartMessage(chartCanvas, "");

    const labels = chartData.labels;
    const data = chartData.data;
    const colors = chartData.colors;
    const ctx = chartCanvas.getContext("2d");
    const theme = getThemePalette();
    const textSoft = colorWithAlpha(theme.textColor, 0.75);
    const hoverColors = colors.map((c) => darkenHexColor(c, 0.6));

    const santeLabel = getSelectedIndicatorLabel();
    const santeMeta = getSanteFieldMeta(selectedField);
    const isPercent = santeMeta && santeMeta.unit === "%";
    const isIndex = selectedField === "sante_index";
    if (chartTitleEl){
      chartTitleEl.textContent = "Classement des communes \u2014 " + (santeLabel || "Indicateur");
    }
    if (chartModeBtn){
      chartModeBtn.textContent = "Tri d\u00e9croissant";
      chartModeBtn.title = "Tri des communes par valeur";
      chartModeBtn.disabled = true;
    }

    destroyLegendChart();
    legendChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: santeLabel || "Indicateur",
          data,
          backgroundColor: colors,
          borderColor: colorWithAlpha(theme.textColor, 0.2),
          borderWidth: 1,
          hoverBackgroundColor: hoverColors,
          hoverBorderColor: colorWithAlpha(theme.textColor, 0.25),
          borderRadius: 6,
          barPercentage: 0.72,
          categoryPercentage: 0.9
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.cardBg,
            titleColor: theme.textColor,
            bodyColor: theme.textColor,
            borderColor: theme.accentColor,
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                const chart = items[0] && items[0].chart ? items[0].chart : null;
                const list = chart && chart._communeItems ? chart._communeItems : [];
                const item = list[items[0].dataIndex];
                return item ? item.name : "";
              },
              label: (ctx) => {
                const chart = ctx.chart;
                const list = chart && chart._communeItems ? chart._communeItems : [];
                const item = list[ctx.dataIndex];
                if (!item) return "";
                const label = santeLabel || "Indicateur";
                const valueText = formatSanteIndicatorValue(selectedField, item.value);
                return label + ": " + valueText;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            type: "linear",
            min: (isPercent || isIndex) ? 0 : undefined,
            max: (isPercent || isIndex) ? 100 : undefined,
            ticks: { font: { size: 10 }, color: textSoft }
          },
          y: {
            grid: { display:false },
            ticks: { font: { size: 11 }, autoSkip: false, padding: 6, color: textSoft }
          }
        },
        onClick: (evt) => {
          const pts = legendChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
          if (!pts.length) return;
          const idx = pts[0].index;
          const items = legendChart._communeItems || [];
          const item = items[idx];
          if (!item || !item.layer || !map) return;

          const layer = item.layer;
          const highlightStyle = { weight: 3.2, color: theme.textColor, fillOpacity: 0.8 };
          try{
            map.fitBounds(layer.getBounds(), { padding: [30, 30] });
            layer.setStyle(highlightStyle);
            layer.bringToFront();
            setTimeout(() => {
              if (geoLayer && layer) geoLayer.resetStyle(layer);
            }, 900);
          } catch(_){}
        }
      }
    });

    legendChart._communeItems = chartData.items;
    setTimeout(() => {
      if (legendChart) legendChart.resize();
    }, 0);
    return { ok:true };
  }

  function formatPodiumPercent(value){
    if (!isNumber(value)) return MISSING;
    return (Math.round(value * 10) / 10).toFixed(1).replace(".", ",") + "%";
  }

  function destroyPodiumChart(){
    if (podiumChart){
      try{ podiumChart.destroy(); } catch(_){ }
      podiumChart = null;
    }
  }

  function clampPercent(value){
    if (!isNumber(value)) return null;
    return Math.max(0, Math.min(100, value));
  }

  function computePopNorm(value, minVal, maxVal){
    if (!isNumber(value) || !isNumber(minVal) || !isNumber(maxVal)) return null;
    if (maxVal == minVal) return 50;
    return ((value - minVal) / (maxVal - minVal)) * 100;
  }

  // Normalize KPI values into 0-100 segments.
  function buildRadialSegments(item, popMin, popMax){
    if (!item) return [];
    const scoreRaw = isNumber(item.score) ? item.score : null;
    const servicesRaw = isNumber(item.services) ? item.services : null;
    const pauvreteRaw = isNumber(item.pauvrete) ? item.pauvrete : null;
    const popRaw = isNumber(item.population) ? item.population : null;

    const score = clampPercent(scoreRaw);
    const services = clampPercent(servicesRaw);
    const pauvreteNorm = isNumber(pauvreteRaw) ? clampPercent(100 - pauvreteRaw) : null;
    const popNorm = clampPercent(computePopNorm(popRaw, popMin, popMax));

    return [
      { key: "score", label: "Score composite", value: score, valueText: formatPodiumPercent(scoreRaw), color: "#0ea5e9", position: "top" },
      { key: "services", label: "Services", value: services, valueText: formatPodiumPercent(servicesRaw), color: "#22c55e", position: "right" },
      { key: "pauvrete", label: "Pauvrete", value: pauvreteNorm, valueText: formatPodiumPercent(pauvreteRaw), color: "#f97316", position: "bottom" },
      { key: "population", label: "Population", value: popNorm, valueText: isNumber(popRaw) ? formatInt(popRaw) : MISSING, color: "#94a3b8", position: "left" }
    ];
  }

  function drawRadialArc(ctx, cx, cy, r, startDeg, endDeg, color, width){
    const start = (Math.PI / 180) * startDeg;
    const end = (Math.PI / 180) * endDeg;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end, false);
    ctx.stroke();
  }

  function drawCenterIcon(ctx, x, y, size){
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.8, -size * 0.2, 0, size);
    ctx.quadraticCurveTo(-size * 0.8, -size * 0.2, 0, -size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.arc(0, -size * 0.25, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight){
    if (!text) return;
    const words = String(text).split(" ");
    let line = "";
    const lines = [];
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line){
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((ln, idx) => {
      ctx.fillText(ln, x, y + idx * lineHeight);
    });
  }

  function drawRadialLabel(ctx, x, y, align, valueText, labelText){
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#111827";
    ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    ctx.fillText(valueText || MISSING, x, y);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#6b7280";
    ctx.font = "600 10px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    ctx.fillText(labelText || "", x, y + 2);
    ctx.restore();
  }

  // Custom draw for segmented ring, center, and labels.
  const radialKpiPlugin = {
    id: "radialKpi",
    afterDraw: (chart, _args, opts) => {
      if (!opts || !opts.segments || !opts.segments.length) return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      const width = chartArea.right - chartArea.left;
      const height = chartArea.bottom - chartArea.top;
      const size = Math.min(width, height);
      const ringWidth = Math.max(10, size * 0.12);
      const labelPad = isNumber(opts.labelPad) ? opts.labelPad : 26;
      const outerR = Math.max(ringWidth + 8, size / 2 - labelPad - ringWidth / 2);
      const innerR = outerR - ringWidth;
      const gapDeg = isNumber(opts.gapDeg) ? opts.gapDeg : 10;
      const segments = opts.segments;
      const span = (360 - gapDeg * segments.length) / segments.length;
      const inactive = opts.inactiveColor || "rgba(0,0,0,.12)";

      ctx.save();
      ctx.lineCap = "round";

      segments.forEach((seg, idx) => {
        const startDeg = -90 + idx * (span + gapDeg) + gapDeg / 2;
        const endDeg = startDeg + span;
        drawRadialArc(ctx, centerX, centerY, outerR, startDeg, endDeg, inactive, ringWidth);

        const value = isNumber(seg.value) ? Math.max(0, Math.min(100, seg.value)) : null;
        if (isNumber(value) && value > 0){
          const activeEnd = startDeg + (span * value / 100);
          drawRadialArc(ctx, centerX, centerY, outerR, startDeg, activeEnd, seg.color || "#111827", ringWidth);
        }
      });

      const centerFill = opts.centerColor;
      if (centerFill && centerFill !== "transparent" && centerFill !== "none"){
        ctx.fillStyle = centerFill;
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, innerR - 6), 0, Math.PI * 2);
        ctx.fill();
      }

      drawCenterIcon(ctx, centerX, centerY - 6, Math.max(8, innerR * 0.28));

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#111827";
      ctx.font = "700 11px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      drawWrappedText(ctx, opts.centerLabel || "", centerX, centerY + innerR * 0.1, innerR * 1.6, 12);

      const labelRadius = outerR + ringWidth * 0.8;
      const labelOffsetTop = isNumber(opts.labelOffsetTop)
        ? opts.labelOffsetTop
        : Math.max(8, Math.round(ringWidth * 0.6));
      const labelOffsetBottom = isNumber(opts.labelOffsetBottom)
        ? opts.labelOffsetBottom
        : Math.max(8, Math.round(ringWidth * 0.6));
      segments.forEach((seg) => {
        const pos = seg.position || "top";
        let x = centerX;
        let y = centerY;
        let align = "center";
        if (pos === "top"){
          x = centerX;
          y = centerY - labelRadius - labelOffsetTop;
          align = "center";
        } else if (pos === "right"){
          x = centerX + labelRadius;
          y = centerY - 4;
          align = "left";
        } else if (pos === "bottom"){
          x = centerX;
          y = centerY + labelRadius + labelOffsetBottom;
          align = "center";
        } else if (pos === "left"){
          x = centerX - labelRadius;
          y = centerY - 4;
          align = "right";
        }
        drawRadialLabel(ctx, x, y, align, seg.valueText || MISSING, seg.label || "");
      });

      ctx.restore();
    }
  };

  const arcPercentLabelsPlugin = {
    id: "arcPercentLabels",
    afterDatasetsDraw: (chart, _args, pluginOptions) => {
      if (!chart || !chart.getDatasetMeta) return;
      const dataset = chart.data && chart.data.datasets ? chart.data.datasets[0] : null;
      if (!dataset || !Array.isArray(dataset.data)) return;
      const theme = (axisId === "sante") ? getSanteTheme() : null;
      const ink = theme && theme.ink ? theme.ink : "#0F172A";
      const meta = chart.getDatasetMeta(0);
      const arcs = meta && meta.data ? meta.data : [];
      if (!arcs.length) return;
      const total = dataset.data.reduce((sum, v) => sum + (isNumber(v) ? v : 0), 0);
      if (!total) return;
      const minPct = (pluginOptions && isNumber(pluginOptions.minPct)) ? pluginOptions.minPct : 4;
      const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : [];
      const pickLabelColor = (bg) => {
        if (typeof bg !== "string" || bg[0] !== "#" || (bg.length !== 7 && bg.length !== 4)){
          return ink;
        }
        const hex = bg.length === 4
          ? ("#" + bg[1] + bg[1] + bg[2] + bg[2] + bg[3] + bg[3])
          : bg;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const luminance = (r * 299 + g * 587 + b * 114) / 1000;
        return luminance < 140 ? "#ffffff" : ink;
      };
      const ctx = chart.ctx;
      arcs.forEach((arc, idx) => {
        const value = dataset.data[idx];
        if (!isNumber(value) || value <= 0) return;
        const pct = (value / total) * 100;
        if (pct < minPct) return;
        const pos = arc && arc.tooltipPosition ? arc.tooltipPosition() : null;
        if (!pos) return;
        ctx.save();
        ctx.font = "600 11px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
        ctx.fillStyle = pickLabelColor(colors[idx]);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(Math.round(pct) + "%", pos.x, pos.y);
        ctx.restore();
      });
    }
  };

  function renderPodiumTabs(items){
    if (!podiumTabsEl) return;
    podiumTabsEl.innerHTML = "";
    items.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "podium-tab" + (idx == activePodiumIndex ? " active" : "");
      btn.textContent = item.name;
      btn.addEventListener("click", () => {
        if (activePodiumIndex === idx) return;
        activePodiumIndex = idx;
        renderPodiumCard();
      });
      podiumTabsEl.appendChild(btn);
    });
  }

  function ensureSanteBatKpiEl(){
    if (!podiumChartCanvas) return null;
    const parent = podiumChartCanvas.parentElement;
    if (!parent) return null;
    let el = parent.querySelector("#santeBatKpi");
    const theme = (axisId === "sante") ? getSanteTheme() : null;
    const ink = theme && theme.ink ? theme.ink : "#0f172a";
    if (!el){
      el = document.createElement("div");
      el.id = "santeBatKpi";
      el.style.cssText = "display:flex; flex-direction:column; gap:4px; margin-top:8px; font-size:12px; color:" + ink + ";";
      parent.appendChild(el);
    } else {
      el.style.color = ink;
    }
    return el;
  }

  function ensureSanteBatDetailEl(){
    if (!podiumChartCanvas) return null;
    const parent = podiumChartCanvas.parentElement;
    if (!parent) return null;
    let el = parent.querySelector("#santeBatDetail");
    const theme = (axisId === "sante") ? getSanteTheme() : null;
    const ink = theme && theme.ink ? theme.ink : "#0f172a";
    const border = theme && theme.border ? theme.border : "#e2e8f0";
    if (!el){
      el = document.createElement("div");
      el.id = "santeBatDetail";
      el.style.cssText = "margin-top:8px; padding:8px 10px; border:1px solid " + border + "; border-radius:10px; background:#f8fafc; font-size:12px; color:" + ink + "; display:none;";
      parent.appendChild(el);
    } else {
      el.style.color = ink;
      el.style.borderColor = border;
    }
    return el;
  }

  function renderPodiumCard(){
    if (!podiumChartCanvas) return { ok:false, reason: "no_canvas" };
    const santeTheme = (axisId === "sante") ? getSanteTheme() : null;
    if (!window.Chart){
      destroyRHSanteChart();
      setChartMessage(podiumChartCanvas, "Donn\u00e9e indisponible");
      console.warn("Chart.js not loaded; RH Santé disabled.");
      return { ok:false, reason: "no_chartjs" };
    }
    // Pour la province, utiliser COMMUNES.geojson, sinon utiliser ETAB_SANTE.geojson
    const selectedKeys = (selectedCommuneQueue || [])
      .map(normalizeCommuneKey)
      .filter(Boolean);
    let totals = {};
    let subtitle = "";
    
    if (selectedKeys.length){
      // Pour une commune spécifique, utiliser ETAB_SANTE.geojson
      const stats = santeEtabStats || {};
      const features = Array.isArray(stats.features) ? stats.features : [];
      if (!features.length){
        destroyRHSanteChart();
        setChartMessage(podiumChartCanvas, "Donn\u00e9e indisponible");
        return { ok:false, reason: "no_etab_data" };
      }
      const selectedName = selectedCommuneQueue[0];
      totals = computeRHTotals({ features, communeName: selectedName, useCommunesData: false });
      subtitle = selectedName || "Commune sélectionnée";
    } else {
      // Pour la province ou communes filtrées, utiliser COMMUNES.geojson
      const features = Array.isArray(geojsonData && geojsonData.features) ? geojsonData.features : [];
      if (!features.length){
        destroyRHSanteChart();
        setChartMessage(podiumChartCanvas, "Donn\u00e9e indisponible");
        return { ok:false, reason: "no_communes_data" };
      }
      const filterIdx = getActiveClassFilter();
      if (filterIdx !== null){
        const allowedCommunes = getFilteredCommunesByClass();
        totals = computeRHTotals({ features, allowedCommunes, useCommunesData: true });
        subtitle = "Communes filtrées";
      } else {
        totals = computeRHTotals({ features, useCommunesData: true });
        subtitle = "Province";
      }
    }
    setChartMessage(podiumChartCanvas, "");
    if (!rhSanteChart){
      initRHSanteChart();
    }
    updateRHSanteChart(totals, subtitle);
    return { ok:true };
  }

  function formatChartStatus(status){
    if (!status) return "skip(unknown)";
    if (status.ok) return "ok";
    return "skip(" + (status.reason || "unknown") + ")";
  }

  function requestSanteChartsRefresh(){
    if (santeReadyCommunes && santeReadyEtab){
      santeChartsPending = false;
      scheduleSanteRefresh();
    } else {
      santeChartsPending = true;
      // Même si les données ne sont pas toutes prêtes, on peut charger le graphique RH pour la province
      // car il utilise geojsonData (COMMUNES.geojson) qui devrait être disponible
      if (santeReadyCommunes && geojsonData && Array.isArray(geojsonData.features) && geojsonData.features.length > 0){
        // Appeler renderPodiumCard directement pour la province
        renderPodiumCard();
      }
      scheduleSanteRefresh();
    }
  }

  function refreshSanteCharts(){
    const communesCount = geojsonData && Array.isArray(geojsonData.features) ? geojsonData.features.length : 0;
    const stats = santeEtabStats || {};
    const counts = stats.counts || {};
    const bat = stats.countsBatimentEtat || {};
    const amb = stats.countsAmbulance || {};
    const etabTotal = isNumber(stats.total) ? stats.total : 0;
    const crossKey = stats.communeKeyFieldFound ? 1 : 0;
    const crossSize = stats.byCommuneType && stats.byCommuneType.size ? stats.byCommuneType.size : 0;
    const typesSig = [
      counts.hopital || 0,
      counts.cs_urbain || 0,
      counts.cs_rural || 0,
      counts.dispensaire || 0,
      counts.autre || 0
    ].join(",");
    const batSig = [
      bat.bon || 0,
      bat.moyen || 0,
      bat.mauvais || 0,
      bat.nc || 0
    ].join(",");
    const ambSig = [
      amb.oui || 0,
      amb.non || 0,
      amb.nc || 0
    ].join(",");
    const selectionSig = (selectedCommuneQueue || [])
      .map(normalizeCommuneKey)
      .filter(Boolean)
      .join(",");
    const classMode = (isolatedClassIndex !== null && isolatedClassIndex !== undefined)
      ? ("i:" + isolatedClassIndex)
      : (activeClassIndex !== null && activeClassIndex !== undefined)
        ? ("a:" + activeClassIndex)
        : "none";
    let togglesSig = "";
    if (axisId === "sante"){
      const toggles = getLinesToggleState();
      if (toggles && toggles.size){
        togglesSig = Array.from(toggles.entries())
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
          .map(([k, v]) => k + ":" + (v ? 1 : 0))
          .join(",");
      }
    }
    const sigCharts = [
      communesCount, etabTotal, typesSig, batSig, ambSig, crossKey, crossSize, selectionSig,
      "field=" + (selectedField || ""),
      "class=" + classMode,
      "toggles=" + togglesSig
    ].join("|");
    if (sigCharts === lastSanteChartsSig) return;
    lastSanteChartsSig = sigCharts;
    console.info("[SANTE_CHARTS_SIG] field=" + (selectedField || "") + " class=" + classMode);

    const statusA = renderLegendChart();
    const statusB = renderRadar(dashboardRows, dashboardContext);
    const statusC = renderCommuneLines(dashboardRows);
    const statusD = renderPodiumCard();
    console.info(
      "[SANTE_CHARTS] A=" + formatChartStatus(statusA) +
      " B=" + formatChartStatus(statusB) +
      " C=" + formatChartStatus(statusC) +
      " D=" + formatChartStatus(statusD)
    );
  }

  function destroyLinesChart(){
    if (linesChart){
      linesChart.destroy();
      linesChart = null;
      if (window.linesChart){
        window.linesChart = null;
      }
      if (linesCanvas && linesCanvas.chart){
        linesCanvas.chart = null;
      }
    }
  }

  function getLinesToggleState(){
    const states = new Map();
    if (!linesControlsEl) return states;
    const inputs = linesControlsEl.querySelectorAll("input[type=\"checkbox\"][data-key]");
    inputs.forEach((input) => {
      const key = input.getAttribute("data-key");
      if (!key) return;
      states.set(key, !!input.checked);
    });
    return states;
  }

  function renderLinesLegend(state, catalogueKeys, availableDatasetKeys){
    if (!linesControlsEl) return;
    const active = state || new Map();
    const available = availableDatasetKeys && availableDatasetKeys.size ? availableDatasetKeys : null;
    const catalogue = catalogueKeys && catalogueKeys.size ? catalogueKeys : null;
    const lineGroups = (axisId === "sante") ? SANTE_LINE_GROUPS : LINE_GROUPS;
    const lineStyle = (axisId === "sante") ? SANTE_LINE_STYLE : KPI_STYLE;
    const lineColors = (axisId === "sante") ? getSanteLineColors() : INDICATOR_COLORS;
    linesControlsEl.innerHTML = "";
    let indicWrap = linesControlsEl;
    let etabWrap = null;
    if (axisId === "sante"){
      const buildGroup = (title) => {
        const group = document.createElement("div");
        group.className = "legend-group";
        group.style.flex = "1 0 100%";
        const heading = document.createElement("div");
        heading.className = "legend-title";
        heading.textContent = title;
        const wrap = document.createElement("div");
        wrap.className = "indicator-toggles";
        group.appendChild(heading);
        group.appendChild(wrap);
        linesControlsEl.appendChild(group);
        return wrap;
      };
      indicWrap = buildGroup("Indicat");
      etabWrap = buildGroup("\u00c9tab");
    }
    lineGroups.forEach((group) => {
      group.keys.forEach((key) => {
        if (!lineStyle[key]) return;
        if (available && !available.has(key)) return;
        const label = document.createElement("label");
        label.className = "line-toggle";
        const checked = active.size ? !!active.get(key) : true;
        const color = lineColors[key] || (lineStyle[key] ? lineStyle[key].color : "#e5e7eb");
        label.innerHTML =
          "<input type=\"checkbox\" data-key=\"" + key + "\" " + (checked ? "checked" : "") + ">" +
          "<span class=\"swatch\" data-key=\"" + key + "\" style=\"background-color:" + color + "; border-color:" + color + ";\"></span>" +
          "<span class=\"txt\">" + escapeHtml(lineStyle[key].label || key) + "</span>";
        if (!checked) label.classList.add("is-off");
        indicWrap.appendChild(label);
      });
    });
    if (axisId === "sante"){
      const etabColors = SANTE_ETAB_TICK_COLORS;
      const etabBorders = SANTE_ETAB_BAR_BORDERS;
      const etabDefs = [
        { key: "etab_hopital", label: "H\u00f4pital", type: "hopital" },
        { key: "etab_cs_urbain", label: "CS urbain", type: "cs_urbain" },
        { key: "etab_cs_rural", label: "CS rural", type: "cs_rural" },
        { key: "etab_dispensaire", label: "Dispensaire", type: "dispensaire" },
        { key: "etab_sres", label: "SRES", type: "sres" }
      ];
      etabDefs.forEach((def) => {
        const isInCatalogue = catalogue ? catalogue.has(def.key) : true;
        if (!isInCatalogue) return;
        const isAvailable = available ? available.has(def.key) : true;
        const label = document.createElement("label");
        label.className = "line-toggle";
        const checked = active.size ? !!active.get(def.key) : true;
        const bg = etabColors[def.type] || "#94A3B8";
        const border = etabBorders[def.type] || "#94A3B8";
        const opacity = isAvailable ? "1" : "0.4";
        const disabledAttr = isAvailable ? "" : "disabled";
        label.innerHTML =
          "<input type=\"checkbox\" data-key=\"" + def.key + "\" " + (checked ? "checked" : "") + " " + disabledAttr + ">" +
          "<span class=\"swatch\" data-key=\"" + def.key + "\" style=\"background-color:" + bg + "; border-color:" + border + "; opacity:" + opacity + ";\"></span>" +
          "<span class=\"txt\" style=\"opacity:" + opacity + ";\">" + escapeHtml(def.label) + "</span>";
        if (!checked) label.classList.add("is-off");
        if (!isAvailable) label.classList.add("is-disabled");
        (etabWrap || linesControlsEl).appendChild(label);
      });
      const ambBtn = document.createElement("button");
      ambBtn.type = "button";
      ambBtn.id = "btnToggleAmbulance";
      ambBtn.className = "line-toggle line-toggle-amb" + (showAmbulanceIcons ? "" : " is-off");
      ambBtn.title = "Afficher/masquer les ambulances";
      ambBtn.setAttribute("aria-pressed", showAmbulanceIcons ? "true" : "false");
      ambBtn.innerHTML = "<span class=\"txt\">Ambulances</span>";
      ambBtn.addEventListener("click", () => setAmbulanceVisible(!showAmbulanceIcons));
      btnToggleAmbulance = ambBtn;
      (etabWrap || linesControlsEl).appendChild(ambBtn);
      const etabBtn = document.createElement("button");
      etabBtn.type = "button";
      etabBtn.id = "btnToggleEtablissements";
      etabBtn.className = "line-toggle line-toggle-etab" + (showEtablissements ? "" : " is-off");
      etabBtn.title = "Afficher/masquer les établissements de santé";
      etabBtn.setAttribute("aria-pressed", showEtablissements ? "true" : "false");
      etabBtn.innerHTML = "<span class=\"txt\">Établissements de santé</span>";
      etabBtn.addEventListener("click", () => setEtablissementsVisible(!showEtablissements));
      btnToggleEtablissements = etabBtn;
      (etabWrap || linesControlsEl).appendChild(etabBtn);
      const popKey = "population_2024";
      if (available && available.has(popKey)){
        const label = document.createElement("label");
        label.className = "line-toggle";
        const checked = active.size ? !!active.get(popKey) : true;
        const theme = getSanteTheme();
        const color = (theme && theme.indicators && theme.indicators.population) ? theme.indicators.population : "#94A3B8";
        label.innerHTML =
          "<input type=\"checkbox\" data-key=\"" + popKey + "\" " + (checked ? "checked" : "") + ">" +
          "<span class=\"swatch\" data-key=\"" + popKey + "\" style=\"background-color:" + color + "; border-color:" + color + ";\"></span>" +
          "<span class=\"txt\">Population 2024</span>";
        if (!checked) label.classList.add("is-off");
        indicWrap.appendChild(label);
      }
    }
    syncLineToggleStyles();
  }

  function setupLinesControls(){
    if (!linesControlsEl) return;
    const etabCatalogueKeys = axisId === "sante" ? new Set(["etab_hopital", "etab_cs_urbain", "etab_cs_rural", "etab_dispensaire", "etab_sres"]) : null;
    renderLinesLegend(getLinesToggleState(), etabCatalogueKeys, null);
    linesControlsEl.addEventListener("change", (event) => {
      const input = event.target.closest("input[data-key]");
      if (!input || !linesChart) return;
      const active = getLinesToggleState();
      linesChart.data.datasets.forEach((ds) => {
        if (!ds._key) return;
        if (!active.size || !active.has(ds._key)){
          ds.hidden = false;
          return;
        }
        ds.hidden = !active.get(ds._key);
      });
      linesChart.update("none");
      syncLineSwatches();
      syncLineToggleStyles();
    });
  }

  function hideSanteFamilyTabs(){
    if (axisId !== "sante") return;
    const selectors = [".family-chips", "#familiesTabs", ".families-tabs", ".kpi-tabs", ".tabs-familles"];
    let hidden = false;
    selectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.style.display = "none";
      hidden = true;
    });
    if (!hidden){
      const chips = document.querySelectorAll(".family-chip");
      if (chips.length){
        chips.forEach((el) => { el.style.display = "none"; });
        hidden = true;
      }
    }
    const sig = hidden ? "hidden" : "skipped";
    if (sig !== lastSanteFamilyTabsSig){
      lastSanteFamilyTabsSig = sig;
      console.info("[SANTE_UI] familyTabs hidden=" + (hidden ? "true" : "skipped"));
    }
  }

  function hideCompareCommunesWidget(){
    if (axisId !== "sante") return;
    let hidden = false;
    const titleNodes = document.querySelectorAll(".card-title, .panel-title, h2, h3, h4, .title");
    titleNodes.forEach((node) => {
      if (hidden) return;
      const text = (node.textContent || "").trim();
      if (!text || !text.toLowerCase().includes("comparaison des communes")) return;
      const card = node.closest(".card") || node.closest(".panel") || node.parentElement;
      if (card){
        card.style.display = "none";
        hidden = true;
      }
    });
    if (!hidden){
      const candidates = document.querySelectorAll(".card, .panel, section, div");
      for (const el of candidates){
        const text = (el.textContent || "");
        if (text && text.toLowerCase().includes("comparaison des communes")){
          el.style.display = "none";
          hidden = true;
          break;
        }
      }
    }
    if (hidden){
      console.info("[UI] compareCommunes disabled");
    }
  }

  function syncLineSwatches(){
    if (!linesControlsEl || !linesChart) return;
    const swatches = linesControlsEl.querySelectorAll(".swatch[data-key]");
    swatches.forEach((swatch) => {
      const key = swatch.getAttribute("data-key");
      if (!key) return;
      const ds = linesChart.data.datasets.find(d => d._key === key);
      if (!ds) return;
      swatch.style.backgroundColor = ds.borderColor || "#e5e7eb";
      swatch.style.borderColor = ds.borderColor || "#e5e7eb";
    });
  }

  function syncLineToggleStyles(){
    if (!linesControlsEl) return;
    const toggles = linesControlsEl.querySelectorAll(".line-toggle");
    toggles.forEach((label) => {
      const input = label.querySelector("input[data-key]");
      if (!input) return;
      label.classList.toggle("is-off", !input.checked);
    });
  }

  function computeLineMinMax(rows, key){
    const values = rows.map(r => r[key]).filter(isNumber);
    if (!values.length) return null;
    let min = values[0];
    let max = values[0];
    values.forEach((v) => {
      if (v < min) min = v;
      if (v > max) max = v;
    });
    return { min, max };
  }

  function normalizeLineValue(value, range){
    if (!isNumber(value)) return null;
    if (!range) return null;
    if (range.max === range.min) return 50;
    const n = ((value - range.min) / (range.max - range.min)) * 100;
    if (n > 100) return 100;
    if (n < 0) return 0;
    return n;
  }

  function formatLineRaw(key, value){
    if (!isNumber(value)) return MISSING;
    if (axisId === "sante"){
      if (key === "population_2024") return formatInt(value);
      return formatPercent(value);
    }
    if (key === "population_normalisee") return formatInt(value);
    return formatPercent(value);
  }

  const communeMarkerPlugin = {
    id: "communeMarker",
    afterDatasetsDraw: (chart) => {
      const labels = chart.data && chart.data.labels ? chart.data.labels : [];
      if (!labels.length) return;
      if (!selectedProfileName) return;
      const target = normalizeCommuneName(selectedProfileName);
      const idx = labels.findIndex(l => normalizeCommuneName(l) === target);
      if (idx < 0) return;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!xScale || !yScale) return;
      const x = xScale.getPixelForValue(idx);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = colorWithAlpha(getThemePalette().textColor, 0.55);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, yScale.top);
      ctx.lineTo(x, yScale.bottom);
      ctx.stroke();
      ctx.restore();
    }
  };

  const AMBULANCE_ICON_PATHS = ["assets/icons/ambulance.png"];
  const ambulanceIconCache = { img: null, status: "idle", index: 0 };

  function ensureAmbulanceIcon(){
    if (ambulanceIconCache.status !== "idle") return ambulanceIconCache;
    const img = new Image();
    ambulanceIconCache.img = img;
    ambulanceIconCache.status = "loading";
    ambulanceIconCache.index = 0;
    img.onload = () => {
      ambulanceIconCache.status = "loaded";
      if (linesChart) linesChart.draw();
    };
    img.onerror = () => {
      if (ambulanceIconCache.index < AMBULANCE_ICON_PATHS.length - 1){
        ambulanceIconCache.index += 1;
        img.src = AMBULANCE_ICON_PATHS[ambulanceIconCache.index];
        return;
      }
      ambulanceIconCache.status = "error";
    };
    img.src = AMBULANCE_ICON_PATHS[0];
    return ambulanceIconCache;
  }

  const ambulanceStackPlugin = {
    id: "ambulanceStack",
    afterDatasetsDraw: (chart) => {
      if (!chart || axisId !== "sante") return;
      if (!showAmbulanceIcons) return;
      const datasets = chart.data && chart.data.datasets ? chart.data.datasets : [];
      const ambIndex = datasets.findIndex((ds) => ds && String(ds.label || "").toLowerCase().includes("ambulance"));
      if (ambIndex >= 0) {
        const meta = chart.getDatasetMeta(ambIndex);
        if (meta && meta.hidden) return;
        if (chart.isDatasetVisible && !chart.isDatasetVisible(ambIndex)) return;
      }
      const counts = chart._ambulanceCounts;
      if (!Array.isArray(counts) || !counts.length) return;
      const xScale = chart.scales && chart.scales.x ? chart.scales.x : null;
      const chartArea = chart.chartArea;
      if (!xScale || !chartArea) return;
      const iconState = ensureAmbulanceIcon();
      if (!iconState || iconState.status !== "loaded" || !iconState.img) return;

      const img = iconState.img;
      const ctx = chart.ctx;
      const labels = chart.data && chart.data.labels ? chart.data.labels : [];
      const iconW = 28;
      const iconH = 28;
      const baseY = chartArea.bottom - 6;

      ctx.save();
      labels.forEach((_label, idx) => {
        const count = isNumber(counts[idx]) ? counts[idx] : 0;
        if (!count) return;
        const x = xScale.getPixelForValue(idx);
        const y = baseY - iconH;
        ctx.drawImage(img, Math.round(x - iconW / 2), Math.round(y), iconW, iconH);
      });
      ctx.restore();
    }
  };

  const ambulanceLabelsPlugin = {
    id: "ambulanceLabels",
    afterDatasetsDraw: (chart) => {
      if (!chart || axisId !== "sante") return;
      if (!showAmbulanceIcons) return;
      const datasets = chart.data && chart.data.datasets ? chart.data.datasets : [];
      const ambIndex = datasets.findIndex((ds) => ds && String(ds.label || "").toLowerCase().includes("ambulance"));
      if (ambIndex >= 0) {
        const meta = chart.getDatasetMeta(ambIndex);
        if (meta && meta.hidden) return;
        if (chart.isDatasetVisible && !chart.isDatasetVisible(ambIndex)) return;
      }
      const counts = chart._ambulanceCounts;
      if (!Array.isArray(counts) || !counts.length) return;
      const xScale = chart.scales && chart.scales.x ? chart.scales.x : null;
      const chartArea = chart.chartArea;
      if (!xScale || !chartArea) return;

      const ctx = chart.ctx;
      const labels = chart.data && chart.data.labels ? chart.data.labels : [];
      const iconH = 28;
      const baseY = chartArea.bottom - 6;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      ctx.fillStyle = "#D32F2F";

      labels.forEach((_label, idx) => {
        const count = isNumber(counts[idx]) ? counts[idx] : 0;
        if (!count || count <= 0) return;
        const x = xScale.getPixelForValue(idx);
        const iconY = baseY - iconH;
        const labelY = iconY - 2;
        if (labelY < chartArea.top) return;

        ctx.fillText(String(count), x, labelY);
      });

      ctx.restore();
    }
  };

  function resolveSanteLineKeys(sampleProps){
    const props = sampleProps || {};
    const existing = state && state.santeFieldKeys ? state.santeFieldKeys : {};
    const popCandidates = [
      "population_2024",
      "Population_2024",
      "pop_2024",
      "Pop_2024",
      "POP_2024",
      "Population 2024",
      "Population2024",
      "pop2024",
      "Pop2024",
      "Population"
    ];
    const isfCandidates = [
      "isf",
      "ISF",
      "Indice synthetique de fecondite",
      "Indice synthétique de fécondité -ISF-",
      "Indice synthetique de fecondite -ISF-"
    ];
    const handicapCandidates = [
      "handicap_pct",
      "handicap",
      "Handicap",
      "Taux de prevalence du handicap (%)",
      "Taux de prévalence du handicap (%)"
    ];
    const ipmSanteCandidates = ["ipm_sante_pct","ipm_sante"];
    const ipmCondCandidates = ["ipm_conditions_pct","ipm_condvie_pct","ipm_conditions","ipm_condvie"];
    const ambulanceCandidates = ["Ambulance","ambulance","AMBULANCE","nb_ambulance","nb_ambulances"];
    const keys = {
      population_2024: resolvePropWithKey(props, popCandidates).key
        || existing.population_2024
        || (dashboardFieldKeys ? dashboardFieldKeys.population : "")
        || "",
      isf: resolvePropWithKey(props, isfCandidates).key || existing.isf || "",
      handicap_pct: resolvePropWithKey(props, handicapCandidates).key
        || existing.handicap_pct
        || (dashboardFieldKeys ? dashboardFieldKeys.chomage : "")
        || "",
      ipm_sante_pct: findKeyByPatterns(props, [
        ["ipm","sante"],
        ["decomposition","ipm","sante"],
        ["privation","sante"],
        ["sante"]
      ])
        || resolvePropWithKey(props, ipmSanteCandidates).key
        || existing.ipm_sante
        || existing.ipm_sante_pct
        || (dashboardFieldKeys ? dashboardFieldKeys.pauvrete : "")
        || "",
      ipm_conditions_pct: findKeyByPatterns(props, [
        ["ipm","conditionsdevie"],
        ["decomposition","ipm","conditionsdevie"],
        ["privation","conditionsdevie"],
        ["conditionsdevie"],
        ["ipm","condvie"],
        ["condvie"]
      ])
        || resolvePropWithKey(props, ipmCondCandidates).key
        || existing.ipm_conditions
        || existing.ipm_conditions_pct
        || (dashboardFieldKeys ? dashboardFieldKeys.analphabetisme : "")
        || "",
      ambulance: resolvePropWithKey(props, ambulanceCandidates).key
        || existing.ambulance
        || ""
    };
    state.santeFieldKeys.population_2024 = keys.population_2024;
    state.santeFieldKeys.isf = keys.isf;
    state.santeFieldKeys.handicap_pct = keys.handicap_pct;
    state.santeFieldKeys.ipm_sante_pct = keys.ipm_sante_pct;
    state.santeFieldKeys.ipm_conditions_pct = keys.ipm_conditions_pct;
    state.santeFieldKeys.ambulance = keys.ambulance;
    return keys;
  }

  function readSanteLineValue(props, key){
    if (!props || !key) return null;
    const parsed = parseNumberFR(props[key]);
    return isNumber(parsed) ? parsed : null;
  }

  function buildSanteLineRows(rows){
    const base = Array.isArray(rows) ? rows : [];
    const sampleProps = axisSampleProps
      || (base[0] && base[0].feature && base[0].feature.properties ? base[0].feature.properties : null)
      || {};
    const keys = resolveSanteLineKeys(sampleProps);
    const list = [];
    base.forEach((row, idx) => {
      const feature = row && row.feature ? row.feature : null;
      const props = feature && feature.properties ? feature.properties : {};
      const name = row && row.name ? row.name : getFeatureName(feature, idx);
      const ambulanceRaw = readSanteLineValue(props, keys.ambulance);
      const ambulance = (isNumber(ambulanceRaw) && ambulanceRaw > 0) ? Math.round(ambulanceRaw) : 0;
      list.push({
        name,
        population_2024: readSanteLineValue(props, keys.population_2024),
        isf: readSanteLineValue(props, keys.isf),
        handicap_pct: readSanteLineValue(props, keys.handicap_pct),
        ipm_sante_pct: readSanteLineValue(props, keys.ipm_sante_pct),
        ipm_conditions_pct: readSanteLineValue(props, keys.ipm_conditions_pct),
        ambulance
      });
    });
    return { rows: list, keys };
  }

  function buildSanteEtabBars(labels){
    const labelCount = Array.isArray(labels) ? labels.length : 0;
    if (!state.etabCountsReady || !state.etabIndexByCommune || !state.etabIndexByCommune.size){
      const sig = "skip|" + labelCount;
      if (sig !== lastSanteEtabBarsSig){
        lastSanteEtabBarsSig = sig;
        console.info("[SANTE_ETAB_BARS] skip(no_etab) countsReady=" + state.etabCountsReady);
      }
      return { ok:false, reason: "no_etab", data: null, max: 0 };
    }
    const map = state.etabIndexByCommune;
    const data = { hopital: [], cs_urbain: [], cs_rural: [], dispensaire: [], sres: [] };
    let maxVal = 0;
    (labels || []).forEach((name) => {
      const norm = normalizeCommuneKey(name);
      const bucket = norm ? map.get(norm) : null;
      const hp = bucket ? (bucket.hopital || 0) : 0;
      const csu = bucket ? (bucket.cs_urbain || 0) : 0;
      const csr = bucket ? (bucket.cs_rural || 0) : 0;
      const dr = bucket ? (bucket.dispensaire || 0) : 0;
      const sres = bucket ? (bucket.sres || 0) : 0;
      data.hopital.push(hp);
      data.cs_urbain.push(csu);
      data.cs_rural.push(csr);
      data.dispensaire.push(dr);
      data.sres.push(sres);
      maxVal = Math.max(maxVal, hp, csu, csr, dr, sres);
    });
    const sig = "ok|" + labelCount + "|" + maxVal;
    if (sig !== lastSanteEtabBarsSig){
      lastSanteEtabBarsSig = sig;
      console.info("[SANTE_ETAB_BARS] ok communes=" + labelCount + " maxEtab=" + maxVal);
    }
    return { ok:true, data, max: maxVal };
  }

  function renderCommuneLines(rows){
    if (!linesCanvas) return { ok:false, reason: "no_canvas" };
    if (!window.Chart){
      destroyLinesChart();
      setChartMessage(linesCanvas, "Donn\u00e9e indisponible");
      console.warn("Chart.js not loaded; lines chart disabled.");
      santeCompareReady = false;
      return { ok:false, reason: "no_chartjs" };
    }
    initExpandChartButton();
    const sourceRows = Array.isArray(rows) ? rows : [];
    const baseRows = (axisId === "sante" && geojsonData && Array.isArray(geojsonData.features))
      ? geojsonData.features.map((feature, idx) => ({
        name: getFeatureName(feature, idx),
        feature
      }))
      : sourceRows;
    const totalRows = baseRows.length;
    const classMask = (axisId === "sante") ? getActiveClassMask() : null;
    const filterActive = (axisId === "sante") ? isClassFilterActive(classMask) : false;
    let filteredRows = baseRows;
    if (axisId === "sante" && filterActive){
      filteredRows = baseRows.filter((row) => passesClassFilter(row, classMask));
    }
    if (axisId === "sante"){
      const activeIdx = (isolatedClassIndex !== null) ? isolatedClassIndex : activeClassIndex;
      const classId = (activeIdx === null || activeIdx === undefined)
        ? "none"
        : (CLASS_ID_BY_INDEX[activeIdx] || String(activeIdx));
      const sig = [selectedField || "", classId, filteredRows.length, totalRows].join("|");
      if (sig !== lastSanteLinesFilterSig){
        lastSanteLinesFilterSig = sig;
        console.info(
          "[LINES_FILTER] class=" + classId +
          " communes=" + filteredRows.length
        );
      }
    }
    if (!filteredRows.length){
      destroyLinesChart();
      const msg = filterActive
        ? "Donn\u00e9e indisponible (filtre classe)"
        : "Donn\u00e9e indisponible";
      setChartMessage(linesCanvas, msg);
      if (linesControlsEl) linesControlsEl.innerHTML = "";
      santeCompareReady = false;
      return { ok:false, reason: filterActive ? "class_filter_empty" : "no_rows" };
    }
    const lineData = (axisId === "sante") ? buildSanteLineRows(filteredRows) : { rows: filteredRows };
    const lineRows = Array.isArray(lineData.rows) ? lineData.rows : [];
    if (!lineRows.length){
      destroyLinesChart();
      setChartMessage(linesCanvas, "Donn\u00e9e indisponible");
      if (linesControlsEl) linesControlsEl.innerHTML = "";
      santeCompareReady = false;
      return { ok:false, reason: "no_rows" };
    }

    const labels = lineRows.map(r => r.name);
    const toggles = getLinesToggleState();
    const seriesList = (axisId === "sante") ? SANTE_LINE_SERIES : LINES_SERIES;
    const seriesColors = (axisId === "sante") ? getSanteLineColors() : INDICATOR_COLORS;
    const seriesDashes = (axisId === "sante") ? SANTE_LINE_DASHES : INDICATOR_DASHES;
    const popRange = computeLineMinMax(lineRows, "population_2024");
    const popRangeRaw = popRange;
    const etabBars = (axisId === "sante") ? buildSanteEtabBars(labels) : null;
    const barDatasets = [];
    const lineDatasets = [];
    const etabColors = (axisId === "sante") ? SANTE_ETAB_TICK_COLORS : {};
    const etabBorders = (axisId === "sante") ? SANTE_ETAB_BAR_BORDERS : {};
    if (etabBars && etabBars.ok && etabBars.data){
      const barDefs = [
        { key: "etab_hopital", label: "H\u00f4pital", type: "hopital" },
        { key: "etab_cs_urbain", label: "CS urbain", type: "cs_urbain" },
        { key: "etab_cs_rural", label: "CS rural", type: "cs_rural" },
        { key: "etab_dispensaire", label: "Dispensaire", type: "dispensaire" },
        { key: "etab_sres", label: "SRES", type: "sres" }
      ];
      barDefs.forEach((def) => {
        const rawCounts = (etabBars.data[def.type] || []).map((v) => (isNumber(v) ? v : 0));
        const bg = etabColors[def.type] || "#94A3B8";
        const border = etabBorders[def.type] || "#94A3B8";
        const isToggledOn = toggles.size ? !!toggles.get(def.key) : true;
        barDatasets.push({
          type: "bar",
          label: def.label,
          data: rawCounts,
          yAxisID: "yEtabs",
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          borderRadius: 3,
          barThickness: 10,
          borderSkipped: false,
          barPercentage: 0.9,
          categoryPercentage: 0.7,
          order: 1,
          _kind: "etab_bar",
          _rawCounts: rawCounts,
          _key: def.key,
          hidden: !showEtablissements || !isToggledOn
        });
      });
    }
    seriesList.forEach((series) => {
      const dataKey = series.dataKey || series.key;
      const isPopulation = series.key === "population_2024" || series.key === "population_normalisee";
      const usePopAxis = series.yAxisID === "yPop";
      let color = seriesColors[series.key] || series.color || "#e5e7eb";
      if (axisId === "sante" && isPopulation){
        const theme = getSanteTheme();
        color = (theme && theme.indicators && theme.indicators.population) ? theme.indicators.population : color;
      }
      const dash = seriesDashes[series.key] || [];
      const rawValues = lineRows.map(r => (isNumber(r[dataKey]) ? r[dataKey] : null));
      if (!rawValues.some(isNumber)) return;
      const data = rawValues.map((v) => {
        if (!isNumber(v)) return null;
        if (usePopAxis) return v;
        if (!series.isPercent) return normalizeLineValue(v, popRange);
        return clampPercent(v);
      });
      lineDatasets.push({
        label: series.label,
        data,
        yAxisID: usePopAxis ? "yPop" : undefined,
        borderColor: color,
        backgroundColor: colorWithAlpha(color, 0.12),
        pointBackgroundColor: color,
        pointBorderColor: "#FFFFFF",
        pointBorderWidth: 1,
        pointRadius: isPopulation ? 3.5 : 2,
        pointHoverRadius: isPopulation ? 4.5 : 3,
        borderWidth: isPopulation ? 2.5 : 2,
        borderDash: dash,
        tension: 0.25,
        spanGaps: false,
        fill: false,
        order: 10,
        _key: series.key,
        _dataKey: dataKey,
        _rawValues: rawValues,
        hidden: toggles.size ? !toggles.get(series.key) : false
      });
    });

    if (!lineDatasets.length){
      destroyLinesChart();
      setChartMessage(linesCanvas, "Donn\u00e9e indisponible");
      if (linesControlsEl) linesControlsEl.innerHTML = "";
      santeCompareReady = false;
      return { ok:false, reason: "no_series" };
    }

    const datasets = barDatasets.concat(lineDatasets);
    const availableDatasetKeys = new Set(datasets.map(ds => ds._key));
    const etabCatalogueKeys = axisId === "sante" ? new Set(["etab_hopital", "etab_cs_urbain", "etab_cs_rural", "etab_dispensaire", "etab_sres"]) : null;
    const catalogueKeys = axisId === "sante" ? etabCatalogueKeys : availableDatasetKeys;
    renderLinesLegend(toggles, catalogueKeys, availableDatasetKeys);
    setChartMessage(linesCanvas, "");

    destroyLinesChart();
    const ctx = linesCanvas.getContext("2d");
    const theme = getThemePalette();
    const textSoft = colorWithAlpha(theme.textColor, 0.75);
    const scales = {
      x: {
        type: "category",
        grid: { display: false },
        ticks: { autoSkip: false, minRotation: 25, maxRotation: 35, font: { size: 10 }, color: textSoft }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { stepSize: 25, font: { size: 10 }, color: textSoft },
        grid: { color: theme.gridColor }
      }
    };
    if (axisId === "sante"){
      let maxEtabValue = 0;
      barDatasets.forEach((ds) => {
        if (ds._rawCounts && Array.isArray(ds._rawCounts)){
          ds._rawCounts.forEach((v) => {
            if (isNumber(v) && v > maxEtabValue){
              maxEtabValue = v;
            }
          });
        }
      });
      const maxRounded = maxEtabValue > 0 ? Math.max(3, Math.ceil(maxEtabValue * 1.2)) : 3;
      scales.yEtabs = {
        position: "right",
        beginAtZero: true,
        min: 0,
        max: maxRounded,
        display: false,
        grid: { drawOnChartArea: false },
        ticks: {
          precision: 0,
          stepSize: maxRounded <= 10 ? 1 : (maxRounded <= 20 ? 2 : 5)
        }
      };
      const popMax = (popRangeRaw && isNumber(popRangeRaw.max) && popRangeRaw.max > 0) ? popRangeRaw.max : 1;
      const popMaxRounded = Math.ceil(popMax * 1.1);
      scales.yPop = {
        position: "right",
        beginAtZero: true,
        min: 0,
        max: popMaxRounded,
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 10 },
          color: textSoft,
          callback: (value) => formatInt(value)
        }
      };
    }
    linesChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: window.devicePixelRatio || 1,
        layout: { padding: { top: 6, bottom: 0, left: 0, right: 0 } },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.cardBg,
            titleColor: theme.textColor,
            bodyColor: theme.textColor,
            borderColor: theme.accentColor,
            borderWidth: 1,
            filter: (item) => {
              const ds = item.dataset || {};
              if (ds.yAxisID === "yEtabs"){
                const rawCounts = ds._rawCounts || [];
                const raw = rawCounts[item.dataIndex];
                return isNumber(raw) && raw > 0;
              }
              return true;
            },
            callbacks: {
              title: (items) => (items && items[0] ? items[0].label : ""),
              label: (ctx) => {
                const ds = ctx.dataset || {};
                if (ds.yAxisID === "yEtabs"){
                  const rawCounts = ds._rawCounts || [];
                  const raw = rawCounts[ctx.dataIndex];
                  if (!isNumber(raw) || raw <= 0) return "";
                  return (ds.label || "Etablissements") + ": " + raw;
                }
                const key = ds._key || "";
                const rawValues = ds._rawValues || [];
                const raw = rawValues[ctx.dataIndex];
                if (ds.yAxisID === "yPop" && isNumber(raw)){
                  return (ds.label || "Population 2024") + ": " + formatInt(raw) + " hab";
                }
                const rawText = formatLineRaw(key, raw);
                return (ds.label || key) + ": " + rawText;
              },
              afterBody: (items) => {
                if (axisId !== "sante" || !showAmbulanceIcons || !items || !items.length) return [];
                const chart = items[0].chart;
                const counts = chart && Array.isArray(chart._ambulanceCounts) ? chart._ambulanceCounts : null;
                if (!counts) return [];
                const count = counts[items[0].dataIndex];
                if (!isNumber(count) || count <= 0) return [];
                return ["Ambulances: " + count];
              }
            }
          }
        },
        scales,
      onClick: (evt) => {
          const pts = linesChart.getElementsAtEventForMode(evt, "nearest", { intersect: true }, true);
          if (!pts.length) return;
          const idx = pts[0].index;
          const name = labels[idx];
          if (name) selectCommuneByName(name);
        }
      },
      plugins: [communeMarkerPlugin, ambulanceStackPlugin, ambulanceLabelsPlugin]
    });
    if (linesChart){
      linesChart._etabBarCounts = (etabBars && etabBars.ok) ? etabBars.data : null;
      linesChart._ambulanceCounts = (axisId === "sante")
        ? lineRows.map((row) => (isNumber(row.ambulance) ? row.ambulance : 0))
        : null;
      window.linesChart = linesChart;
      if (linesCanvas){
        linesCanvas.chart = linesChart;
      }
    }
    syncLineSwatches();
    santeCompareReady = true;
    maybeLogSanteUi();
    const countsReady = state.etabCountsReady;
    const etabKeys = ["etab_hopital", "etab_cs_urbain", "etab_cs_rural", "etab_dispensaire", "etab_sres"];
    const etabBarsOn = toggles.size ? etabKeys.some((k) => toggles.get(k)) : countsReady;
    const sig = [
      labels.length,
      lineDatasets.map(ds => ds._key).join(","),
      etabBarsOn ? "on" : "off",
      countsReady ? "1" : "0"
    ].join("|");
    if (sig !== lastSanteLinesSig){
      lastSanteLinesSig = sig;
      console.info(
        "[SANTE_LINES] etabBars=" + (etabBarsOn ? "on" : "off") +
        " countsReady=" + (countsReady ? "true" : "false")
      );
    }
    return { ok:true };
  }

  function getCurrentIndicatorKey(){
    if (!selectedField) return "";
    if (dashboardFieldKeys){
      const keys = Object.keys(METRIC_META);
      for (const k of keys){
        if (dashboardFieldKeys[k] && dashboardFieldKeys[k] === selectedField) return k;
      }
    }
    return fieldNameToMetricKey(selectedField);
  }

  function getIndicatorLabel(key){
    if (axisId === "sante") return getSanteIndicatorLabel(selectedField);
    if (!key || !METRIC_META[key]) return selectedField || "Indicateur";
    if (key === "population") return "Population 2014";
    const meta = METRIC_META[key];
    return meta.isPercent ? meta.label + " (%)" : meta.label;
  }

  function getSanteIndicatorsList(){
    if (state.santeIndicators && state.santeIndicators.length) return state.santeIndicators;
    return buildSanteIndicators(axisSampleProps || {});
  }

  function getSanteFieldMeta(fieldKey){
    if (!fieldKey) return null;
    const list = getSanteIndicatorsList();
    return list.find((item) => item.key === fieldKey) || null;
  }

  function getSanteIndicatorLabel(fieldKey){
    const meta = getSanteFieldMeta(fieldKey);
    return meta ? meta.label : (fieldKey || "Indicateur");
  }

  function formatSanteIndicatorValue(fieldKey, value){
    if (!isNumber(value)) return MISSING;
    const meta = getSanteFieldMeta(fieldKey);
    if (meta && meta.unit === "%") return formatPercent(value);
    if (fieldKey === "pop_2024") return formatInt(value);
    if (fieldKey === "sante_index") return formatFixed1(value);
    return formatNumber(value);
  }

  function getSanteClassConfig(fieldKey){
    const meta = getSanteFieldMeta(fieldKey);
    const direction = meta && meta.direction ? meta.direction : "badHigh";
    const palette = getSanteClassPalette().slice();
    const labels = CLASS_LABELS.slice();
    if (direction === "goodHigh"){
      palette.reverse();
      labels.reverse();
    }
    return { palette, labels };
  }

  function getSelectedIndicatorLabel(){
    if (axisId === "sante") return getSanteIndicatorLabel(selectedField);
    return getIndicatorLabel(getCurrentIndicatorKey());
  }

  function formatIndicatorValue(key, value){
    if (key === "population") return formatInt(value);
    const meta = METRIC_META[key];
    if (meta && (meta.unit === "index" || meta.unit === "per10k")) return formatFixed1(value);
    if (meta && meta.isPercent) return formatPercent(value);
    return formatInt(value);
  }

  function fmtVal(value, unit){
    if (!isNumber(value)) return MISSING;
    if (unit === "%"){
      const fixed = Math.round(value * 10) / 10;
      return fixed.toFixed(1).replace(".", ",") + "%";
    }
    return formatInt(value);
  }

  function computeStats(rows, key){
    const vals = rows.map(r => r[key]).filter(isNumber);
    if (!vals.length) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean };
  }

  function computeRank(rows, key, name){
    const list = rows
      .filter(r => isNumber(r[key]))
      .slice()
      .sort((a, b) => b[key] - a[key]);
    const idx = list.findIndex(r => r.name === name);
    if (idx < 0) return null;
    return { rank: idx + 1, total: list.length, list };
  }

  function findRowByName(name){
    if (!name || !dashboardRows) return null;
    const norm = normalizeCommuneName(name);
    return dashboardRows.find(r => normalizeCommuneName(r.name) === norm) || null;
  }

  function renderCommunePopup(row, rowsAll){
    if (!communePopEl || !communePopBodyEl || !communePopNameEl) return;
    communePopNameEl.textContent = row && row.name ? row.name : MISSING;
    communePopBodyEl.innerHTML = "";
    if (!row || !rowsAll || !rowsAll.length){
      communePopEl.removeAttribute("data-open");
      communePopEl.setAttribute("aria-hidden", "true");
      return;
    }

    POP_KPIS.forEach((kpi) => {
      const v = row[kpi.key];
      const stats = computeStats(rowsAll, kpi.key);
      const rk = computeRank(rowsAll, kpi.key, row.name);

      let sub = "";
      if (isNumber(v) && rk){
        const ec = stats ? (v - stats.mean) : null;
        const ecTxt = (ec === null || !isNumber(ec))
          ? ""
          : (" | Écart: " + (ec >= 0 ? "+" : "") + (Math.round(ec * 10) / 10).toFixed(1).replace(".", ",") + (kpi.unit || ""));
        sub = "Rang: " + rk.rank + "/" + rk.total + ecTxt;
      }

      const html =
        "<div class=\"kpi-row\" data-key=\"" + kpi.key + "\">" +
          "<div class=\"kpi-left\">" +
            "<div class=\"kpi-ico\"><img src=\"" + kpi.icon + "\" alt=\"\"></div>" +
            "<div class=\"kpi-meta\">" +
              "<div class=\"kpi-label\">" + escapeHtml(kpi.label) + "</div>" +
              "<div class=\"kpi-sub\">" + escapeHtml(sub) + "</div>" +
            "</div>" +
          "</div>" +
          "<div class=\"kpi-val\">" + escapeHtml(fmtVal(v, kpi.unit)) + "</div>" +
        "</div>";
      communePopBodyEl.insertAdjacentHTML("beforeend", html);
    });

    communePopEl.setAttribute("data-open", "1");
    communePopEl.setAttribute("aria-hidden", "false");
  }

  function renderLegend(){
    const legendLabel = getSelectedIndicatorLabel();
    legendTitleEl.textContent = legendLabel;
    legendMetaEl.textContent  = (axisId === "sante" && santeFieldEmpty) ? "Donn\u00e9e indisponible" : "";
    legendItemsEl.innerHTML = "";

    classRanges.forEach((c, idx) => {
      const div = document.createElement("div");
      div.className = "legend-item";

      const isActive = (activeClassIndex === idx);
      const isIsolated = (isolatedClassIndex === idx);
      if (activeClassIndex !== null && !isActive) div.classList.add("dim");
      if (isolatedClassIndex !== null && !isIsolated) div.classList.add("dim");
      if (isActive || isIsolated) div.classList.add("active");

      div.innerHTML =
        "<div class=\"legend-swatch\" style=\"background:" + c.color + "\"></div>" +
        "<div class=\"legend-label\"><span>" + escapeHtml(c.label) + "</span></div>";

      if (div) div.addEventListener("click", (ev) => {
        const shift = ev.shiftKey;
        if (shift){
          isolatedClassIndex = (isolatedClassIndex === idx) ? null : idx;
          activeClassIndex = null;
        } else {
          activeClassIndex = (activeClassIndex === idx) ? null : idx;
          isolatedClassIndex = null;
        }
        renderLegend();
        renderLegendChart();
        if (geoLayer) geoLayer.setStyle(styleFeature);
        rebuildDashboard();
      });

    legendItemsEl.appendChild(div);
    });
    ensureCommunesToggle();
    ensureSanteEtabToggle();
    renderMapLegend();
    themeClassesReady = true;
    maybeLogThemeSante();
  }

  // Popup Santé au clic sur commune
  let currentSantePopup = null;
  const ICON_AMBULANCE = "assets/icons/ambulance.png";

  function pickSanteField(props, candidates){
    if (!props || !Array.isArray(candidates)) return null;
    for (const key of candidates){
      const value = props[key];
      if (value !== undefined && value !== null && value !== ""){
        return value;
      }
    }
    return null;
  }

  function toNumberSafe(value){
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const parsed = parseNumberFR(value);
    return isNumber(parsed) ? parsed : null;
  }

  function getEtablissementsByCommune(communeName){
    if (!communeName) {
      return { total: null, byType: null };
    }
    const norm = normalizeCommuneKey(communeName);
    if (!norm) return { total: null, byType: null };
    if (!state.etabCountsReady || !state.etabIndexByCommune) {
      return { total: null, byType: null };
    }
    const rec = state.etabIndexByCommune.get(norm);
    if (!rec) {
      const etabZero = { total: 0, byType: { hopital: 0, cs_urbain: 0, cs_rural: 0, dispensaire: 0, sres: 0, autre: 0 } };
      console.info("[POPUP_ETAB]", communeName, norm, null, "pas de bucket");
      return etabZero;
    }
    const result = {
      total: rec.total || 0,
      byType: {
        hopital: rec.hopital || 0,
        cs_urbain: rec.cs_urbain || 0,
        cs_rural: rec.cs_rural || 0,
        dispensaire: rec.dispensaire || 0,
        sres: rec.sres || 0,
        autre: rec.autre || 0
      }
    };
    console.info("[POPUP_ETAB]", communeName, norm, rec);
    return result;
  }

  function getSantePopupValues(feature){
    if (!feature || !feature.properties) return {};
    const props = feature.properties;
    const sampleProps = axisSampleProps || props || {};
    const resolvedKeys = resolveSanteLineKeys(sampleProps);
    
    const population = readSanteLineValue(props, resolvedKeys.population_2024);
    const ipmSante = readSanteLineValue(props, resolvedKeys.ipm_sante_pct);
    const handicap = readSanteLineValue(props, resolvedKeys.handicap_pct);
    const ambulance = readSanteLineValue(props, resolvedKeys.ambulance);
    
    return {
      population: isNumber(population) ? population : null,
      ipmSante: isNumber(ipmSante) ? ipmSante : null,
      handicap: isNumber(handicap) ? handicap : null,
      ambulance: isNumber(ambulance) && ambulance > 0 ? Math.round(ambulance) : null
    };
  }

  function buildSantePopupHtml(feature){
    if (!feature) return "";
    const name = getFeatureName(feature, 0);
    const values = getSantePopupValues(feature);
    const etabs = getEtablissementsByCommune(name);
    
    const popDisplay = isNumber(values.population) ? formatInt(values.population) : "N/A";
    const ipmDisplay = isNumber(values.ipmSante) ? formatPercent(values.ipmSante) : "N/A";
    const handicapDisplay = isNumber(values.handicap) ? formatPercent(values.handicap) : "N/A";
    const ambulanceDisplay = isNumber(values.ambulance) ? String(values.ambulance) : "N/A";
    
    let etabHtml = "";
    if (etabs.total !== null){
      const etabTotalDisplay = etabs.total > 0 ? String(etabs.total) : "0";
      const hasEtabData = etabs.byType && (etabs.byType.hopital > 0 || etabs.byType.cs_urbain > 0 || etabs.byType.cs_rural > 0 || etabs.byType.dispensaire > 0 || etabs.byType.sres > 0 || etabs.byType.autre > 0);
      etabHtml = "<div class=\"sante-popup__row sante-popup__row--etab\">" +
        "<div class=\"sante-popup__label\">Établissements de santé</div>" +
        "<div class=\"sante-popup__value\">" + etabTotalDisplay + "</div>" +
      "</div>";
      if (hasEtabData && etabs.byType){
        etabHtml += "<div class=\"sante-popup__etab-types\">";
        const typeLabels = {
          hopital: "Hôpital",
          cs_urbain: "CS urbain",
          cs_rural: "CS rural",
          dispensaire: "Dispensaire",
          sres: "SRES",
          autre: "Autre"
        };
        const typeOrder = ["hopital", "cs_urbain", "cs_rural", "dispensaire", "sres", "autre"];
        typeOrder.forEach((typeKey) => {
          const count = etabs.byType[typeKey] || 0;
          if (count > 0){
            etabHtml += "<span class=\"sante-popup__etab-pill\">" + escapeHtml(typeLabels[typeKey] || typeKey) + ": " + count + "</span>";
          }
        });
        etabHtml += "</div>";
      }
    } else {
      etabHtml = "<div class=\"sante-popup__row sante-popup__row--etab\">" +
        "<div class=\"sante-popup__label\">Établissements de santé</div>" +
        "<div class=\"sante-popup__value sante-popup__value--na\">N/A</div>" +
      "</div>";
    }
    
    return "<div class=\"sante-popup\">" +
      "<div class=\"sante-popup__header\">" +
        "<div class=\"sante-popup__title\">" + escapeHtml(name) + "</div>" +
        "<div class=\"sante-popup__badge\">Profil Santé</div>" +
      "</div>" +
      "<div class=\"sante-popup__body\">" +
        "<div class=\"sante-popup__row\">" +
          "<div class=\"sante-popup__label\">Population</div>" +
          "<div class=\"sante-popup__value" + (isNumber(values.population) ? "" : " sante-popup__value--na") + "\">" + popDisplay + "</div>" +
        "</div>" +
        "<div class=\"sante-popup__row\">" +
          "<div class=\"sante-popup__label\">IPM Santé</div>" +
          "<div class=\"sante-popup__value" + (isNumber(values.ipmSante) ? "" : " sante-popup__value--na") + "\">" + ipmDisplay + "</div>" +
        "</div>" +
        "<div class=\"sante-popup__row\">" +
          "<div class=\"sante-popup__label\">Handicap</div>" +
          "<div class=\"sante-popup__value" + (isNumber(values.handicap) ? "" : " sante-popup__value--na") + "\">" + handicapDisplay + "</div>" +
        "</div>" +
        etabHtml +
        "<div class=\"sante-popup__row\">" +
          "<div class=\"sante-popup__label\">Ambulances</div>" +
          "<div class=\"sante-popup__value" + (isNumber(values.ambulance) ? "" : " sante-popup__value--na") + "\">" + ambulanceDisplay + "</div>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  function openSantePopup(e, feature){
    if (!map || !feature) return;
    if (currentSantePopup){
      map.closePopup(currentSantePopup);
      currentSantePopup = null;
    }
    const latlng = e && e.latlng ? e.latlng : (feature.geometry && feature.geometry.type === "Point" 
      ? [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]
      : null);
    if (!latlng) return;
    const html = buildSantePopupHtml(feature);
    currentSantePopup = L.popup({
      className: "popup-sante popup-sante--compact",
      maxWidth: 320,
      minWidth: 260,
      autoPan: true,
      keepInView: true,
      closeButton: true,
      pane: "pane-popup"
    }).setLatLng(latlng).setContent(html).openOn(map);
  }

  function rebuild(){
    if (!geojsonData || !selectedField) return;

    classCount = DEFAULT_CLASS_COUNT;
    method = DEFAULT_METHOD;
    communeProfileStats = buildCommuneProfileStats(geojsonData);

    const vals = computeValues(geojsonData, selectedField);
    const hasVals = vals.length > 0;
    santeFieldEmpty = axisId === "sante" && !hasVals;
    if (!hasVals){
      breaks = [];
      classRanges = [];
      if (axisId === "sante" && selectedField !== lastSanteFieldEmpty){
        console.info("[SANTE_FIELD_EMPTY] field=" + selectedField);
        lastSanteFieldEmpty = selectedField;
      }
    } else {
      breaks = quantileBreaks(vals, classCount);
      const classConfig = getSanteClassConfig(selectedField);
      classRanges = buildClasses(breaks, classConfig.palette, classConfig.labels);
      logSanteIndicatorChange();
    }

    state.santeClassByCommune = buildSanteClassByCommune();

    if (geoLayer) map.removeLayer(geoLayer);
    mapNameToLayer.clear();
    communesByName.clear();
    selectedProfileLayer = null;
    let featureIndex = 0;

    geoLayer = L.geoJSON(geojsonData, {
      pane: "pane-communes",
      style: styleFeature,
      onEachFeature: (feature, layer) => {
        const fname = getFeatureName(feature, featureIndex);
        feature._labelName = fname;
        featureIndex += 1;
        mapNameToLayer.set(fname, layer);
        const normalizedName = normalizeCommuneName(fname);
        communesByName.set(normalizedName, { name: fname, feature, properties: feature.properties || {}, layer });
        layer.on({
          mouseover: highlight,
          mouseout: unhighlight,
          click: (e) => {
            map.fitBounds(layer.getBounds(), { padding: [30, 30] });
            toggleCommuneSelection(fname);
            selectCommuneByName(fname, { zoom: false });
            if (axisId === "sante"){
              openSantePopup(e, feature);
            }
          }
        });
        layer.bindTooltip(tooltipText(feature), { className: "mytt", sticky: true, direction: "top" });
      }
    }).addTo(map);
    currentCommunesLayer = geoLayer;
    if (typeof window !== "undefined") window.__L_COMMUNES = geoLayer;
    applyCommunesVisibility();
    
    // Désactivé : Ajouter les labels des communes (on affiche les chefs-lieux à la place)
    // addCommuneLabels(geoLayer);

    const b = geoLayer.getBounds();
    if (b && b.isValid()) map.fitBounds(b, { padding: [30, 30] });

    if (!appReadyFired){
      appReadyFired = true;
      try{
        if (window && window.dispatchEvent){
          window.dispatchEvent(new CustomEvent("APP_READY", { detail: { map: map } }));
        }
      } catch(_){}
    }

    renderLegend();
    renderLegendChart();
    rebuildDashboard();
    refreshCommuneList();
    // Mettre à jour le graphique RH Santé lors du changement d'indicateur
    if (axisId === "sante"){
      // Appeler directement renderPodiumCard pour qu'il se charge immédiatement
      if (geojsonData && Array.isArray(geojsonData.features) && geojsonData.features.length > 0){
        renderPodiumCard();
      }
      requestSanteChartsRefresh();
    }
    if (selectedProfileName){
      selectCommuneByName(selectedProfileName, { zoom: false });
    } else {
      initCommuneProfile();
    }
  }

  const resetFilterBtn = document.getElementById("resetFilterBtn");
  if (resetFilterBtn) resetFilterBtn.addEventListener("click", () => {
    activeClassIndex = null;
    isolatedClassIndex = null;
    state.activeClassFilter = null;
    renderLegend();
    renderLegendChart();
    if (geoLayer) geoLayer.setStyle(styleFeature);
    rebuildDashboard();
  });

  if (dataSearchEl) dataSearchEl.addEventListener("input", () => {
    tableFilterText = dataSearchEl.value || "";
    renderTable(dashboardRows);
  });

  if (dataTableEl) dataTableEl.addEventListener("click", (e) => {
    const th = e.target.closest("th");
    if (!th) return;
    const key = th.getAttribute("data-field");
    if (!key) return;
    if (tableSortKey === key) tableSortDir = (tableSortDir === "asc") ? "desc" : "asc";
    else { tableSortKey = key; tableSortDir = "asc"; }
    renderTable(dashboardRows);
  });

  if (exportBtn) exportBtn.addEventListener("click", () => exportCsv());
  setupLinesControls();
  hideSanteFamilyTabs();
  hideCompareCommunesWidget();
  if (communePopCloseEl) communePopCloseEl.addEventListener("click", () => {
    if (!communePopEl) return;
    communePopEl.removeAttribute("data-open");
    communePopEl.setAttribute("aria-hidden", "true");
  });
  dockGlobalStats();
  if (communeSearchEl){
    communeSearchEl.addEventListener("change", () => {
      selectCommuneByName(communeSearchEl.value);
    });
    communeSearchEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter"){
        e.preventDefault();
        selectCommuneByName(communeSearchEl.value);
      }
    });
  }

  // Indicator select
  const indicatorSelect = document.getElementById("fieldSelect");

  let allFields = [];

  function setSelectedField(field){
    selectedField = field;
    if (indicatorSelect && indicatorSelect.value !== field){
      indicatorSelect.value = field;
    }
    rebuild();
  }

  function populateIndicatorOptions(fields){
    if (!indicatorSelect) return;
    indicatorSelect.innerHTML = "";
    if (axisId === "sante"){
      const indicators = getSanteIndicatorsList();
      indicators.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.key;
        opt.textContent = f.label;
        indicatorSelect.appendChild(opt);
      });
      return;
    }
    fields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      indicatorSelect.appendChild(opt);
    });
  }

  if (indicatorSelect){
    indicatorSelect.addEventListener("change", () => setSelectedField(indicatorSelect.value));
  }

  // Robust GeoJSON loader:
  // 1) ?geo=FILE.geojson  (recommended)
  // 2) fallback candidates (handles spaces / encoding)
  function getGeoFromQuery(){
    const u = new URL(window.location.href);
    const g = u.searchParams.get("geo");
    return g ? g.trim() : "";
  }

  async function tryFetchJson(url, label){
    const tag = label || url;
    let r = null;
    try{
      r = await fetch(url);
    } catch (err){
      console.warn("[DATA] fetch " + tag + " failed", err);
      return null;
    }
    console.info("[DATA] fetch " + tag + " status=" + r.status);
    if (!r.ok){
      console.warn("[DATA] fetch " + tag + " http=" + r.status);
      return null;
    }
    try{
      const json = await r.json();
      const features = json && Array.isArray(json.features) ? json.features.length : 0;
      const size = safeJsonSize(json);
      console.info("[DATA] " + tag + " loaded features=" + features + " bytes=" + size);
      return json;
    } catch (err){
      console.warn("[DATA] parse " + tag + " failed", err);
      return null;
    }
  }

  async function fetchGeoJson(){
    // Axe santé (chemin FIXE)
    return await tryFetchJson(COMMUNES_PATH, "communes");
  }

  function isAxisPath(path){
    if (!path) return false;
    if (/\/axis\//i.test(path) || /\\axis\\/i.test(path)) return true;
    if (/axis_/i.test(path)) return true;
    return false;
  }

  function getBoundaryGeomType(fc){
    if (!fc || !Array.isArray(fc.features)) return "";
    for (const feature of fc.features){
      const geom = feature && feature.geometry ? feature.geometry : null;
      if (geom && typeof geom.type === "string") return geom.type;
    }
    return "";
  }

  function isPolygonGeom(type){
    return type === "Polygon" || type === "MultiPolygon";
  }

  async function fetchBoundaryGeoJson(){
    const fc = await tryFetchJson(COMMUNES_PATH, "communes");
    if (!fc){
      if (!santeBoundaryLogged){
        console.warn("[SANTE_BOUNDARY] path=none features=0 geom=none");
        santeBoundaryLogged = true;
      }
      return null;
    }
    const features = Array.isArray(fc.features) ? fc.features : [];
    const count = features.length || 0;
    const geomType = getBoundaryGeomType(fc);
    if (!santeBoundaryLogged){
      console.info("[SANTE_BOUNDARY] path=" + COMMUNES_PATH + " features=" + count + " geom=" + (geomType || "unknown"));
      santeBoundaryLogged = true;
    }
    return fc;
  }

  async function initSanteDataLoad(){
    let axisFc = null;
    let boundaryFc = null;
    santeUiLogged = false;
    santeGaugesReady = false;
    santeCompareReady = false;
    santeDataLogged = false;
    lastSanteIndicField = null;
    lastSanteGaugesSig = null;
    lastSanteCrossSig = null;
    santeDataCounts = { communes: null, etab: null, pv: null, chef_lieu: null };
    santeDataStats = { ipmMin: null, ipmMax: null, hMin: null, hMax: null, ready: false };
    state.santeGaugeExtents = null;

    boundaryFc = await fetchBoundaryGeoJson();
    axisFc = boundaryFc;
    state.joinedCommunesFC = boundaryFc;
    if (boundaryFc) console.info("[SANTE_LOAD] COMMUNES charge.");
    else console.warn("[SANTE_LOAD] COMMUNES indisponible");

    healthByCommune = new Map();
    const total = boundaryFc && Array.isArray(boundaryFc.features) ? boundaryFc.features.length : 0;
    santeBoundaryIsFallback = total > 0 && total < 10;
    reportSanteDataCount("communes", total);

    if (boundaryFc){
      geojsonData = boundaryFc;
      const sampleFeature = Array.isArray(boundaryFc.features)
        ? boundaryFc.features.find((f) => f && f.properties)
        : null;
      axisSampleProps = sampleFeature ? sampleFeature.properties : null;
      if (axisId === "sante"){
        state.santeGaugeExtents = computeSanteGaugeExtents(boundaryFc);
      }
      if (axisSampleProps){
        console.info("[DATA] axis sample keys:", Object.keys(axisSampleProps));
      } else {
        console.info("[DATA] axis sample keys: none");
      }

      if (axisId === "sante"){
        const indicators = buildSanteIndicators(axisSampleProps || {});
        state.santeIndicators = indicators;
        state.santeAuxGaugeKey = (axisSampleProps && Object.prototype.hasOwnProperty.call(axisSampleProps, "isf")) ? "isf" : "pop_2024";
        allFields = indicators.map((f) => f.key);
        populateIndicatorOptions(allFields);
        const preferred = indicators.length ? indicators[0].key : "";
        if (preferred) setSelectedField(preferred);
        console.info("[INDICATORS_READY] axis=sante keys=" + allFields.join(","));
      } else {
        const fields = getNumericFields(boundaryFc);
        if (fields.length === 0){
          console.warn("[DATA] no numeric fields detected in boundary data.");
        } else {
          allFields = fields;
          const preferred = fields.includes(DEFAULT_SELECTED_FIELD) ? DEFAULT_SELECTED_FIELD : fields[0];
          populateIndicatorOptions(allFields);
          setSelectedField(preferred);
        }
      }

      addBoundaryLayer(boundaryFc);
    } else {
      console.warn("[SANTE_BOUNDARY] choropleth skipped (boundary missing).");
      reportSanteDataCount("communes", 0);
    }

    santeReadyCommunes = true;
    requestSanteChartsRefresh();
    await loadProvinceLayer(map);
    loadChefLieuxLayer(map);
    await loadDouarsLayers(map);
    applyDouarsToggle();
    try{
      await loadSanteEtablissements(map);
    } catch (_){ }
    logSanteReady();
  }


  function addBoundaryLayer(fc){
    if (!map) return;
    if (boundaryLayer) map.removeLayer(boundaryLayer);
    const stroke = (axisId === "sante") ? getSanteTheme().ink : "#000";
    boundaryLayer = L.geoJSON(fc, {
      pane: "pane-province",
      interactive: false,
      style: {
        color: stroke,
        weight: 3.5,
        opacity: 1,
        fill: false,
        fillOpacity: 0,
        lineCap: "round",
        lineJoin: "round"
      }
    }).addTo(map);
  }

  async function loadProvinceLayer(map){
    if (!map) return;
    if (provinceLayer){
      try{ map.removeLayer(provinceLayer); } catch(_){ }
      provinceLayer = null;
    }
    try{
      const fc = await tryFetchJson(PV_PATH, "pv");
      if (!fc){
        console.warn("[PV] missing data");
        reportSanteDataCount("pv", 0);
        return;
      }
      const features = fc && Array.isArray(fc.features) ? fc.features : [];
      const stroke = (axisId === "sante") ? getSanteTheme().ink : "#111827";
      provinceLayer = L.geoJSON(fc, {
        pane: "pane-province",
        interactive: false,
        style: {
          color: stroke,
          weight: 2,
          opacity: 0.9,
          fill: false
        }
      });
      provinceLayer.addTo(map);
      reportSanteDataCount("pv", features.length);
    } catch (err){
      console.warn("[PV] failed to load", err);
      reportSanteDataCount("pv", 0);
    }
  }

  function getChefLieuName(props){
    const keys = ["chef_lieu_nom","chef_lieu","nom","name","libelle","LOCALITE","NOM","Nom"];
    for (const k of keys){
      if (props && props[k]) return String(props[k]).trim();
    }
    if (props){
      for (const [k, v] of Object.entries(props)){
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
    return "";
  }

  async function loadChefLieuxLayer(map){
    if (!map) return;
    if (window.__chefLieuxLayer){
      try{ map.removeLayer(window.__chefLieuxLayer); } catch(_){ }
      window.__chefLieuxLayer = null;
    }
    try{
      const fc = await tryFetchJson(CHEF_LIEU_PATH, "chef_lieu");
      if (!fc){
        console.warn("[CHEF_LIEU] missing data");
        reportSanteDataCount("chef_lieu", 0);
        return;
      }
      const features = fc && Array.isArray(fc.features) ? fc.features : [];
      chefLieuPoints = [];
      chefLieuLabelMarkers = [];
      const chefSvg =
        "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">" +
          "<path d=\"M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17l-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5z\" " +
          "fill=\"#FFD54A\" stroke=\"#111\" stroke-width=\"1\"/>" +
        "</svg>";
      const chefLieuIcon = L.divIcon({
        className: "chef-lieu-icon",
        html: chefSvg,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      const layer = L.geoJSON(fc, {
        pane: "pane-chef-lieu",
        pointToLayer: (feature, latlng) => {
          const group = L.layerGroup();
          const marker = L.marker(latlng, {
            icon: chefLieuIcon,
            zIndexOffset: 900,
            pane: "pane-chef-lieu",
            interactive: false,
            riseOnHover: true
          });
          group.addLayer(marker);
          const name = getChefLieuName(feature && feature.properties ? feature.properties : null);
          chefLieuPoints.push({ latlng, name: name || "" });
          if (!name){
            console.warn("[CHEF_LIEU] missing name field for feature", feature && feature.properties ? feature.properties : feature);
          } else {
            const label = L.marker(latlng, {
              icon: L.divIcon({
                className: "chef-lieu-label-wrap",
                html: buildChefLieuLabelHtml(name, { dx: 14, dy: -14 })
              }),
              interactive: false,
              zIndexOffset: 901,
              pane: "pane-chef-lieu",
              riseOnHover: true
            });
            group.addLayer(label);
            chefLieuLabelMarkers.push({ marker: label, latlng, name, offsetKey: "" });
          }
          return group;
        }
      });
      window.__chefLieuxLayer = layer;
      layer.addTo(map);
      ensureChefLieuLayoutEvents();
      scheduleChefLieuLayout();
      console.info("[CHEF_LIEU] loaded features=", features.length);
      reportSanteDataCount("chef_lieu", features.length);
    } catch (err){
      console.warn("[CHEF_LIEU] failed to load", err);
      reportSanteDataCount("chef_lieu", 0);
    }
  }

  function getDouarLabel(props){
    const v = props && props.nom_fr;
    return (typeof v === "string" && v.trim()) ? v.trim() : "";
  }

  async function loadDouarsLayers(map){
    if (!map) return;
    if (douarsPointsLayer){
      try{ map.removeLayer(douarsPointsLayer); } catch(_){ }
      douarsPointsLayer = null;
    }
    if (douarsLabelsLayer){
      try{ map.removeLayer(douarsLabelsLayer); } catch(_){ }
      douarsLabelsLayer = null;
    }
    try{
      const fc = await tryFetchJson(DOUARS_PATH, "douars");
      if (!fc){
        console.warn("[DOUARS] missing data");
        return;
      }
      const features = fc && Array.isArray(fc.features) ? fc.features : [];
      
      douarsPointsLayer = L.geoJSON(fc, {
        pane: "pane-douars",
        pointToLayer: (feature, latlng) => {
          return L.circleMarker(latlng, {
            radius: 3,
            fillColor: "#ffffff",
            fillOpacity: 1,
            color: "#000000",
            weight: 1,
            pane: "pane-douars",
            interactive: false
          });
        }
      });

      const labelFeatures = features.filter(f => {
        const name = getDouarLabel(f && f.properties);
        return !!name;
      });

      douarsLabelsLayer = L.geoJSON({ type: "FeatureCollection", features: labelFeatures }, {
        pane: "pane-douars",
        pointToLayer: (feature, latlng) => {
          const name = getDouarLabel(feature && feature.properties);
          if (!name) return null;
          return L.marker(latlng, {
            pane: "pane-douars",
            interactive: false,
            icon: L.divIcon({
              className: "douar-label-wrap",
              html: "<div class='douar-label'>" + escapeHtml(name) + "</div>"
            })
          });
        }
      });

      console.info("[DOUARS] loaded features=", features.length);
    } catch (err){
      console.warn("[DOUARS] failed to load", err);
    }
  }

  function applyDouarsToggle(){
    if (!map) return;
    if (!showDouars){
      if (douarsPointsLayer && map.hasLayer(douarsPointsLayer)){
        map.removeLayer(douarsPointsLayer);
      }
      if (douarsLabelsLayer && map.hasLayer(douarsLabelsLayer)){
        map.removeLayer(douarsLabelsLayer);
      }
      return;
    }
    if (douarsPointsLayer && !map.hasLayer(douarsPointsLayer)){
      douarsPointsLayer.addTo(map);
    }
    updateDouarsLabelsByZoom();
  }

  function updateDouarsLabelsByZoom(){
    if (!map) return;
    if (!showDouars){
      if (douarsLabelsLayer && map.hasLayer(douarsLabelsLayer)){
        map.removeLayer(douarsLabelsLayer);
      }
      return;
    }
    const zoom = map.getZoom();
    if (zoom >= DOUARS_LABEL_MIN_ZOOM){
      if (douarsLabelsLayer && !map.hasLayer(douarsLabelsLayer)){
        douarsLabelsLayer.addTo(map);
      }
    } else {
      if (douarsLabelsLayer && map.hasLayer(douarsLabelsLayer)){
        map.removeLayer(douarsLabelsLayer);
      }
    }
  }

  if (location.protocol !== "file:"){
    initSanteDataLoad().catch((err) => {
      console.warn("[SANTE_LOAD] init failed", err);
      logSanteReady();
    });
  } else {
    console.info("Mode fichier detecte : chargement GeoJSON desactive (file://).");
    logSanteReady();
  }

  if (typeof window !== "undefined"){
    window.__communeProfileDebug = window.__communeProfileDebug || {};
    window.__communeProfileDebug.computeCommuneCardModel = computeCommuneCardModel;
  }
  if (window) window.addEventListener("resize", () => scheduleLayoutResize(120));

  // === INIT MODAL CIBLAGE SANTÉ ===
  function initCiblageSanteModal(){
    const btn = document.getElementById("btnCiblageSanteFab");
    const modal = document.getElementById("ciblageSanteModal");
    const closeBtn = document.getElementById("ciblageSanteModalClose");
    const img = document.getElementById("ciblageSanteModalImg");
    if (!btn || !modal || !closeBtn || !img) return;

    const backdrop = modal.querySelector(".ciblage-modal__backdrop");

    function openModal(){
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    }
    function closeModal(){
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    }

    img.addEventListener("error", () => {
      console.warn("[CIBLAGE_SANTE] Image introuvable:", img.src);
    }, { once: true });

    btn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", closeModal);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });
  }

  // === INIT TOGGLE LINES PANEL ===
  function initLinesPanelToggle(){
    const linesPanel = document.getElementById("linesPanel");
    const btnHide = document.getElementById("btnHideLinesPanel");
    const btnShow = document.getElementById("btnShowLinesPanelFab");
    
    if (!linesPanel) return;
    
    // État initial : réduit par défaut
    let isCollapsed = localStorage.getItem("ui_linesPanelCollapsed") !== "false";
    
    function togglePanel(collapse){
      if (collapse){
        linesPanel.classList.add("is-collapsed");
        linesPanel.classList.remove("is-expanded");
        if (btnShow) {
          btnShow.setAttribute("aria-expanded", "false");
          btnShow.textContent = "▴";
          btnShow.title = "Afficher la comparaison";
        }
        if (btnHide) {
          btnHide.setAttribute("aria-expanded", "true");
          btnHide.style.display = "none";
        }
        isCollapsed = true;
      } else {
        linesPanel.classList.remove("is-collapsed");
        linesPanel.classList.add("is-expanded");
        if (btnShow) {
          btnShow.setAttribute("aria-expanded", "true");
          btnShow.textContent = "▾";
          btnShow.title = "Masquer la comparaison";
        }
        if (btnHide) {
          btnHide.setAttribute("aria-expanded", "false");
          btnHide.style.display = "";
        }
        isCollapsed = false;
      }
      localStorage.setItem("ui_linesPanelCollapsed", isCollapsed ? "true" : "false");
      
      // Redimensionner le graphique si nécessaire
      setTimeout(() => {
        if (linesChart && typeof linesChart.resize === "function"){
          linesChart.resize();
        }
        if (map) map.invalidateSize();
      }, 300);
    }
    
    // Appliquer l'état initial
    togglePanel(isCollapsed);
    
    // Bouton pour masquer (réduire)
    if (btnHide){
      btnHide.addEventListener("click", () => {
        togglePanel(true);
      });
    }
    
    // Bouton pour afficher/masquer (toggle)
    if (btnShow){
      btnShow.addEventListener("click", () => {
        togglePanel(!isCollapsed);
      });
    }
  }

  // init robuste (hub/iframe)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initCiblageSanteModal();
      initLinesPanelToggle();
    });
  } else {
    initCiblageSanteModal();
    initLinesPanelToggle();
  }

  function renderStaticProvinceStats(){
    const card = document.getElementById("statsCard");
    if (!card) return;

    card.innerHTML = `
      <div class="card-head kpi-head">
        <div class="card-title">Statistiques Globales</div>
        <div class="kpi-sub">santé</div>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Population totale (Province)</div>
          <div class="kpi-value">144 451</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Superficie (km²)</div>
          <div class="kpi-value">55 990</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Taux IPM Santé Provincial (%)</div>
          <div class="kpi-value">12,5%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Taux Handicap Provincial (%)</div>
          <div class="kpi-value">5,1%</div>
        </div>
      </div>
    `;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderStaticProvinceStats);
  } else {
    renderStaticProvinceStats();
  }
})();

// Side panel toggles (layout only)
  (() => {
    const side = document.getElementById("sidepanel");
    const btnToggle = document.getElementById("btnToggleSide");
    const btnCollapse = document.getElementById("btnCollapseSide");
    function toggleSide(){
      if (!side) return;
      side.classList.toggle("hidden");
      try{ window.dispatchEvent(new Event("resize")); }catch(_){}
    }
    if (btnToggle) btnToggle.addEventListener("click", toggleSide);
    if (btnCollapse) btnCollapse.addEventListener("click", toggleSide);
  })();

// file:// runtime guard (CORS)
  (() => {
    const banner = document.getElementById("fileProtocolBanner");
    const copyBat = document.getElementById("copyBat");
    const copyUrl = document.getElementById("copyUrl");

    const bat = "@echo off\n" +
      "cd /d D:\\webmapping-figuig\n" +
      "echo ===============================\n" +
      "echo  Serveur Web local (GeoJSON OK)\n" +
      "echo ===============================\n" +
      "python -m http.server 8080\n" +
      "pause";

    function copyText(t){
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve();
    }

    if (location.protocol === "file:"){
      if (banner) banner.style.display = "block";
      // Avoid trying to fetch geojson in file mode: it will be blocked anyway.
      console.warn("[CORS] file:// mode detected. Use a local HTTP server.");
    }

    if (copyBat) copyBat.addEventListener("click", (e) => {
      e.preventDefault();
      copyText(bat).then(()=>alert("start_server.bat copié. Colle-le dans un fichier .bat puis exécute-le."));
    });

    if (copyUrl) copyUrl.addEventListener("click", (e) => {
      e.preventDefault();
      copyText("http://localhost:8080/").then(()=>alert("URL copiée : http://localhost:8080/"));
    });
  })();

// Chart Tools: Agrandir + Export JPEG (standardisé pour tous les axes)
  (() => {
    const AXIS_KEY = "sante"; // Identifiant de l'axe
    
    function initChartTools() {
      const panelEl = document.querySelector("#linesPanel") || document.querySelector(".chart-panel");
      const focusBtn = document.querySelector('[data-action="chart-focus"]');
      const jpegBtn = document.querySelector('[data-action="chart-jpeg"]');
      
      // Récupérer l'instance du chart (scope-safe: uniquement window et DOM)
      function getChartInstance() {
        // Essayer window.linesChart d'abord (exposé après création dans renderCommuneLines)
        if (window.linesChart && window.linesChart.canvas) {
          return window.linesChart;
        }
        // Essayer communeLinesChart via window (compatibilité autres axes)
        if (window.communeLinesChart && window.communeLinesChart.canvas) {
          return window.communeLinesChart;
        }
        // Dernier recours : chercher via le canvas DOM (exposé sur canvas.chart)
        const canvas = document.getElementById("communeLinesChart");
        if (canvas && canvas.chart) {
          return canvas.chart;
        }
        return null;
      }
      
      // Guard : vérifier que le chart existe avant d'initialiser les outils
      const chartInstance = getChartInstance();
      if (!chartInstance) {
        console.warn("[CHART_TOOLS] linesChart missing; tools disabled");
        return;
      }
      
      if (focusBtn && panelEl) {
        focusBtn.addEventListener("click", function() {
          const inst = getChartInstance();
          if (inst && typeof window.toggleChartFocus === "function") {
            window.toggleChartFocus(panelEl, inst, "chart-focus");
          } else {
            console.warn("[ChartTools] Chart instance non disponible pour le focus");
          }
        });
      }
      
      if (jpegBtn) {
        jpegBtn.addEventListener("click", function() {
          const inst = getChartInstance();
          if (inst && typeof window.downloadChartAsJpeg === "function") {
            window.downloadChartAsJpeg(inst, "comparateur_" + AXIS_KEY, 0.95, "chart-focus");
          } else {
            console.warn("[ChartTools] Chart instance non disponible pour l'export JPEG");
          }
        });
      }
    }
    
    // Initialiser immédiatement si DOM est prêt, sinon attendre
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initChartTools);
    } else {
      // DOM déjà chargé, initialiser après un court délai pour laisser le temps au chart de se créer
      setTimeout(initChartTools, 100);
    }
  })();