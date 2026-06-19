import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { subscribeToPins } from '../utils/db'
import { getAnonColour, getCountryColour } from '../utils/identity'
import { useAuth } from '../contexts/AuthContext'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const CLUSTER_ZOOM = 9   // below this: show clusters; above: show markers

const PIN_STYLE = `
  .hay-pin-wrap {
    position: relative;
    width: 40px;
    height: 40px;
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

  /* ── Flash pin ─────────────────────────────────── */
  .hay-pin--flash {
    border-style: dashed;
    animation: flashPulse 1.1s ease-in-out infinite;
  }
  @keyframes flashPulse {
    0%,100% { opacity: 1;   box-shadow: 0 4px 16px rgba(255,200,60,0.4); }
    50%      { opacity: 0.6; box-shadow: 0 4px 24px rgba(255,200,60,0.7); }
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

  /* ── Message badge ─────────────────────────────── */
  .hay-msg-badge {
    position: absolute; bottom: -6px; left: -6px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #5b8af5; border: 2px solid #0f1117;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: #fff; pointer-events: none; z-index: 2;
    animation: msgPop 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes msgPop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
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

export default function MapView({
  onPinClick, onMapClick, onDeletePin,
  userLocation, unreadPinIds, activePinId,
  onNeighbourhoodClick,
}) {
  const mapContainer  = useRef(null)
  const map           = useRef(null)
  const markersRef    = useRef({})
  const styleInjected = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const { user } = useAuth()

  // Always-fresh callback refs — never stale, never in effect deps
  const onPinClickRef          = useRef(onPinClick)
  const onDeletePinRef         = useRef(onDeletePin)
  const onMapClickRef          = useRef(onMapClick)
  const onNeighbourhoodClickRef = useRef(onNeighbourhoodClick)
  onPinClickRef.current           = onPinClick
  onDeletePinRef.current          = onDeletePin
  onMapClickRef.current           = onMapClick
  onNeighbourhoodClickRef.current = onNeighbourhoodClick

  // ── Sync marker visibility to current zoom level ──────────────────────────

  function syncMarkerVisibility() {
    if (!map.current) return
    const show = map.current.getZoom() > CLUSTER_ZOOM
    Object.values(markersRef.current).forEach(({ wrap }) => {
      wrap.style.opacity       = show ? '1' : '0'
      wrap.style.pointerEvents = show ? 'auto' : 'none'
    })
  }

  // ── Update neighbourhood GeoJSON source ───────────────────────────────────

  function updateNeighbourhoods(pins) {
    const src = map.current?.getSource?.('neighbourhoods')
    if (src) src.setData(buildGeoJSON(pins))
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
      container: mapContainer.current,
      style:     'mapbox://styles/mapbox/dark-v11',
      center:    userLocation ? [userLocation.lng, userLocation.lat] : [0, 20],
      zoom:      userLocation ? 13 : 2,
      attributionControl: false,
    })

    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.current.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: false, showUserLocation: false }), 'bottom-right')

    map.current.on('load', () => {
      // ── Neighbourhood clustering ─────────────────────────────────────────
      map.current.addSource('neighbourhoods', {
        type:          'geojson',
        data:          buildGeoJSON([]),
        cluster:       true,
        clusterMaxZoom: CLUSTER_ZOOM,
        clusterRadius: 60,
      })

      // Cluster bubble
      map.current.addLayer({
        id:     'nh-clusters',
        type:   'circle',
        source: 'neighbourhoods',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color':        'rgba(91,138,245,0.55)',
          'circle-radius':       ['step', ['get', 'point_count'], 22, 5, 30, 20, 40],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': 'rgba(255,255,255,0.22)',
          'circle-blur':         0.12,
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

    // Canvas click → map handler (always reads latest via ref)
    map.current.on('click', (e) => {
      onMapClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    // Zoom changes toggle between cluster view and individual marker view
    map.current.on('zoomend', syncMarkerVisibility)

    return () => { if (map.current) map.current.remove() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to pins ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return

    const unsub = subscribeToPins((pins) => {
      // Update neighbourhood GeoJSON clusters
      updateNeighbourhoods(pins)

      // Remove stale markers
      const currentIds = new Set(pins.map((p) => p.id))
      Object.keys(markersRef.current).forEach((id) => {
        if (!currentIds.has(id)) {
          markersRef.current[id].marker.remove()
          delete markersRef.current[id]
        }
      })

      // Add new markers
      const zoom = map.current?.getZoom() ?? 10
      pins.forEach((pin) => {
        if (markersRef.current[pin.id] || !map.current) return

        const isOwn = pin.uid === user?.uid

        const wrap = document.createElement('div')
        wrap.className = 'hay-pin-wrap'
        if (pin.hasStreak) wrap.classList.add('hay-pin-wrap--streak')
        wrap.setAttribute('role', 'button')
        wrap.setAttribute('tabindex', '0')
        wrap.setAttribute('aria-label', `Check-in: ${pin.mood}`)

        const el = document.createElement('div')
        el.className = [
          'hay-pin',
          isOwn        ? 'hay-pin--own'      : '',
          pin.verified ? 'hay-pin--verified'  : '',
          pin.isFlash  ? 'hay-pin--flash'     : '',
        ].filter(Boolean).join(' ')
        el.style.background = pin.country ? getCountryColour(pin.country) : getAnonColour(pin.uid)

        const inner = document.createElement('span')
        inner.className   = 'hay-pin-inner'
        inner.textContent = pin.mood || '💬'
        el.appendChild(inner)
        wrap.appendChild(el)

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

        // Delete button (own pins only)
        if (isOwn) {
          const delBtn = document.createElement('button')
          delBtn.className   = 'hay-pin-delete'
          delBtn.textContent = '✕'
          delBtn.setAttribute('aria-label', 'Delete this pin')
          delBtn.style.display = 'none'
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (window.confirm('Delete this pin? This cannot be undone.')) {
              onDeletePinRef.current(pin.id)
            }
          })
          wrap.appendChild(delBtn)
        }

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

        markersRef.current[pin.id] = { marker, wrap }
      })
    })

    return unsub
  }, [mapReady, user]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100%' }}
      aria-label="World map showing check-in pins"
    />
  )
}
