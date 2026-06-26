import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Loader2, Globe } from 'lucide-react';

// Self-contained Leaflet CDN Loader
let leafletLoadingPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).L) {
    return Promise.resolve((window as any).L);
  }
  if (leafletLoadingPromise) {
    return leafletLoadingPromise;
  }

  // Check if script is already in document
  const existingScript = document.querySelector('script[src*="leaflet.js"]') as HTMLScriptElement;
  if (existingScript) {
    leafletLoadingPromise = new Promise((resolve) => {
      const interval = setInterval(() => {
        if ((window as any).L) {
          clearInterval(interval);
          resolve((window as any).L);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        resolve((window as any).L || null);
      }, 5000);
    });
    return leafletLoadingPromise;
  }

  leafletLoadingPromise = new Promise((resolve, reject) => {
    // Load CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      resolve((window as any).L);
    };
    script.onerror = (err) => {
      reject(err);
    };
    document.head.appendChild(script);
  });

  return leafletLoadingPromise;
}

// Reverse Geocoding with fallback to Nominatim (OpenStreetMap)
async function reverseGeocode(lat: number, lng: number, googleMapsKey?: string) {
  if (googleMapsKey && googleMapsKey !== 'YOUR_API_KEY' && googleMapsKey !== 'AIzaSyBsDZElnhpfKp-DrtQ-StRh0E5tz05bdFo') {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsKey}`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        return data.results[0].formatted_address;
      }
    } catch (e) {
      console.warn("Google Maps reverse geocoding failed, trying Nominatim...", e);
    }
  }

  // Fallback to Nominatim (completely free, no API key needed)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CivicPulse-AI-Studio'
        }
      }
    );
    const data = await res.json();
    if (data && data.display_name) {
      return data.display_name;
    }
  } catch (e) {
    console.error("Nominatim geocoding failed:", e);
  }

  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

interface LocationValue {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(false);

  // Initialize interactive OpenStreetMap Leaflet Map
  useEffect(() => {
    let isCancelled = false;
    let activeMap: any = null;
    let marker: any = null;

    loadLeaflet()
      .then((L) => {
        if (isCancelled) return;
        setIsLeafletLoaded(true);
        if (!mapContainerRef.current) return;

        // Ensure we don't double-initialize if there's any leftover map or _leaflet_id
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch (e) {}
          mapInstanceRef.current = null;
        }
        if ((mapContainerRef.current as any)._leaflet_id) {
          (mapContainerRef.current as any)._leaflet_id = null;
        }

        const defaultCenter = value ? [value.lat, value.lng] : [20.5937, 78.9629]; // India default
        const defaultZoom = value ? 15 : 5;

        activeMap = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: defaultZoom,
          zoomControl: true,
        });

        mapInstanceRef.current = activeMap;

        // Add street-view tiles of the complete world
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }).addTo(activeMap);

        // Add active marker if value exists
        if (value) {
          marker = L.marker([value.lat, value.lng]).addTo(activeMap);
        }

        // Click Handler for custom map coordinate selection
        activeMap.on('click', async (e: any) => {
          const { lat, lng } = e.latlng;
          setGeocoding(true);

          if (marker) {
            marker.setLatLng([lat, lng]);
          } else {
            marker = L.marker([lat, lng]).addTo(activeMap);
          }

          const address = await reverseGeocode(lat, lng);
          setGeocoding(false);
          onChange({ lat, lng, address });
        });
      })
      .catch((err) => {
        console.error("Could not load OpenStreetMap engine:", err);
      });

    return () => {
      isCancelled = true;
      if (activeMap) {
        activeMap.remove();
        if (mapInstanceRef.current === activeMap) {
          mapInstanceRef.current = null;
        }
      }
    };
  }, [isLeafletLoaded]);

  // Handle GPS location click
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setGeocoding(true);
        const address = await reverseGeocode(lat, lng);
        setGeocoding(false);
        setGpsLoading(false);

        onChange({ lat, lng, address });

        // Trigger map reload or center map if loaded
        setIsLeafletLoaded(false);
        setTimeout(() => setIsLeafletLoaded(true), 50);
      },
      (error) => {
        console.error("GPS fetching error:", error);
        setGpsLoading(false);
        setGpsError("Could not retrieve precise location. Please tap the map manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gpsLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 bg-white hover:bg-slate-50 text-blue-600 text-xs font-semibold shadow-sm transition-all disabled:opacity-60 cursor-pointer"
        >
          {gpsLoading ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <Navigation size={14} />}
          {gpsLoading ? 'Detecting your GPS...' : 'Use Current Device Location'}
        </button>

        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
          <Globe size={11} className="text-emerald-500 animate-spin-slow" />
          <span>Interactive Global Map (OSM)</span>
        </span>
      </div>

      {gpsError && (
        <p className="text-xs text-red-500 font-medium">{gpsError}</p>
      )}

      {/* Map Container */}
      <div className="relative rounded-xl border border-slate-200 overflow-hidden shadow-sm h-[320px] bg-slate-50">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {geocoding && (
          <div className="absolute top-3 right-3 z-[1000] bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-md backdrop-blur-sm">
            <Loader2 size={13} className="animate-spin text-blue-600" />
            <span className="text-xs text-slate-600 font-medium">Decoding coordinates...</span>
          </div>
        )}

        {!value && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 text-white rounded-lg px-3 py-1.5 text-[10.5px] font-sans font-medium pointer-events-none shadow-sm flex items-center gap-1.5">
            <MapPin size={12} className="text-red-400" />
            <span>Click or tap anywhere on the map to drop a pin</span>
          </div>
        )}
      </div>

      {value && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm animate-fade-in text-left">
          <MapPin size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-700 leading-tight">Selected Coordinate Node</p>
            <p className="text-[10.5px] text-slate-500 mt-1 break-words font-sans">{value.address}</p>
            <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
              Latitude: {value.lat.toFixed(5)}, Longitude: {value.lng.toFixed(5)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setIsLeafletLoaded(false);
              setTimeout(() => setIsLeafletLoaded(true), 50);
            }}
            className="flex-shrink-0 text-[10.5px] font-bold text-slate-400 hover:text-red-500 cursor-pointer p-1"
          >
            Clear Location
          </button>
        </div>
      )}
    </div>
  );
}
