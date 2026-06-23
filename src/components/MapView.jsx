import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { subscribeToPins } from '../utils/db'
import { getAnonColour, getCountryColour } from '../utils/identity'
import { countryFlag } from '../utils/presence'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getSubsolarPoint, getTerminatorGeoJSON, isPinInNight } from '../utils/solarPosition'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const CLUSTER_ZOOM = 9   // below this: show clusters; above: show markers

const MOOD_COLORS = {
  '😊': '#e8c468',
  '😌': '#06D6A0',
  '🥳': '#FFB703',
  '🤔': '#81B29A',
  '😔': '#5B8AF5',
  '😰': '#E07A5F',
  '😤': '#FB5607',
  '😴': '#8338EC',
}
const MOOD_LIST = Object.keys(MOOD_COLORS)

// Sum 1 per pin per mood so each cluster carries a per-mood count
const CLUSTER_MOOD_PROPS = Object.fromEntries(
  MOOD_LIST.map(m => [m, ['+', ['case', ['==', ['get', 'mood'], m], 1, 0]]])
)

// Pick the color of whichever mood has the highest count in the cluster
const CLUSTER_MOOD_COLOR = (() => {
  const parts = []
  MOOD_LIST.forEach(mood => {
    const others = MOOD_LIST.filter(m => m !== mood)
    const cond = ['all', ...others.map(o => ['>=', ['get', mood], ['get', o]])]
    parts.push(cond, MOOD_COLORS[mood])
  })
  return ['case', ...parts, 'rgba(91,138,245,0.55)']
})()

