// Globe style definitions — each controls map tile style, atmosphere, and UI theme.
// Satellite and Streets skip atmosphere (fog) since they look better without it.

export const GLOBE_STYLES = [
  {
    id:       'cosmos',
    label:    'Cosmos',
    emoji:    '🌌',
    desc:     'Deep space dark',
    mapStyle: null, // uses dark-v11
    fogPreset:'cosmos',
    appTheme: 'dark',
    preview:  'radial-gradient(ellipse at 40% 40%, #1a2255 0%, #050a18 70%)',
  },
  {
    id:       'daylight',
    label:    'Daylight',
    emoji:    '☀️',
    desc:     'Bright blue sky',
    mapStyle: null, // uses light-v11
    fogPreset:'daylight',
    appTheme: 'light',
    preview:  'radial-gradient(ellipse at 40% 30%, #8ec5fc 0%, #c9e0f5 60%, #d4eaff 100%)',
  },
  {
    id:       'midnight',
    label:    'Midnight',
    emoji:    '🌙',
    desc:     'Purple galaxy glow',
    mapStyle: null, // uses dark-v11
    fogPreset:'midnight',
    appTheme: 'dark',
    preview:  'radial-gradient(ellipse at 40% 35%, #3b1f6b 0%, #0c0520 70%)',
  },
  {
    id:       'satellite',
    label:    'Satellite',
    emoji:    '🛰',
    desc:     'Real Earth imagery',
    mapStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
    fogPreset:'none',
    appTheme: 'dark',
    preview:  'radial-gradient(ellipse at 40% 40%, #1f3a1f 0%, #0a1a0a 70%)',
  },
  {
    id:       'outdoors',
    label:    'Outdoors',
    emoji:    '🏔',
    desc:     'Terrain & nature',
    mapStyle: 'mapbox://styles/mapbox/outdoors-v12',
    fogPreset:'nature',
    appTheme: 'light',
    preview:  'radial-gradient(ellipse at 40% 35%, #81c784 0%, #c8dfc8 70%)',
  },
  {
    id:       'streets',
    label:    'Streets',
    emoji:    '🗺',
    desc:     'Urban street map',
    mapStyle: 'mapbox://styles/mapbox/streets-v12',
    fogPreset:'warm',
    appTheme: 'light',
    preview:  'radial-gradient(ellipse at 40% 35%, #f4c97a 0%, #f0e6d3 70%)',
  },
]

export const FOG_PRESETS = {
  cosmos:   {
    color:           'rgb(8,10,22)',
    'high-color':    'rgb(28,55,125)',
    'horizon-blend': 0.07,
    'space-color':   'rgb(2,3,10)',
    'star-intensity': 0.62,
  },
  daylight: {
    color:           'rgb(200,220,240)',
    'high-color':    'rgb(80,130,210)',
    'horizon-blend': 0.07,
    'space-color':   'rgb(4,6,18)',
    'star-intensity': 0.45,
  },
  midnight: {
    color:           'rgb(4,0,20)',
    'high-color':    'rgb(60,20,120)',
    'horizon-blend': 0.09,
    'space-color':   'rgb(0,0,8)',
    'star-intensity': 0.88,
  },
  nature:   {
    color:           'rgb(180,220,180)',
    'high-color':    'rgb(60,140,80)',
    'horizon-blend': 0.06,
    'space-color':   'rgb(4,6,18)',
    'star-intensity': 0.35,
  },
  warm:     {
    color:           'rgb(230,210,185)',
    'high-color':    'rgb(180,130,80)',
    'horizon-blend': 0.05,
    'space-color':   'rgb(4,6,18)',
    'star-intensity': 0.25,
  },
  none: null,
}

export function getGlobeStyle(id) {
  return GLOBE_STYLES.find(s => s.id === id) ?? GLOBE_STYLES[0]
}
