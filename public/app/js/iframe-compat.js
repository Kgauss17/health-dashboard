/**
 * iframe-compat.js
 * Compatibilité iframe pour Leaflet et Chart.js
 * Garantit le bon recalcul des tailles quand un module est chargé dans une iframe
 */
(function() {
  'use strict';

  // Détecter si on est dans une iframe
  const inIframe = window.self !== window.top;

  if (!inIframe) {
    // Pas dans une iframe, ne rien faire
    return;
  }

  // Fonction pour invalider Leaflet et redimensionner Chart.js
  function invalidateSizes() {
    // Leaflet: invalider la taille de la carte
    try {
      // Méthode 1: window.map (si exposé globalement par le module)
      if (typeof window !== 'undefined' && window.map && typeof window.map.invalidateSize === 'function') {
        window.map.invalidateSize(true);
      } else {
        // Méthode 2: Déclencher un event resize global (Leaflet écoute window resize)
        // Leaflet écoute naturellement les événements resize pour invalider automatiquement
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          // Créer et dispatcher un événement resize
          try {
            const resizeEvent = new Event('resize', { bubbles: true, cancelable: true });
            window.dispatchEvent(resizeEvent);
          } catch (e) {
            // Fallback pour anciens navigateurs
            try {
              const resizeEvent = document.createEvent('UIEvents');
              resizeEvent.initEvent('resize', true, false);
              window.dispatchEvent(resizeEvent);
            } catch (e2) {
              // Dernier recours: déclencher manuellement
              if (window.onresize && typeof window.onresize === 'function') {
                window.onresize();
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[iframe-compat] Erreur lors de l\'invalidation Leaflet:', e);
    }

    // Chart.js: redimensionner tous les charts
    try {
      // Méthode 1: Chart.js v3+ via Chart.instances (si disponible)
      if (typeof Chart !== 'undefined') {
        if (Chart.instances && typeof Chart.instances.forEach === 'function') {
          Chart.instances.forEach(function(chart) {
            if (chart && typeof chart.resize === 'function') {
              chart.resize();
            }
          });
        }
        // Méthode 2: Chart.js stocke aussi dans Chart.registry
        if (Chart.registry && Chart.registry.getAll) {
          const allCharts = Chart.registry.getAll();
          if (allCharts) {
            allCharts.forEach(function(chart) {
              if (chart && typeof chart.resize === 'function') {
                chart.resize();
              }
            });
          }
        }
      }
      // Méthode 3: Chercher les variables chart courantes via window
      if (typeof window !== 'undefined') {
        // Variables communes: legendChart, radarChart, podiumChart, communeLinesChart, linesChart
        const chartNames = ['legendChart', 'radarChart', 'podiumChart', 'communeLinesChart', 'linesChart'];
        chartNames.forEach(function(chartName) {
          if (window[chartName] && typeof window[chartName].resize === 'function') {
            window[chartName].resize();
          }
        });
      }
    } catch (e) {
      console.warn('[iframe-compat] Erreur lors du redimensionnement Chart.js:', e);
    }
  }

  // Handler pour les messages du parent (hub)
  function handleMessage(event) {
    // Sécurité: vérifier l'origine si nécessaire (optionnel pour développement)
    // if (event.origin !== 'http://localhost:8080') return;

    if (event.data && event.data.type === 'HUB:VISIBLE') {
      // L'iframe devient visible, invalider les tailles
      requestAnimationFrame(function() {
        setTimeout(function() {
          invalidateSizes();
        }, 50);
      });
    }
  }

  // Écouter les messages du parent
  window.addEventListener('message', handleMessage);

  // Fallback: invalider une fois au chargement initial avec délai
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      requestAnimationFrame(function() {
        setTimeout(function() {
          invalidateSizes();
        }, 200);
      });
    });
  } else {
    // DOM déjà chargé
    requestAnimationFrame(function() {
      setTimeout(function() {
        invalidateSizes();
      }, 200);
    });
  }

  // Observer les changements de visibilité (fallback supplémentaire)
  if (typeof document.hidden !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        // Page devient visible
        requestAnimationFrame(function() {
          setTimeout(function() {
            invalidateSizes();
          }, 100);
        });
      }
    });
  }

  console.log('[iframe-compat] Script de compatibilité iframe activé');
})();
