import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Loader2, Globe } from 'lucide-react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface LocationValue {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

// Subcomponent to handle Map interaction and Geocoding
function MapInteraction({ value, onChange }: LocationPickerProps) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const [geocoding, setGeocoding] = useState(false);

  // Click handler
  useEffect(() => {
    if (!map || !geocodingLib) return;

    const listener = map.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setGeocoding(true);
      
      try {
        const geocoder = new geocodingLib.Geocoder();
        const res = await geocoder.geocode({ location: { lat, lng } });
        const address = res.results[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChange({ lat, lng, address });
      } catch (err) {
        onChange({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      } finally {
        setGeocoding(false);
      }
    });

    return () => { listener.remove(); };
  }, [map, geocodingLib, onChange]);

  return (
    <>
      {value && <AdvancedMarker position={{ lat: value.lat, lng: value.lng }} />}
      {geocoding && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-md backdrop-blur-sm">
          <Loader2 size={13} className="animate-spin text-blue-600" />
          <span className="text-xs text-slate-600 font-medium">Decoding...</span>
        </div>
      )}
    </>
  );
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  if (!hasValidKey) {
    return (
      <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-center">
        <p className="text-xs text-slate-600">Google Maps API Key required.</p>
      </div>
    );
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported.");
      return;
    }

    setGpsLoading(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        onChange({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        setGpsError("Could not retrieve precise location.");
      }
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
          {gpsLoading ? 'Detecting...' : 'Use My Location'}
        </button>
      </div>

      <div className="relative rounded-xl border border-slate-200 overflow-hidden shadow-sm h-[320px] bg-slate-50">
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
            defaultZoom={5}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <MapInteraction value={value} onChange={onChange} />
          </Map>
        </APIProvider>
      </div>
      
      {value && (
         <p className="text-[10px] text-slate-500 font-mono mt-0.5">
           Selected: {value.address}
         </p>
      )}
    </div>
  );
}
