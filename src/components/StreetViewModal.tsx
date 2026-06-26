import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, ExternalLink, RefreshCw, AlertTriangle, HelpCircle, Eye } from 'lucide-react';

interface StreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  title: string;
  locationName: string;
  apiKey?: string;
}

export default function StreetViewModal({
  isOpen,
  onClose,
  lat,
  lng,
  title,
  locationName,
  apiKey,
}: StreetViewModalProps) {
  const panoramaRef = useRef<HTMLDivElement>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [panoType, setPanoType] = useState<'js' | 'iframe' | 'fallback'>('fallback');

  const isPlaceholderKey = (key?: string) => {
    if (!key) return true;
    const k = key.trim();
    return (
      k === '' ||
      k === 'YOUR_API_KEY' ||
      k === 'AIzaSyBsDZElnhpfKp-DrtQ-StRh0E5tz05bdFo' ||
      k.includes('YOUR_') ||
      k.includes('PLACEHOLDER')
    );
  };

  const hasValidKey = !isPlaceholderKey(apiKey);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setInitError(null);

    // Let's decide which rendering strategy to use
    const hasGoogleMapsLoaded = typeof window !== 'undefined' && (window as any).google && (window as any).google.maps;

    if (hasGoogleMapsLoaded && hasValidKey) {
      setPanoType('js');
      // Give a tiny timeout for modal rendering to finish so container has offsetWidth
      const timer = setTimeout(() => {
        if (!panoramaRef.current) return;
        try {
          const google = (window as any).google;
          const panorama = new google.maps.StreetViewPanorama(panoramaRef.current, {
            position: { lat, lng },
            pov: { heading: 180, pitch: 0 },
            zoom: 1,
            addressControl: true,
            linksControl: true,
            panControl: true,
            enableCloseButton: false,
          });

          // Check if a panorama actually exists at this coordinate
          const svService = new google.maps.StreetViewService();
          svService.getPanorama({ location: { lat, lng }, radius: 50 }, (data: any, status: any) => {
            if (status !== google.maps.StreetViewStatus.OK) {
              setInitError("Google Street View panorama is not available at these exact coordinates. Showing nearby coordinate node.");
            }
            setIsLoading(false);
          });
        } catch (e) {
          console.error("Failed to initialize Google Street View JS API:", e);
          setPanoType('iframe');
          setIsLoading(false);
        }
      }, 300);

      return () => clearTimeout(timer);
    } else if (hasValidKey) {
      setPanoType('iframe');
      setIsLoading(false);
    } else {
      setPanoType('fallback');
      setIsLoading(false);
    }
  }, [isOpen, lat, lng, apiKey]);

  // Handle direct Google Maps external panorama redirect
  const handleOpenExternal = () => {
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        />

        {/* Modal body container */}
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          className="relative bg-white border border-slate-200 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[520px] max-h-[85vh] text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono tracking-wider font-bold text-slate-400 uppercase bg-slate-200/60 px-2 py-0.5 rounded">
                Incident Street View Finder
              </span>
              <h3 className="text-sm font-bold text-slate-800 truncate mt-1.5 flex items-center gap-1.5">
                <MapPin size={15} className="text-red-500 flex-shrink-0" />
                <span className="truncate">{title}</span>
              </h3>
              <p className="text-[10.5px] text-slate-500 truncate font-mono mt-0.5">
                {locationName || `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors ml-4 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Panorama Stage */}
          <div className="relative flex-1 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
                <RefreshCw className="animate-spin text-blue-500" size={32} />
                <span className="text-xs font-mono text-slate-400">Syncing telemetry and camera node...</span>
              </div>
            )}

            {/* Error Overlay / Alert Info */}
            {initError && (
              <div className="absolute top-3 left-3 right-3 z-20 p-2.5 bg-amber-500/90 backdrop-blur-sm border border-amber-400 text-[10px] text-white rounded-lg flex items-center gap-2 shadow-md">
                <AlertTriangle size={15} className="flex-shrink-0" />
                <span>{initError}</span>
              </div>
            )}

            {/* JS StreetView Div */}
            {panoType === 'js' && (
              <div ref={panoramaRef} className="w-full h-full" />
            )}

            {/* Iframe StreetView Embed */}
            {panoType === 'iframe' && (
              <iframe
                title="Google Maps Street View Panorama"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${lat},${lng}&heading=180&pitch=0&fov=90`}
                allowFullScreen
              />
            )}

            {/* Fallback Mode (e.g. no valid Google Maps API Key) */}
            {panoType === 'fallback' && (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300 max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500">
                  <HelpCircle size={24} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white">Google Maps API Key Required</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Live inline Street View panoramas require a Google Maps API Key to render directly inside the browser sandbox.
                  </p>
                </div>

                <div className="w-full bg-slate-900/60 rounded-xl border border-slate-800/80 p-3 text-left space-y-2">
                  <p className="text-[10px] text-slate-400 font-mono">
                    <span className="text-emerald-400">Target Latitude:</span> {lat.toFixed(5)}<br />
                    <span className="text-emerald-400">Target Longitude:</span> {lng.toFixed(5)}
                  </p>
                  <p className="text-[9.5px] text-slate-500 leading-normal">
                    You can configure a custom API key under map settings, or launch direct Google Street View immediately below.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer w-full"
                >
                  <ExternalLink size={14} />
                  <span>Open Live Street View in New Tab</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Panel */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-[10px] text-slate-400 font-mono text-center sm:text-left leading-normal max-w-xs sm:max-w-md">
              Google Street View displays street imagery corresponding to the closest matched panorama point within 50 meters.
            </span>
            
            {/* Quick Link Launcher */}
            {panoType !== 'fallback' && (
              <button
                type="button"
                onClick={handleOpenExternal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-all cursor-pointer"
              >
                <ExternalLink size={13} className="text-slate-500" />
                <span>Launch in Google Maps ↗</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
