// kpi.js - registry for commune KPI mapping (GeoJSON properties -> canonical keys).
(function(){
  "use strict";

  function coerceNumber(value){
    if (value === null || value === undefined) return NaN;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const raw = String(value).trim();
    if (!raw) return NaN;
    const cleaned = raw.replace(/\s+/g, "").replace("%", "").replace(",", ".");
    const n = Number(cleaned.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  // 1) Auto-list numeric KPI fields from a sample feature properties.
  function listNumericIndicators(sampleProps){
    if (!sampleProps || typeof sampleProps !== "object") return [];
    return Object.keys(sampleProps).filter((key) => {
      if (key === "Nom_Commun" || key === "Province") return false;
      return Number.isFinite(coerceNumber(sampleProps[key]));
    });
  }

  function clampPercent(value){
    if (!Number.isFinite(value)) return null;
    if (value < 0) return 0;
    if (value > 100) return 100;
    return value;
  }

  function escapeSvgText(value){
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function polarToCartesian(cx, cy, r, angleDeg){
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + (r * Math.cos(rad)),
      y: cy - (r * Math.sin(rad))
    };
  }

  function arcPath(cx, cy, r, startAngle, endAngle){
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = Math.abs(endAngle - startAngle) <= 180 ? 0 : 1;
    return "M " + start.x.toFixed(2) + " " + start.y.toFixed(2) +
      " A " + r + " " + r + " 0 " + largeArc + " 0 " +
      end.x.toFixed(2) + " " + end.y.toFixed(2);
  }

  const GAUGE_THEME_FALLBACK = {
    palette: ["#BFF7F0", "#34E6D2", "#18C6FF", "#2F7BFF", "#5B5FF5"],
    text: "#24324A",
    grid: "#E9F1F7",
    accent: "#18C6FF"
  };

  function getGaugeTheme(){
    if (typeof window !== "undefined" && typeof window.getThemePalette === "function"){
      const theme = window.getThemePalette() || {};
      const palette = Array.isArray(theme.gaugePalette) && theme.gaugePalette.length
        ? theme.gaugePalette.slice()
        : GAUGE_THEME_FALLBACK.palette.slice();
      return {
        palette,
        text: theme.textColor || GAUGE_THEME_FALLBACK.text,
        grid: theme.gridColor || GAUGE_THEME_FALLBACK.grid,
        accent: theme.accentColor || GAUGE_THEME_FALLBACK.accent
      };
    }
    return {
      palette: GAUGE_THEME_FALLBACK.palette.slice(),
      text: GAUGE_THEME_FALLBACK.text,
      grid: GAUGE_THEME_FALLBACK.grid,
      accent: GAUGE_THEME_FALLBACK.accent
    };
  }

  function getGaugePalette(direction, basePalette){
    const palette = Array.isArray(basePalette) && basePalette.length
      ? basePalette.slice()
      : GAUGE_THEME_FALLBACK.palette.slice();
    if (direction === "higher_is_worse") return palette;
    return palette.slice().reverse();
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

  function colorWithAlpha(hex, alpha){
    const rgb = hexToRgb(hex);
    if (!rgb) return "rgba(36,50,74," + alpha + ")";
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")";
  }

  function renderGaugeSVG(options){
    const opts = options || {};
    const valueRaw = Number(opts.valuePct);
    const valuePct = clampPercent(valueRaw);
    const displayText = opts.displayText != null
      ? String(opts.displayText)
      : (Number.isFinite(valueRaw) ? Math.round(valueRaw) + "%" : "\u2014");
    const ariaValue = opts.ariaValue != null ? String(opts.ariaValue) : displayText;
    const direction = opts.direction === "higher_is_worse" ? "higher_is_worse" : "higher_is_better";
    const inactiveMix = Number.isFinite(opts.inactiveMix) ? opts.inactiveMix : 0.45;
    const theme = getGaugeTheme();
    const palette = getGaugePalette(direction, theme.palette);
    const step = 100 / palette.length;
    const defaultSegments = palette.map((color, idx) => ({
      from: idx * step,
      to: idx === palette.length - 1 ? 100 : (idx + 1) * step,
      color
    }));
    const textColor = theme.text || GAUGE_THEME_FALLBACK.text;
    const textMuted = colorWithAlpha(textColor, 0.7);
    const textFaint = colorWithAlpha(textColor, 0.55);
    const tickColor = colorWithAlpha(textColor, 0.45);
    const trackColor = theme.grid || GAUGE_THEME_FALLBACK.grid;
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
    const trackPath = arcPath(cx, cy, radius, 180, 0);
    svg += "<path d=\"" + trackPath + "\" stroke=\"" + trackColor +
      "\" stroke-width=\"" + stroke + "\" />";
    segments.forEach((seg) => {
      const from = clampPercent(Number(seg.from));
      const to = clampPercent(Number(seg.to));
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
      let startAngle = pctToAngle(from);
      let endAngle = pctToAngle(to);
      startAngle = startAngle - gapDeg / 2;
      endAngle = endAngle + gapDeg / 2;
      if (startAngle <= endAngle) return;
      const path = arcPath(cx, cy, radius, startAngle, endAngle);
      const baseColor = seg.color || trackColor || "#e5e7eb";
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
      const needle = polarToCartesian(cx, cy, needleLen, angle);
      svg += "<line x1=\"" + cx.toFixed(2) + "\" y1=\"" + cy.toFixed(2) +
        "\" x2=\"" + needle.x.toFixed(2) + "\" y2=\"" + needle.y.toFixed(2) +
        "\" stroke=\"rgba(255,255,255,0.75)\" stroke-width=\"4\" stroke-linecap=\"round\" />";
      svg += "<line x1=\"" + cx.toFixed(2) + "\" y1=\"" + cy.toFixed(2) +
        "\" x2=\"" + needle.x.toFixed(2) + "\" y2=\"" + needle.y.toFixed(2) +
        "\" stroke=\"" + textColor + "\" stroke-width=\"2\" stroke-linecap=\"round\" />";
    }
    svg += "<circle cx=\"" + cx.toFixed(2) + "\" cy=\"" + cy.toFixed(2) +
      "\" r=\"4\" fill=\"" + textColor + "\" />";

    // Afficher la valeur au centre de la jauge, en vert et en gras
    const valueY = cy - radius * 0.55;
    svg += "<text x=\"" + cx.toFixed(2) + "\" y=\"" + valueY.toFixed(2) +
      "\" text-anchor=\"middle\" font-size=\"30\" font-weight=\"900\" fill=\"#16a34a\">" +
      escapeSvgText(displayText) + "</text>";

    // Ne plus afficher centerLabel et subLabel

    // Garder seulement le label à gauche (minLabel), supprimer le label à droite (maxLabel)
    const minPos = polarToCartesian(cx, cy, radius, 180);
    const labelY = cy + 12;
    svg += "<text x=\"" + minPos.x.toFixed(2) + "\" y=\"" + labelY +
      "\" text-anchor=\"start\" font-size=\"10\" fill=\"" + textFaint + "\">" +
      escapeSvgText(minLabel) + "</text>";

    if (Array.isArray(opts.ticks)){
      opts.ticks.forEach((tick) => {
        const val = clampPercent(Number(tick.value));
        if (!Number.isFinite(val) || val <= 0 || val >= 100) return;
        const angle = pctToAngle(val);
        const pos = polarToCartesian(cx, cy, radius + stroke / 2 + 6, angle);
        svg += "<text x=\"" + pos.x.toFixed(2) + "\" y=\"" + (pos.y - 2).toFixed(2) +
          "\" text-anchor=\"middle\" font-size=\"9\" fill=\"" + tickColor + "\">" +
          escapeSvgText(tick.label) + "</text>";
      });
    }

    svg += "</svg>";
    return svg;
  }

  const KPI_ICON_BASE = "assets/icons";
  const KPI_ICON_FALLBACK = KPI_ICON_BASE + "/emploi.png";

  // 2) Canonical KPI registry (10 indicators from socioeco.geojson).
  const KPI_REGISTRY = {
    population: {
      label: "Population 2024",
      prop: "Population 2024",
      unit: "hab",
      type: "count",
      format: "int",
      direction: "higher_is_better",
      palette: "blue",
      familyId: "demo",
      iconFile: "emploi.png"
    },
    pauvrete: {
      label: "Taux de pauvreté",
      prop: "Taux de pauvreté (en %)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_worse",
      palette: "traffic",
      familyId: "socio",
      iconFile: "taux-pauverete.png"
    },
    chomage: {
      label: "Taux de chômage",
      prop: "Taux de chômage (%)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_worse",
      palette: "traffic",
      familyId: "socio",
      iconFile: "taux-chaumage.png"
    },
    analphabetisme: {
      label: "Taux d'analphabétisme",
      prop: "Taux d'analphabétisme  (%)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_worse",
      palette: "traffic",
      familyId: "socio",
      iconFile: "taux-analphabetisme.png"
    },
    eau: {
      label: "Eau courante",
      prop: "Eau courante (%)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_better",
      palette: "traffic",
      familyId: "services",
      iconFile: "eau-potable.png"
    },
    electricite: {
      label: "Électricité",
      prop: "Électricité (%)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_better",
      palette: "traffic",
      familyId: "services",
      iconFile: "electricite.png"
    },
    assainissement: {
      label: "Accès à l'assainissement",
      prop: "Accès_à_Assainissement",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_better",
      palette: "traffic",
      familyId: "services",
      iconFile: "Assainissement.png"
    },
    activite: {
      label: "Taux d'activité",
      prop: "Taux d'activité (%)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_better",
      palette: "traffic",
      familyId: "capital",
      iconFile: "Taux-activite.png"
    },
    scolarisation: {
      label: "Taux de scolarisation",
      prop: "Taux de scolarisation (%)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_better",
      palette: "traffic",
      familyId: "capital",
      iconFile: "Taux-scolarisation.png"
    },
    vulnerabilite: {
      label: "Taux de vulnérabilité",
      prop: "Taux de vulnérabilité (en %)",
      unit: "%",
      type: "percent",
      format: "percent(1)",
      direction: "higher_is_worse",
      palette: "traffic",
      familyId: "socio",
      iconFile: "taux-vulnirabilite.png"
    },
  };
  const KPI_ORDER = [
    "pauvrete",
    "chomage",
    "analphabetisme",
    "vulnerabilite",
    "eau",
    "electricite",
    "assainissement",
    "scolarisation",
    "activite",
    "population"
  ];

  function getKpiIconUrl(kpiKey){
    const entry = KPI_REGISTRY[kpiKey];
    if (entry && entry.iconFile) return KPI_ICON_BASE + "/" + entry.iconFile;
    return KPI_ICON_FALLBACK;
  }

  // Expose for app.js (non-module).
  if (typeof window !== "undefined"){
    window.KPI_REGISTRY = KPI_REGISTRY;
    window.KPI_ORDER = KPI_ORDER;
    window.listNumericIndicators = listNumericIndicators;
    window.getKpiIconUrl = getKpiIconUrl;
    window.KPI_ICON_FALLBACK = KPI_ICON_FALLBACK;
    window.renderGaugeSVG = renderGaugeSVG;
  }
})();