const PIN_STYLE = `
  .hay-pin-wrap {
    position: relative;
    width: 40px;
    height: 40px;
  }

  /* ── Own pin: golden border ───────────────────── */
  .hay-pin-wrap--own .hay-pin {
    border: 2.5px solid rgba(255, 205, 55, 0.9) !important;
    box-shadow: 0 0 0 2px rgba(255, 205, 55, 0.22), 0 2px 8px rgba(0,0,0,0.35);
  }
  .hay-pin-wrap--own .hay-pin-mood {
    border-color: rgba(255, 205, 55, 0.6);
  }

  /* ── Streak glow ring ──────────────────────────── */
  .hay-pin-wrap--streak::after {
    content: '';
    position: absolute;
    inset: -7px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(93,227,174,0) 38%, rgba(93,227,174,0.45) 68%, rgba(93,227,174,0) 100%);
    animation: streakGlow 2.5s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  @keyframes streakGlow {
    0%,100% { opacity: 0.5; transform: scale(1); }
    50%      { opacity: 1;   transform: scale(1.18); }
  }

  .hay-pin {
    position: relative;
    z-index: 1;
    width: 40px;
    height: 40px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2.5px solid rgba(255,255,255,0.85);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.45);
  }
  .hay-pin:hover { transform: rotate(-45deg) scale(1.15); box-shadow: 0 6px 24px rgba(0,0,0,0.55); }
  .hay-pin-inner { transform: rotate(45deg); font-size: 18px; line-height: 1; user-select: none; }
  .hay-pin--own      { border-color: rgba(255,255,255,1); box-shadow: 0 0 0 3px rgba(255,255,255,0.25), 0 4px 16px rgba(0,0,0,0.45); }
  .hay-pin--verified { border-color: #5de3ae; }
  .hay-pin--night    { border-color: rgba(255,180,80,0.6); filter: brightness(0.72) sepia(0.3); }

  /* ── Flash pin ─────────────────────────────────── */
  .hay-pin--flash {
    border-style: dashed;
    animation: flashPulse 1.1s ease-in-out infinite;
  }
  @keyframes flashPulse {
    0%,100% { opacity: 1;   box-shadow: 0 4px 16px rgba(255,200,60,0.4); }
    50%      { opacity: 0.6; box-shadow: 0 4px 24px rgba(255,200,60,0.7); }
  }

  /* ── Message-carrying pin — slow outer glow ─────── */
  @media (prefers-reduced-motion: no-preference) {
    .hay-pin--has-message {
      animation: msgGlow 2.5s ease-in-out infinite;
    }
    @keyframes msgGlow {
      0%,100% { box-shadow: 0 4px 16px rgba(0,0,0,0.45), 0 0 0 0   rgba(232,196,104,0); }
      50%     { box-shadow: 0 4px 16px rgba(0,0,0,0.45), 0 0 10px 4px rgba(232,196,104,0.6); }
    }
  }

  /* ── Flash countdown badge ─────────────────────── */
  .hay-flash-badge {
    position: absolute;
    top: -7px;
    right: -7px;
    min-width: 18px;
    height: 18px;
    padding: 0 3px;
    border-radius: 999px;
    background: #f5a623;
    border: 2px solid #0f1117;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 700;
    color: #0f1117;
    pointer-events: none;
    z-index: 4;
    font-family: system-ui, sans-serif;
    letter-spacing: -0.03em;
  }

  /* ── Verified badge ────────────────────────────── */
  .hay-pin-badge {
    position: absolute; top: -5px; right: -5px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #1D9E75; border: 2px solid #0f1117;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; color: #fff; font-weight: 700;
    pointer-events: none; z-index: 2;
  }

  /* ── Delete button ─────────────────────────────── */
  .hay-pin-delete {
    position: absolute; top: -7px; left: -7px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #e84040; border: 2px solid #0f1117;
    color: #fff; font-size: 9px; font-weight: 700;
    cursor: pointer; display: none; align-items: center; justify-content: center;
    z-index: 3; line-height: 1; font-family: system-ui, sans-serif; padding: 0;
    transition: background 0.15s, transform 0.12s;
  }
  .hay-pin-delete:hover  { background: #c0392b; transform: scale(1.2); }
  .hay-pin-delete:active { transform: scale(0.95); }

  /* ── Top-of-page delete banner ────────────────────────── */
  .hay-delete-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: linear-gradient(135deg, #c0392b, #e84040);
    color: #fff; display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; padding: 0.9rem 1.25rem;
    box-shadow: 0 4px 24px rgba(232,64,64,0.45);
    font-family: system-ui, sans-serif;
    animation: bannerSlideDown 0.28s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes bannerSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .hay-delete-banner-msg { font-size: 14px; font-weight: 600; flex: 1; }
  .hay-delete-banner-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
  .hay-delete-banner-yes, .hay-delete-banner-no {
    border: none; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 700; padding: 6px 16px; line-height: 1.4;
    font-family: system-ui, sans-serif; transition: opacity 0.15s, transform 0.12s;
  }
  .hay-delete-banner-yes:hover, .hay-delete-banner-no:hover { opacity: 0.85; transform: scale(1.04); }
  .hay-delete-banner-yes { background: #fff; color: #c0392b; }
  .hay-delete-banner-no  { background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); }

  /* ── Message badge ─────────────────────────────── */
  .hay-msg-badge {
    position: absolute; bottom: -6px; left: -6px;
    width: 22px; height: 22px; border-radius: 50%;
    background: #5b8af5; border: 2px solid #0f1117;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; color: #fff; pointer-events: none; z-index: 2;
    animation: msgPop 0.3s cubic-bezier(0.22,1,0.36,1) both,
               msgPulse 2s ease-in-out 0.3s infinite;
  }
  @keyframes msgPop   { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes msgPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(91,138,245,0.6); } 50% { box-shadow: 0 0 0 6px rgba(91,138,245,0); } }

  /* ── Mood badge (bottom-right corner of pin) ────── */
  .hay-pin-mood {
    position: absolute; bottom: -5px; right: -5px;
    width: 18px; height: 18px; border-radius: 50%;
    background: rgba(15,17,23,0.88); border: 1.5px solid rgba(255,255,255,0.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; pointer-events: none; z-index: 4;
  }

  /* ── Cry for Help / SOS pin ─────────────────────── */
  .hay-pin-wrap--sos::before,
  .hay-pin-wrap--sos::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    background: none !important;
    border: 2px solid rgba(240, 80, 80, 0.55);
    animation: sosRing 1.4s ease-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  .hay-pin-wrap--sos::before { inset: -9px; }
  .hay-pin-wrap--sos::after  { inset: -18px; animation-delay: 0.38s; }
  @keyframes sosRing {
    0%   { opacity: 0.85; transform: scale(0.9); }
    100% { opacity: 0;    transform: scale(1.5); }
  }
  .hay-pin-wrap--sos .hay-pin { border-color: rgba(240, 90, 90, 0.92) !important; }

  /* ── Location preview pulse ─────────────────────── */
  .hay-preview-pin {
    width: 16px; height: 16px; border-radius: 50%;
    background: rgba(91,138,245,0.9); border: 2.5px solid #fff;
    animation: previewPulse 1.5s ease-out infinite;
  }
  @keyframes previewPulse {
    0%   { box-shadow: 0 0 0 0 rgba(91,138,245,0.5); }
    70%  { box-shadow: 0 0 0 14px rgba(91,138,245,0); }
    100% { box-shadow: 0 0 0 0 rgba(91,138,245,0); }
  }

  /* ── Press-and-hold charge ring ─────────────────── */
  .hay-charge-wrap {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 15;
    pointer-events: none;
  }
  .hay-charge-ring {
    width: 56px; height: 56px; border-radius: 50%;
    background: conic-gradient(rgba(91,138,245,0.9) calc(var(--p,0) * 1%), rgba(255,255,255,0.12) 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
  }
  .hay-charge-ghost {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -200%);
    font-size: 20px; opacity: 0.65;
  }

  /* ── Mood drop popover ──────────────────────────── */
  .hay-mood-pop {
    position: absolute;
    transform: translate(-50%, calc(-100% - 18px));
    background: var(--pin-popup-bg, rgba(20,22,30,0.97));
    border: 1px solid var(--pin-popup-border, rgba(255,255,255,0.12));
    border-radius: 16px; padding: 8px;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;
    width: 196px;
    opacity: 0; pointer-events: none;
    transition: opacity 0.18s ease, transform 0.18s ease;
    z-index: 30;
  }
  .hay-mood-pop.hay-mood-pop--show {
    opacity: 1; pointer-events: auto;
    transform: translate(-50%, calc(-100% - 10px));
  }
  .hay-mood-pop button {
    font-size: 18px; width: 40px; height: 40px;
    border-radius: 10px;
    background: var(--pin-popup-btn, rgba(255,255,255,0.05));
    border: 1px solid var(--pin-popup-btn-border, rgba(255,255,255,0.08));
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.12s;
  }
  .hay-mood-pop button:active { background: rgba(91,138,245,0.25); }

  /* ── Short-press hint toast ─────────────────────── */
  .hay-hint-toast {
    position: absolute;
    transform: translate(-50%, -145%);
    background: var(--pin-popup-bg, rgba(20,22,30,0.95));
    border: 1px solid var(--pin-popup-border, rgba(255,255,255,0.1));
    color: var(--ink-2, rgba(255,255,255,0.6));
    font-size: 11.5px; padding: 7px 12px;
    border-radius: 10px;
    opacity: 0; transition: opacity 0.22s ease;
    pointer-events: none; z-index: 30;
    white-space: nowrap; font-family: system-ui, sans-serif;
  }
  .hay-hint-toast--show { opacity: 1; }

  /* ── Land ring (drop confirmation ripple) ───────── */
  .hay-land-ring {
    position: absolute; border-radius: 50%;
    width: 12px; height: 12px;
    transform: translate(-50%, -50%);
    border: 1.5px solid rgba(91,138,245,0.65);
    pointer-events: none; z-index: 11;
    animation: hayLandRing 0.85s ease-out forwards;
  }
  @media (prefers-reduced-motion: reduce) { .hay-land-ring { display: none; } }
  @keyframes hayLandRing {
    0%   { width: 12px;  height: 12px;  opacity: 0.9; }
    100% { width: 96px;  height: 96px;  opacity: 0; }
  }

  /* ── New-drop pin entry bounce ───────────────────── */
  @media (prefers-reduced-motion: no-preference) {
    .hay-pin-wrap--new-drop {
      animation: hayPinDrop 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
    }
  }
  @keyframes hayPinDrop {
    from { opacity: 0; transform: translateY(-40%) scale(0.5); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Reduced-motion pulse fallback (static dot) ────── */
  .hay-globe-pulse-dot {
    position: absolute;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: rgba(91,138,245,0.85);
    transform: translate(-50%, -50%);
    pointer-events: none; z-index: 20;
  }
`

