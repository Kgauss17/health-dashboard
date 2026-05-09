/**
 * Helpers globaux pour les graphiques Chart.js
 * - toggleChartFocus: Active/désactive le mode focus
 * - downloadChartAsJpeg: Exporte le graphique en JPEG
 */

(function() {
  'use strict';

  /**
   * Active/désactive le mode focus du graphique
   * @param {HTMLElement} panelEl - L'élément panel qui contient le graphique
   * @param {Chart} chartInstance - L'instance Chart.js
   * @param {string} bodyClass - Classe CSS à ajouter au body (défaut: "chart-focus")
   */
  window.toggleChartFocus = function(panelEl, chartInstance, bodyClass) {
    bodyClass = bodyClass || "chart-focus";
    
    document.body.classList.toggle(bodyClass);

    // Marquer le panel si utile (optionnel)
    if (panelEl) {
      panelEl.classList.toggle("is-focused", document.body.classList.contains(bodyClass));
    }

    // Reflow Chart.js après changement layout
    requestAnimationFrame(function() {
      if (chartInstance && typeof chartInstance.resize === "function") {
        chartInstance.resize();
      }
      if (chartInstance && typeof chartInstance.update === "function") {
        chartInstance.update("none");
      }
    });
  };

  /**
   * Télécharge le graphique en JPEG
   * @param {Chart} chart - L'instance Chart.js
   * @param {string} filenameBase - Nom de base du fichier (sans extension)
   * @param {number} quality - Qualité JPEG (0-1, défaut: 0.95)
   * @param {string} focusClassFallback - Classe CSS de fallback pour détecter le focus (défaut: "chart-focus")
   */
  window.downloadChartAsJpeg = function(chart, filenameBase, quality, focusClassFallback) {
    if (!chart || !chart.canvas) {
      console.warn("downloadChartAsJpeg: chart ou canvas manquant");
      return;
    }

    quality = quality || 0.95;
    focusClassFallback = focusClassFallback || "chart-focus";

    const isFocus =
      document.body.classList.contains(focusClassFallback) ||
      document.body.classList.contains("lines-focus"); // compat si certains axes utilisent lines-focus

    const filename = filenameBase + (isFocus ? "_focus" : "") + ".jpg";

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
  };

})();
