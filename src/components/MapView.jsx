import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { subscribeToPins } from '../utils/db'
import { getAnonColour } from '../utils/identity'
import { useAuth } from '../contexts/AuthContext'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const PIN_STYLE = `
  .hay-pin {
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
  .hay-pin:hover {
    transform: rotate(-45deg) scale(1.15);
    box-shadow: 0 6px 24px rgba(0,0,0,0.55);
  }
  .hay-pin-inner {
    transform: rotate(45deg);
    font-size: 18px;
    line-height: 1;
    user-select: none;
  }
  .hay-pin--own {
    border-color: rgba(255,255,255,1);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.25), 0 4px 16px rgba(0,0,0,0.45);
  }
`

export default function MapView({ onPinClick, onMapClick, userLocation }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef({})
  const unsubRef = useRef(null)
  const styleInjected = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const { user } = useAuth()

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
      style: 'mapbox://styles/mapbox/dark-v11',
      center: userLocation ? [userLocation.lng, userLocation.lat] : [0, 20],
      zoom: userLocation ? 13 : 2,
      attributionControl: false,
    })

    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left'
    )
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.current.addControl(
      new mapboxgl.GeolocateControl({ trackUserLocation: false, showUserLocation: false }),
      'bottom-right'
    )

    map.current.on('load', () => setMapReady(true))

    map.current.on('click', (e) => {
      onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    return () => {
      if (map.current) map.current.remove()
    }
  }, [])

  const loadPins = useCallback(() => {
    if (!map.current || !mapReady) return

    const bounds = map.current.getBounds()
    const bbox = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    }

    if (unsubRef.current) unsubRef.current()

    unsubRef.current = subscribeToPins(bbox, (pins) => {
      const currentIds = new Set(pins.map((p) => p.id))

      Object.keys(markersRef.current).forEach((id) => {
        if (!currentIds.has(id)) {
          markersRef.current[id].remove()
          delete markersRef.current[id]
        }
      })

      pins.forEach((pin) => {
        if (markersRef.current[pin.id]) return

        const isOwn = pin.uid === user?.uid
        const el = document.createElement('div')
        el.className = `hay-pin${isOwn ? ' hay-pin--own' : ''}`
        el.style.background = getAnonColour(pin.uid)
        el.setAttribute('role', 'button')
        el.setAttribute('aria-label', `Check-in: ${pin.mood}`)

        const inner = document.createElement('span')
        inner.className = 'hay-pin-inner'
        inner.textContent = pin.mood || '💬'
        el.appendChild(inner)

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onPinClick(pin)
        })

        const marker = new mapboxgl.Marker(el)
          .setLngLat([pin.lng, pin.lat])
          .addTo(map.current)

        markersRef.current[pin.id] = marker
      })
    })
  }, [mapReady, onPinClick, user])

  useEffect(() => {
    if (!mapReady) return
    loadPins()
    map.current.on('moveend', loadPins)
    return () => {
      map.current?.off('moveend', loadPins)
      if (unsubRef.current) unsubRef.current()
    }
  }, [mapReady, loadPins])

  return (
    <div
      ref={mapContainer}
      style={{ width: '100%', height: '100%' }}
      aria-label="World map showing check-in pins"
    />
  )
}