function buildGeoJSON(pins) {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, mood: p.mood || '💬' },
    })),
  }
}

const PANEL_WIDTH = 480 // must match .pins-panel desktop width in App.css

export default function MapView({
  onPinClick, onMapClick, onDeletePin,
  userLocation, unreadPinIds, activePinId,
  onNeighbourhoodClick, onFirstPins, previewLocation, onHoldDrop,
  onFlyTo, theme, panelOpen,
  rotateGlobe = true, clusterPins = true, showHeatmap = false,
}) {
  const mapContainer      = useRef(null)
  const map               = useRef(null)
  const markersRef        = useRef({})
  const previewMarkerRef  = useRef(null)
  const styleInjected     = useRef(false)
  const firstPinsFired    = useRef(false)
  const unreadPinIdsRef   = useRef(unreadPinIds)
  const lastHoldDropAtRef = useRef(0)
  const knownPinIdsRef    = useRef(new Set())
  const seenFirstSnapshot = useRef(false)
  const pulseCanvasRef    = useRef(null)
  const pulsesRef         = useRef([])
  const panelOpenRef      = useRef(panelOpen)
  panelOpenRef.current    = panelOpen
  const rotateGlobeRef = useRef(rotateGlobe)
  const clusterPinsRef = useRef(clusterPins)
  const [mapReady, setMapReady] = useState(false)
  const { user } = useAuth()
  const showToast    = useToast()
  const showToastRef = useRef(showToast)

  // Always-fresh callback refs — never stale, never in effect deps
  const onPinClickRef           = useRef(onPinClick)
  const onDeletePinRef          = useRef(onDeletePin)
  const onMapClickRef           = useRef(onMapClick)
  const onHoldDropRef           = useRef(onHoldDrop)
  const onNeighbourhoodClickRef = useRef(onNeighbourhoodClick)
  const onFirstPinsRef          = useRef(onFirstPins)
  onPinClickRef.current           = onPinClick
  onDeletePinRef.current          = onDeletePin
  onMapClickRef.current           = onMapClick
  onHoldDropRef.current           = onHoldDrop
  onNeighbourhoodClickRef.current = onNeighbourhoodClick
  onFirstPinsRef.current          = onFirstPins
  unreadPinIdsRef.current         = unreadPinIds
  showToastRef.current            = showToast

  // ── Adjust map padding when the feed panel opens / closes ────────────────

  useEffect(() => {
    if (!mapReady || !map.current) return
    const padding = panelOpen && window.innerWidth >= 640 ? { right: PANEL_WIDTH } : {}
    map.current.easeTo({ padding, duration: 300 })
  }, [panelOpen, mapReady])

  // ── Toggle heatmap visibility ─────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !map.current) return
    try { map.current.setLayoutProperty('mood-heatmap', 'visibility', showHeatmap ? 'visible' : 'none') } catch {}
  }, [showHeatmap, mapReady])

  // ── Sync marker visibility to current zoom level ──────────────────────────

  function syncMarkerVisibility() {
    if (!map.current) return
    const show = !clusterPinsRef.current || map.current.getZoom() > CLUSTER_ZOOM
    Object.values(markersRef.current).forEach(({ wrap }) => {
      wrap.style.opacity       = show ? '1' : '0'
      wrap.style.pointerEvents = show ? 'auto' : 'none'
    })
  }

  // ── Update neighbourhood GeoJSON source ───────────────────────────────────

  function updateNeighbourhoods(pins) {
    const src = map.current?.getSource?.('neighbourhoods')
    if (src) src.setData(buildGeoJSON(pins))
    const hsrc = map.current?.getSource?.('heatmap-src')
    if (hsrc) hsrc.setData(buildGeoJSON(pins))
  }

  // ── Map initialisation — runs once ───────────────────────────────────────

  useEffect(() => {
    if (map.current) return

    if (!styleInjected.current) {
      const style = document.createElement('style')
      style.textContent = PIN_STYLE
      document.head.appendChild(style)
      styleInjected.current = true
    }

    map.current = new mapboxgl.Map({
      container:  mapContainer.current,
      style:      theme === 'light' ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11',
      center:     userLocation ? [userLocation.lng, userLocation.lat] : [0, 20],
      zoom:       userLocation ? 13 : 2,
      projection: 'globe',
      attributionControl: false,
    })

    // Expose flyTo to parent — include panel padding so Mapbox centres
    // the destination in the visible area, not behind the feed panel.
    onFlyTo?.((opts) => {
      const padding = panelOpenRef.current && window.innerWidth >= 640
        ? { right: PANEL_WIDTH } : {}
      map.current?.flyTo({ ...opts, padding })
    })

    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.current.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: false, showUserLocation: false }), 'bottom-right')

    map.current.on('load', () => {
      // ── Globe atmosphere ─────────────────────────────────────────────────
      if (theme === 'light') {
        map.current.setFog({
          color:            'rgb(200, 220, 240)',
          'high-color':     'rgb(80, 130, 210)',
          'horizon-blend':  0.07,
          'space-color':    'rgb(4, 6, 18)',
          'star-intensity': 0.45,
        })
      } else {
        map.current.setFog({
          color:            'rgb(8, 10, 22)',
          'high-color':     'rgb(28, 55, 125)',
          'horizon-blend':  0.07,
          'space-color':    'rgb(2, 3, 10)',
          'star-intensity': 0.62,
        })
      }

      // ── Brighten map label text ──────────────────────────────────────────
      if (theme !== 'light') {
        map.current.getStyle().layers.forEach(layer => {
          if (layer.type === 'symbol') {
            try { map.current.setPaintProperty(layer.id, 'text-color', '#ffffff') } catch {}
            try { map.current.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0,0,10,0.55)') } catch {}
            try { map.current.setPaintProperty(layer.id, 'text-halo-width', 1) } catch {}
          }
        })
      }

      // ── Day/night terminator ─────────────────────────────────────────────
      map.current.addSource('terminator', {
        type: 'geojson',
        data: getTerminatorGeoJSON(new Date()),
      })

      // Wide faint glow underneath
      map.current.addLayer({
        id:     'terminator-glow',
        type:   'line',
        source: 'terminator',
        paint: {
          'line-color': '#ff8c3a',
          'line-width': 8,
          'line-blur':  10,
          'line-opacity': 0.22,
        },
      })

      // Crisp warm line on top
      map.current.addLayer({
        id:     'terminator-line',
        type:   'line',
        source: 'terminator',
        paint: {
          'line-color': '#ffaa64',
          'line-width': 1.4,
          'line-blur':  0.8,
          'line-opacity': 0.75,
        },
      })

      // Night-side fill — added before neighbourhoods source exists,
      // so it naturally renders below the cluster bubbles.
      map.current.addLayer({
        id:     'terminator-fill',
        type:   'fill',
        source: 'terminator',
        paint: {
          'fill-color':   'rgba(10,12,20,0.38)',
          'fill-opacity': 1,
        },
      })

      // ── Mood heatmap (non-clustered; toggled via showHeatmap prop) ────────
      map.current.addSource('heatmap-src', {
        type: 'geojson',
        data: buildGeoJSON([]),
      })
      map.current.addLayer({
        id:     'mood-heatmap',
        type:   'heatmap',
        source: 'heatmap-src',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight':    1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 12, 2],
          'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 0, 20, 12, 60],
          'heatmap-opacity':   0.75,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(91,138,245,0)',
            0.2, 'rgba(91,138,245,0.5)',
            0.5, 'rgba(232,196,104,0.8)',
            0.8, 'rgba(251,86,7,0.9)',
            1.0, 'rgba(232,64,64,1)',
          ],
        },
      })

      // ── Neighbourhood clustering ─────────────────────────────────────────
      map.current.addSource('neighbourhoods', {
        type:              'geojson',
        data:              buildGeoJSON([]),
        cluster:           true,
        clusterMaxZoom:    CLUSTER_ZOOM,
        clusterRadius:     60,
        clusterProperties: CLUSTER_MOOD_PROPS,
      })

      // Cluster bubble
      map.current.addLayer({
        id:     'nh-clusters',
        type:   'circle',
        source: 'neighbourhoods',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color':        CLUSTER_MOOD_COLOR,
          'circle-radius':       ['step', ['get', 'point_count'], 24, 5, 33, 20, 44],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': 'rgba(255,255,255,0.28)',
          'circle-blur':         0.25,
          'circle-opacity':      0.92,
        },
      })

      // Cluster count text
      map.current.addLayer({
        id:     'nh-cluster-count',
        type:   'symbol',
        source: 'neighbourhoods',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font':  ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size':  13,
        },
        paint: { 'text-color': '#fff' },
      })

      // Unclustered single pins — small emoji dot visible at low zoom
      // (clustered ones are shown by nh-clusters; isolated single points need their own layer)
      map.current.addLayer({
        id:     'nh-unclustered',
        type:   'symbol',
        source: 'neighbourhoods',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field':         ['get', 'mood'],
          'text-font':          ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size':          18,
          'text-allow-overlap': true,
        },
        paint: { 'text-opacity': 0.85 },
      })

      // Cluster click → compute dominant mood → call handler
      map.current.on('click', 'nh-clusters', (e) => {
        e.preventDefault()
        const features  = map.current.queryRenderedFeatures(e.point, { layers: ['nh-clusters'] })
        const clusterId = features[0]?.properties?.cluster_id
        if (!clusterId) return

        map.current.getSource('neighbourhoods').getClusterLeaves(clusterId, Infinity, 0, (err, leaves) => {
          if (err || !leaves?.length) return
          const moodCount = {}
          leaves.forEach((f) => {
            const m = f.properties?.mood || '💬'
            moodCount[m] = (moodCount[m] || 0) + 1
          })
          const dominantMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '💬'
          onNeighbourhoodClickRef.current?.({ mood: dominantMood, count: leaves.length })
        })
      })

      map.current.on('mouseenter', 'nh-clusters', () => { map.current.getCanvas().style.cursor = 'pointer' })
      map.current.on('mouseleave', 'nh-clusters', () => { map.current.getCanvas().style.cursor = '' })

      setMapReady(true)
      syncMarkerVisibility()
    })

    // ── Press-and-hold pin drop ──────────────────────────────────────────────
    const container = mapContainer.current
    const HOLD_MS   = 550
    const MOODS_POP = [
      '😊', '😔', '😤', '😴',
      '🤔', '🥳', '😰', '😌',
      '😢', '😡', '🤗', '🥺',
      '😶', '🤩', '🫶', '🥱',
    ]
    const holdState = {
      rafId: null, timerId: null, chargeEl: null,
      startPt: null, lngLat: null,
      startClientX: 0, startClientY: 0, downTime: 0,
    }

    function showHint(pt) {
      const el = document.createElement('div')
      el.className   = 'hay-hint-toast'
      el.textContent = 'Press & hold to drop a pin'
      el.style.left  = pt.x + 'px'
      el.style.top   = pt.y + 'px'
      container.appendChild(el)
      requestAnimationFrame(() => el.classList.add('hay-hint-toast--show'))
      setTimeout(() => {
        el.classList.remove('hay-hint-toast--show')
        setTimeout(() => el.remove(), 250)
      }, 1200)
    }

    function dropMood(pt, lngLat, mood) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const ring = document.createElement('div')
        ring.className = 'hay-land-ring'
        ring.style.left = pt.x + 'px'
        ring.style.top  = pt.y + 'px'
        container.appendChild(ring)
        setTimeout(() => ring.remove(), 900)
      }
      lastHoldDropAtRef.current = Date.now()
      onHoldDropRef.current?.({ lat: lngLat.lat, lng: lngLat.lng }, mood, { x: pt.x, y: pt.y })
    }

    function armDrop() {
      const { chargeEl, startPt, lngLat } = holdState
      if (chargeEl) { chargeEl.remove(); holdState.chargeEl = null }

      const pop = document.createElement('div')
      pop.className  = 'hay-mood-pop'
      pop.style.left = startPt.x + 'px'
      pop.style.top  = startPt.y + 'px'

      function closeOnOutside(e) {
        if (!pop.contains(e.target)) {
          pop.remove()
          document.removeEventListener('pointerdown', closeOnOutside)
        }
      }

      MOODS_POP.forEach((mood) => {
        const btn = document.createElement('button')
        btn.textContent = mood
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          pop.remove()
          document.removeEventListener('pointerdown', closeOnOutside)
          dropMood(startPt, lngLat, mood)
        })
        pop.appendChild(btn)
      })

      setTimeout(() => document.addEventListener('pointerdown', closeOnOutside), 0)
      container.appendChild(pop)
      requestAnimationFrame(() => pop.classList.add('hay-mood-pop--show'))
    }

    function cancelCharge(showHintToast) {
      if (holdState.rafId)   { cancelAnimationFrame(holdState.rafId); holdState.rafId = null }
      if (holdState.timerId) { clearTimeout(holdState.timerId); holdState.timerId = null }
      if (holdState.chargeEl) {
        const pVal = parseInt(
          holdState.chargeEl.querySelector('.hay-charge-ring')?.style.getPropertyValue('--p') || '0',
          10
        )
        if (showHintToast && pVal < 70 && holdState.startPt) showHint(holdState.startPt)
        holdState.chargeEl.remove()
        holdState.chargeEl = null
      }
    }

    function handlePointerDown(e) {
      if (e.button && e.button !== 0) return
      if (e.target.closest('.hay-pin-wrap') ||
          e.target.closest('.mapboxgl-control-container') ||
          e.target.closest('.hay-mood-pop') ||
          e.target.closest('.hay-hint-toast')) return
      // If the mood picker is open (user tapping outside it), let closeOnOutside
      // dismiss it — do NOT start a new charge from the same tap.
      if (container.querySelector('.hay-mood-pop')) return

      cancelCharge(false)

      const rect = container.getBoundingClientRect()
      const px   = e.clientX - rect.left
      const py   = e.clientY - rect.top
      holdState.startPt      = { x: px, y: py }
      holdState.startClientX = e.clientX
      holdState.startClientY = e.clientY
      holdState.downTime     = performance.now()
      holdState.lngLat = map.current.unproject([px, py])
      // Bail out when clicking outside the globe sphere (unproject returns NaN in globe projection)
      const _ll = holdState.lngLat
      if (!_ll || !isFinite(_ll.lat) || !isFinite(_ll.lng) || Math.abs(_ll.lat) > 90 || Math.abs(_ll.lng) > 180) return

      const chargeEl = document.createElement('div')
      chargeEl.className = 'hay-charge-wrap'
      chargeEl.style.left = px + 'px'
      chargeEl.style.top  = py + 'px'
      chargeEl.innerHTML  = '<div class="hay-charge-ring"></div><div class="hay-charge-ghost">📍</div>'
      container.appendChild(chargeEl)
      holdState.chargeEl = chargeEl

      // Always use setTimeout for the arm trigger so cancelCharge() can reliably
      // stop it with clearTimeout even when pointerup is intercepted by Mapbox.
      holdState.timerId = setTimeout(() => { if (holdState.chargeEl) armDrop() }, HOLD_MS)

      // RAF is purely visual — updates the progress ring, never triggers armDrop.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const ringEl = chargeEl.querySelector('.hay-charge-ring')
        const t0 = performance.now()
        function tick(now) {
          const progress = Math.min(1, (now - t0) / HOLD_MS)
          ringEl.style.setProperty('--p', Math.round(progress * 100))
          if (progress < 1 && holdState.chargeEl) {
            holdState.rafId = requestAnimationFrame(tick)
          }
        }
        holdState.rafId = requestAnimationFrame(tick)
      }
    }

    function handlePointerUp() {
      const elapsed = performance.now() - holdState.downTime
      const lngLat  = holdState.lngLat
      // Reset first so any duplicate / late pointerup is a safe no-op
      holdState.downTime = 0
      holdState.lngLat   = null
      cancelCharge(true)
      // Short tap — forward to map-click handler (e.g. close open panel)
      if (elapsed < 200 && lngLat) {
        onMapClickRef.current?.({ lat: lngLat.lat, lng: lngLat.lng })
      }
    }

    function handlePointerMove(e) {
      if (!holdState.chargeEl) return
      const dx = e.clientX - holdState.startClientX
      const dy = e.clientY - holdState.startClientY
      if (Math.sqrt(dx * dx + dy * dy) > 12) cancelCharge(false)
    }

    function handlePointerLeave() { cancelCharge(false) }

    container.addEventListener('pointerdown',   handlePointerDown)
    // Capture phase ensures pointerup fires before Mapbox can stopPropagation()
    container.addEventListener('pointerup',     handlePointerUp,    { capture: true })
    // pointercancel fires on system gesture / scroll takeover — treat as release
    container.addEventListener('pointercancel', handlePointerLeave, { capture: true })
    container.addEventListener('pointermove',   handlePointerMove)
    container.addEventListener('pointerleave',  handlePointerLeave)

    // Sync markers on every zoom tick (rAF-throttled) and on zoomend
    let rafId = null
    function throttledSync() {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => { syncMarkerVisibility(); rafId = null })
    }
    map.current.on('zoom',    throttledSync)
    map.current.on('zoomend', syncMarkerVisibility)

    // ── Terminator + night-pin tint refresh (every 60 s) ────────────────────
    function refreshTerminator() {
      const now      = new Date()
      const subsolar = getSubsolarPoint(now)

      // Update terminator polygon
      const src = map.current?.getSource?.('terminator')
      if (src) src.setData(getTerminatorGeoJSON(now))

      // Tint markers that are on the night side
      Object.values(markersRef.current).forEach(({ marker, wrap }) => {
        const ll  = marker.getLngLat()
        const pin = wrap.querySelector('.hay-pin')
        if (!pin) return
        if (isPinInNight(ll.lat, ll.lng, subsolar)) {
          pin.classList.add('hay-pin--night')
        } else {
          pin.classList.remove('hay-pin--night')
        }
      })
    }
    // Run once after map is loaded (load event fires before this, but the
    // interval registration is synchronous inside the same useEffect)
    map.current.once('idle', refreshTerminator)
    const terminatorInterval = setInterval(refreshTerminator, 60_000)

    // ── Idle auto-rotation ──────────────────────────────────────────────────
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lastInteractionAt = 0
    let rotateRafId = null

    function rotateTick() {
      rotateRafId = requestAnimationFrame(rotateTick)
      if (reducedMotion || !map.current || !rotateGlobeRef.current) return
      if (map.current.getZoom() > CLUSTER_ZOOM) return
      if (Date.now() - lastInteractionAt < 1500) return
      const c = map.current.getCenter()
      map.current.easeTo({ center: [c.lng + 0.02, c.lat], duration: 0 })
    }
    rotateRafId = requestAnimationFrame(rotateTick)

    ;['mousedown', 'touchstart', 'wheel', 'dragstart', 'mouseup', 'touchend', 'dragend'].forEach(evt =>
      map.current.on(evt, () => { lastInteractionAt = Date.now() })
    )

    // ── Pulse canvas overlay (comet-arc trail) ──────────────────────────────
    const pulseCanvas = document.createElement('canvas')
    pulseCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;'
    pulseCanvas.width  = container.clientWidth
    pulseCanvas.height = container.clientHeight
    container.appendChild(pulseCanvas)
    pulseCanvasRef.current = pulseCanvas

    map.current.on('resize', () => {
      pulseCanvas.width  = container.clientWidth
      pulseCanvas.height = container.clientHeight
    })

    const PULSE_LIFE = 1100
    let pulseRafId = null

    function pulseTick() {
      pulseRafId = requestAnimationFrame(pulseTick)
      const ctx = pulseCanvas.getContext('2d')
      const now = Date.now()
      ctx.clearRect(0, 0, pulseCanvas.width, pulseCanvas.height)

      pulsesRef.current = pulsesRef.current.filter(p => now - p.born < PULSE_LIFE)
      if (pulsesRef.current.length === 0) return

      pulsesRef.current.forEach(p => {
        const t      = (now - p.born) / PULSE_LIFE
        const eased  = 1 - (1 - t) * (1 - t)   // ease-out quad
        const alpha  = 1 - t

        // Expanding ripple ring
        const radius = eased * 38
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(0, radius), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(120,180,255,${(alpha * 0.55).toFixed(3)})`
        ctx.lineWidth   = 1.5
        ctx.stroke()

        // Comet arc trail
        const arcLen = eased * 34
        const endX   = p.x + Math.cos(p.angle) * arcLen
        const endY   = p.y + Math.sin(p.angle) * arcLen
        const perpX  = Math.cos(p.angle + Math.PI / 2)
        const perpY  = Math.sin(p.angle + Math.PI / 2)
        const cpX    = p.x + Math.cos(p.angle) * arcLen * 0.5 + perpX * arcLen * 0.32
        const cpY    = p.y + Math.sin(p.angle) * arcLen * 0.5 + perpY * arcLen * 0.32

        const grad = ctx.createLinearGradient(p.x, p.y, endX, endY)
        grad.addColorStop(0, `rgba(255,170,100,${(alpha * 0.9).toFixed(3)})`)
        grad.addColorStop(1, 'rgba(255,170,100,0)')

        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.quadraticCurveTo(cpX, cpY, endX, endY)
        ctx.strokeStyle = grad
        ctx.lineWidth   = Math.max(0.5, 2.5 * (1 - t * 0.55))
        ctx.lineCap     = 'round'
        ctx.stroke()
      })
    }
    pulseRafId = requestAnimationFrame(pulseTick)

    return () => {
      clearInterval(terminatorInterval)
      if (rafId)       cancelAnimationFrame(rafId)
      if (rotateRafId) cancelAnimationFrame(rotateRafId)
      if (pulseRafId)  cancelAnimationFrame(pulseRafId)
      pulseCanvas.remove()
      pulseCanvasRef.current = null
      pulsesRef.current = []
      cancelCharge(false)
      container.removeEventListener('pointerdown',   handlePointerDown)
      container.removeEventListener('pointerup',     handlePointerUp,    { capture: true })
      container.removeEventListener('pointercancel', handlePointerLeave, { capture: true })
      container.removeEventListener('pointermove',   handlePointerMove)
      container.removeEventListener('pointerleave',  handlePointerLeave)
      container.querySelectorAll('.hay-mood-pop, .hay-hint-toast, .hay-charge-wrap, .hay-land-ring')
        .forEach((el) => el.remove())
      if (map.current) map.current.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync rotation setting ────────────────────────────────────────────────
  useEffect(() => { rotateGlobeRef.current = rotateGlobe }, [rotateGlobe])

  // ── Sync cluster setting ──────────────────────────────────────────────────
  useEffect(() => {
    clusterPinsRef.current = clusterPins
    if (!mapReady || !map.current) return
    const vis = clusterPins ? 'visible' : 'none'
    try { map.current.setLayoutProperty('nh-clusters',       'visibility', vis) } catch {}
    try { map.current.setLayoutProperty('nh-cluster-count',  'visibility', vis) } catch {}
    try { map.current.setLayoutProperty('nh-unclustered',    'visibility', vis) } catch {}
    syncMarkerVisibility()
  }, [clusterPins, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to pins ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return

    const unsub = subscribeToPins((pins) => {
      // Detect newly added pins — skip the first snapshot (all existing pins)
      const newPins = seenFirstSnapshot.current
        ? pins.filter(p => !knownPinIdsRef.current.has(p.id))
        : []
      seenFirstSnapshot.current = true
      knownPinIdsRef.current    = new Set(pins.map(p => p.id))

      newPins.forEach(pin => {
        if (pin.uid === user?.uid) return
        const flag  = countryFlag(pin.country)
        const where = pin.country ? `${flag} ${pin.country}` : 'somewhere'
        showToastRef.current?.(`Someone in ${where} just checked in ${pin.mood}`, 'info', 2000)

        if (!map.current || !mapContainer.current) return
        const pt = map.current.project([pin.lng, pin.lat])

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const dot = document.createElement('div')
          dot.className  = 'hay-globe-pulse-dot'
          dot.style.left = pt.x + 'px'
          dot.style.top  = pt.y + 'px'
          mapContainer.current.appendChild(dot)
          setTimeout(() => dot.remove(), 500)
          return
        }

        pulsesRef.current.push({ x: pt.x, y: pt.y, angle: Math.random() * Math.PI * 2, born: Date.now() })
      })

      // Update neighbourhood GeoJSON clusters
      updateNeighbourhoods(pins)

      // Fire onFirstPins once when pins first arrive
      if (!firstPinsFired.current && pins.length > 0) {
        firstPinsFired.current = true
        onFirstPinsRef.current?.()
      }

      // Remove stale markers
      const currentIds = new Set(pins.map((p) => p.id))
      Object.keys(markersRef.current).forEach((id) => {
        if (!currentIds.has(id)) {
          markersRef.current[id].marker.remove()
          delete markersRef.current[id]
        }
      })

      // Sync has-message class on existing markers (message may change)
      pins.forEach((pin) => {
        const entry = markersRef.current[pin.id]
        if (!entry) return
        entry.wrap.classList.toggle('hay-pin--has-message', Boolean(pin.message?.trim()))
      })

      // Add new markers
      const zoom = map.current?.getZoom() ?? 10
      pins.forEach((pin) => {
        if (markersRef.current[pin.id] || !map.current) return

        const isOwn = pin.uid === user?.uid

        const wrap = document.createElement('div')
        wrap.className = 'hay-pin-wrap'
        if (pin.hasStreak)    wrap.classList.add('hay-pin-wrap--streak')
        if (pin.needsSupport) wrap.classList.add('hay-pin-wrap--sos')
        if (isOwn)            wrap.classList.add('hay-pin-wrap--own')
        if (pin.message?.trim()) wrap.classList.add('hay-pin--has-message')
        wrap.setAttribute('role', 'button')
        wrap.setAttribute('tabindex', '0')
        wrap.setAttribute('aria-label', `Check-in: ${pin.mood}`)

        const el = document.createElement('div')
        const isNight = isPinInNight(pin.lat, pin.lng, getSubsolarPoint(new Date()))
        el.className = [
          'hay-pin',
          isOwn        ? 'hay-pin--own'      : '',
          pin.verified ? 'hay-pin--verified'  : '',
          pin.isFlash  ? 'hay-pin--flash'     : '',
          isNight      ? 'hay-pin--night'     : '',
        ].filter(Boolean).join(' ')
        el.style.background = pin.country ? getCountryColour(pin.country) : getAnonColour(pin.uid)

        const inner = document.createElement('span')
        inner.className   = 'hay-pin-inner'
        inner.textContent = countryFlag(pin.country)
        el.appendChild(inner)
        wrap.appendChild(el)

        // Mood badge (bottom-right corner)
        const moodBadge = document.createElement('div')
        moodBadge.className   = 'hay-pin-mood'
        moodBadge.textContent = pin.mood || '💬'
        wrap.appendChild(moodBadge)

        // Verified badge (top-right)
        if (pin.verified && !pin.isFlash) {
          const badge = document.createElement('div')
          badge.className   = 'hay-pin-badge'
          badge.textContent = '✓'
          wrap.appendChild(badge)
        }

        // Flash countdown badge (top-right)
        if (pin.isFlash && pin.expiresAt) {
          const expiresAt = pin.expiresAt.toDate ? pin.expiresAt.toDate() : new Date(pin.expiresAt)
          const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
          const flashBadge = document.createElement('div')
          flashBadge.className   = 'hay-flash-badge'
          flashBadge.textContent = `${remaining}s`
          wrap.appendChild(flashBadge)

          // Tick every second
          const ticker = setInterval(() => {
            const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
            flashBadge.textContent = `${left}s`
            if (left <= 0) clearInterval(ticker)
          }, 1000)

          // Auto-remove marker when pin expires
          const delay = expiresAt - Date.now()
          if (delay > 0) {
            setTimeout(() => {
              if (markersRef.current[pin.id]) {
                markersRef.current[pin.id].marker.remove()
                delete markersRef.current[pin.id]
              }
            }, delay)
          }
        }

        // Delete button (any pin)
        const delBtn = document.createElement('button')
        delBtn.className   = 'hay-pin-delete'
        delBtn.textContent = '✕'
        delBtn.setAttribute('aria-label', 'Delete this pin')
        delBtn.style.display = 'none'
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          document.querySelector('.hay-delete-banner')?.remove()
          const banner = document.createElement('div')
          banner.className = 'hay-delete-banner'
          banner.innerHTML = '<span class="hay-delete-banner-msg">Delete this pin? This cannot be undone.</span><div class="hay-delete-banner-actions"><button class="hay-delete-banner-yes">Delete</button><button class="hay-delete-banner-no">Cancel</button></div>'
          const dismiss = () => banner.remove()
          banner.querySelector('.hay-delete-banner-yes').addEventListener('click', (ev) => {
            ev.stopPropagation(); onDeletePinRef.current(pin.id); dismiss()
          })
          banner.querySelector('.hay-delete-banner-no').addEventListener('click', (ev) => {
            ev.stopPropagation(); dismiss()
          })
          document.body.appendChild(banner)
          setTimeout(dismiss, 8000)
        })
        wrap.appendChild(delBtn)

        // Touch stop-propagation (prevents Mapbox intercepting taps on markers)
        wrap.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true })
        wrap.addEventListener('touchend',   (e) => e.stopPropagation(), { passive: true })

        // Click → open chat
        wrap.addEventListener('click', (e) => {
          e.stopPropagation()
          onPinClickRef.current(pin)
        })

        const marker = new mapboxgl.Marker(wrap).setLngLat([pin.lng, pin.lat]).addTo(map.current)

        // Respect current zoom
        if (zoom <= CLUSTER_ZOOM) {
          wrap.style.opacity       = '0'
          wrap.style.pointerEvents = 'none'
        }

        if (unreadPinIdsRef.current?.has(pin.id)) {
          const msgBadge = document.createElement('div')
          msgBadge.className   = 'hay-msg-badge'
          msgBadge.textContent = '💬'
          wrap.appendChild(msgBadge)
        }

        // Animate the user's own pin when dropped via press-and-hold
        const isRecentDrop = isOwn &&
          lastHoldDropAtRef.current > 0 &&
          Date.now() - lastHoldDropAtRef.current < 5000
        if (isRecentDrop) {
          wrap.classList.add('hay-pin-wrap--new-drop')
          lastHoldDropAtRef.current = 0
        }

        markersRef.current[pin.id] = { marker, wrap }
      })

    })

    return unsub
  }, [mapReady, user])

  // ── Show/hide delete button for active pin ────────────────────────────────

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([pinId, { wrap }]) => {
      const delBtn = wrap.querySelector('.hay-pin-delete')
      if (!delBtn) return
      delBtn.style.display = pinId === activePinId ? 'flex' : 'none'
    })
  }, [activePinId])

  // ── Message badge updates ─────────────────────────────────────────────────

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([pinId, { wrap }]) => {
      const existing = wrap.querySelector('.hay-msg-badge')
      if (unreadPinIds?.has(pinId)) {
        if (!existing) {
          const badge = document.createElement('div')
          badge.className   = 'hay-msg-badge'
          badge.textContent = '💬'
          wrap.appendChild(badge)
        }
      } else {
        existing?.remove()
      }
    })
  }, [unreadPinIds])

  // ── Preview location marker (pulsing dot while check-in panel is open) ───

  useEffect(() => {
    previewMarkerRef.current?.remove()
    previewMarkerRef.current = null
    if (!previewLocation || !map.current) return
    const el = document.createElement('div')
    el.className = 'hay-preview-pin'
    previewMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([previewLocation.lng, previewLocation.lat])
      .addTo(map.current)
    return () => { previewMarkerRef.current?.remove(); previewMarkerRef.current = null }
  }, [previewLocation])

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100%' }}
      aria-label="World map showing check-in pins"
    />
  )
}
