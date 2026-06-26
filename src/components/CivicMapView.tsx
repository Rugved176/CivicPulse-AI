import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { CivicIssue } from '../types';
import { MapPin, ShieldAlert, CheckCircle, Info, ExternalLink, Calendar, User, Eye, Settings, RefreshCw, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import StreetViewModal from './StreetViewModal';

interface CivicMapViewProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
}

const DEFAULT_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  'AIzaSyBsDZElnhpfKp-DrtQ-StRh0E5tz05bdFo';

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

let leafletHeatLoadingPromise: Promise<any> | null = null;

function loadLeafletHeat(): Promise<any> {
  return loadLeaflet().then((L) => {
    if ((L as any).heatLayer) {
      return Promise.resolve(L);
    }
    if (leafletHeatLoadingPromise) {
      return leafletHeatLoadingPromise;
    }

    const existingHeatScript = document.querySelector('script[src*="leaflet-heat.js"]') as HTMLScriptElement;
    if (existingHeatScript) {
      leafletHeatLoadingPromise = new Promise((resolve) => {
        const interval = setInterval(() => {
          if ((L as any).heatLayer) {
            clearInterval(interval);
            resolve(L);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(interval);
          resolve(L);
        }, 5000);
      });
      return leafletHeatLoadingPromise;
    }

    leafletHeatLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        resolve(L);
      };
      script.onerror = (err) => {
        reject(err);
      };
      document.head.appendChild(script);
    });

    return leafletHeatLoadingPromise;
  });
}

interface HeatmapLayerProps {
  points: { lat: number; lng: number; weight: number }[];
}

function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();
  const visualizationLibrary = (useMapsLibrary as any)('visualization');
  const heatmapRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !visualizationLibrary) return;

    const data = points.map((p) => ({
      location: new (window as any).google.maps.LatLng(p.lat, p.lng),
      weight: p.weight,
    }));

    heatmapRef.current = new visualizationLibrary.HeatmapLayer({
      data: data,
      map: map,
      radius: 30,
      opacity: 0.8,
    });

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
      }
    };
  }, [map, visualizationLibrary, points]);

  return null;
}

export default function CivicMapView({ issues, selectedIssueId, onSelectIssue }: CivicMapViewProps) {
  const leafletMapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Global callback registration for OpenStreetMap custom popup clicks
  useEffect(() => {
    (window as any).openStreetView = (id: string) => {
      onSelectIssue(id);
      setIsStreetViewOpen(true);
    };
    return () => {
      delete (window as any).openStreetView;
    };
  }, [onSelectIssue]);
  const [isAuthFailed, setIsAuthFailed] = useState(false);
  const [mapEngine, setMapEngine] = useState<'osm' | 'google'>('osm'); // Default to OSM to prevent InvalidKeyMapError
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [leafletMapInstance, setLeafletMapInstance] = useState<any>(null);
  const [leafletMarkers, setLeafletMarkers] = useState<any[]>([]);

  // Dynamic API Key from local storage if the user wants to test with their own key
  const [customKey, setCustomKey] = useState<string>(() => {
    return localStorage.getItem('CUSTOM_GOOGLE_MAPS_API_KEY') || '';
  });
  const [keyInput, setKeyInput] = useState(customKey);

  const ACTIVE_API_KEY = customKey || DEFAULT_API_KEY;

  const isPlaceholderKey = (key: string) => {
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

  const hasValidKey = !isPlaceholderKey(ACTIVE_API_KEY);

  // Catch Google Maps authorization errors globally
  useEffect(() => {
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setIsAuthFailed(true);
      setMapEngine('osm'); // Auto-downgrade to OSM
      if (originalAuthFailure) {
        try {
          originalAuthFailure();
        } catch (e) {}
      }
    };
    return () => {
      (window as any).gm_authFailure = originalAuthFailure;
    };
  }, []);

  const WORLD_CENTER = { lat: 20.5937, lng: 78.9629 }; // India default center
  const activeIssue = issues.find((i) => i.id === selectedIssueId);

  // Synchronize Leaflet OpenStreetMap Engine
  useEffect(() => {
    if (mapEngine !== 'osm') return;

    let isCancelled = false;
    let activeMap: any = null;
    const markersList: any[] = [];

    const loadPromise = showHeatmap ? loadLeafletHeat() : loadLeaflet();

    loadPromise
      .then((L) => {
        if (isCancelled) return;
        if (!leafletMapContainerRef.current) return;

        // Ensure we don't double-initialize if there's any leftover map or _leaflet_id
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch (e) {}
          mapInstanceRef.current = null;
        }
        if ((leafletMapContainerRef.current as any)._leaflet_id) {
          (leafletMapContainerRef.current as any)._leaflet_id = null;
        }

        // Determine starting center
        let initialCenter = [WORLD_CENTER.lat, WORLD_CENTER.lng];
        let initialZoom = 5;

        if (activeIssue) {
          initialCenter = [activeIssue.lat, activeIssue.lng];
          initialZoom = 15;
        } else if (issues.length > 0) {
          initialCenter = [issues[0].lat, issues[0].lng];
          initialZoom = 12;
        }

        activeMap = L.map(leafletMapContainerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          zoomControl: true,
        });

        mapInstanceRef.current = activeMap;
        setLeafletMapInstance(activeMap);

        // Standard OSM tile layer of the complete world
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(activeMap);

        // Add Heatmap layer if enabled
        if (showHeatmap && (L as any).heatLayer) {
          const heatPoints = issues.map((issue) => [
            issue.lat,
            issue.lng,
            issue.severity / 10, // Intensity / weight
          ]);
          (L as any).heatLayer(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
          }).addTo(activeMap);
        }

        // Render Issue Pins dynamically with customized styles
        issues.forEach((issue) => {
          const isActive = issue.status === 'Active';
          const isSelected = issue.id === selectedIssueId;
          const isCritical = issue.severity >= 8;

          // Category color palette mapping
          const color = issue.category === 'Roads/Potholes'
            ? '#ef4444' // red
            : issue.category === 'Water/Drainage'
            ? '#3b82f6' // blue
            : issue.category === 'Solid Waste'
            ? '#d97706' // amber
            : issue.category === 'Electricity'
            ? '#f59e0b' // yellow
            : '#10b981'; // emerald

          const iconHtml = `
            <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
              ${isActive ? `<div class="absolute rounded-full opacity-40 animate-ping" style="width: 20px; height: 20px; background-color: ${color};"></div>` : ''}
              <div class="w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all hover:scale-125" style="background-color: ${color};">
                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
            </div>
          `;

          const customIcon = L.divIcon({
            className: 'custom-leaflet-marker',
            html: iconHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const marker = L.marker([issue.lat, issue.lng], { icon: customIcon }).addTo(activeMap);

          // Rich physical Popup info cards
          const popupHtml = `
            <div style="font-family: sans-serif; font-size: 11.5px; max-width: 220px; color: #1e293b;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: bold; background: #f1f5f9; padding: 1.5px 4px; border-radius: 4px; font-size: 9px; border: 1px solid #cbd5e1;">${issue.id}</span>
                <span style="font-weight: 800; font-size: 9px; color: ${isActive ? '#ef4444' : '#10b981'};">${issue.status.toUpperCase()}</span>
              </div>
              <h4 style="margin: 0 0 4px 0; font-size: 12px; font-weight: bold; color: #0f172a; line-height: 1.25;">${issue.title}</h4>
              <p style="margin: 0 0 6px 0; color: #475569; font-size: 10.5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${issue.description}</p>
              <div style="font-size: 9.5px; color: #64748b; font-family: monospace; margin-bottom: 8px;">Ward: ${issue.ward}</div>
              <button onclick="window.openStreetView('${issue.id}')" style="width: 100%; padding: 5px 8px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <span>📍 Explore Street View</span>
              </button>
            </div>
          `;

          marker.bindPopup(popupHtml, { closeButton: false, offset: L.point(0, -6) });

          marker.on('click', () => {
            onSelectIssue(issue.id);
            setActiveMarkerId(issue.id);
          });

          markersList.push({ id: issue.id, marker });
        });

        setLeafletMarkers(markersList);
      })
      .catch((err) => {
        console.error("OpenStreetMap engine failure:", err);
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
  }, [issues, mapEngine, showHeatmap]);

  // Handle flying/panning map instance when selectedIssueId changes
  useEffect(() => {
    if (!activeIssue) return;

    if (mapEngine === 'osm' && leafletMapInstance) {
      leafletMapInstance.flyTo([activeIssue.lat, activeIssue.lng], 15, {
        animate: true,
        duration: 1.5
      });

      // Find matched marker to open popup programmatically
      const found = leafletMarkers.find((m) => m.id === activeIssue.id);
      if (found) {
        setTimeout(() => {
          found.marker.openPopup();
        }, 1200);
      }
    }
  }, [selectedIssueId, leafletMapInstance, leafletMarkers, mapEngine]);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = keyInput.trim();
    if (cleanKey) {
      localStorage.setItem('CUSTOM_GOOGLE_MAPS_API_KEY', cleanKey);
      setCustomKey(cleanKey);
      setMapEngine('google');
      setIsAuthFailed(false);
      setShowKeyEditor(false);
    }
  };

  const handleResetKey = () => {
    localStorage.removeItem('CUSTOM_GOOGLE_MAPS_API_KEY');
    setCustomKey('');
    setKeyInput('');
    setMapEngine('osm');
    setIsAuthFailed(false);
    setShowKeyEditor(false);
  };

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full min-h-[460px] text-left">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Globe size={16} className="text-blue-600" />
            <span>Interactive Multi-Agent Incident Map</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            World-wide vector nodes connected to MUNICIPAL-GRID coordinates ({issues.length} active incidents mapped)
          </p>
        </div>

        {/* Map Engine Selection Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between">
          {/* Heatmap Toggle Button */}
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showHeatmap
                ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-800'
            }`}
            title="Toggle Issue Density Heatmap"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${showHeatmap ? 'bg-orange-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>Density Heatmap</span>
          </button>

          <div className="flex bg-slate-100 border border-slate-200 p-0.5 rounded-lg text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setMapEngine('osm')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                mapEngine === 'osm'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              OpenStreetMap (Live)
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasValidKey) {
                  setMapEngine('google');
                } else {
                  setShowKeyEditor(true);
                }
              }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                mapEngine === 'google' && !isAuthFailed
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Google Maps
            </button>
          </div>

          {/* Key Settings Button */}
          <button
            type="button"
            onClick={() => setShowKeyEditor(!showKeyEditor)}
            className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Configure Google Maps API Key"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Dynamic Key Configuration Box */}
      {showKeyEditor && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 z-20 animate-fade-in">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Settings size={13} className="text-blue-600" />
              <span>Configure Google Maps API Key</span>
            </h4>
            <span className="text-[9px] text-slate-400 font-mono">Changes apply instantly</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            By default, we load the OpenStreetMap engine which provides high fidelity street views of the entire world with zero setup. If you wish to use Google Maps, insert your own Maps API key below:
          </p>
          <form onSubmit={handleSaveKey} className="flex gap-2">
            <input
              type="text"
              placeholder="AIzaSy..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
            >
              Apply Key
            </button>
            {customKey && (
              <button
                type="button"
                onClick={handleResetKey}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
              >
                Reset Default
              </button>
            )}
          </form>
        </div>
      )}

      {/* Alerts or Information Bar */}
      {isAuthFailed && (
        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 text-[10px] text-amber-800 rounded-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-600 animate-pulse" />
            <span>Google Maps failed to authorize due to invalid API credentials. OpenStreetMap has been auto-activated.</span>
          </div>
          <button
            type="button"
            onClick={handleResetKey}
            className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 rounded text-amber-900 border border-amber-300 font-bold font-mono"
          >
            Clear Stale Key
          </button>
        </div>
      )}

      {/* Map Canvas Frame */}
      <div className="relative flex-1 rounded-xl border border-slate-200 overflow-hidden min-h-[380px] h-[380px] bg-slate-50">
        {mapEngine === 'osm' ? (
          /* OpenStreetMap Canvas Container */
          <div ref={leafletMapContainerRef} className="w-full h-full z-10" />
        ) : (
          /* Google Maps Canvas */
          <APIProvider apiKey={ACTIVE_API_KEY} version="weekly" libraries={['visualization']}>
            <Map
              defaultCenter={WORLD_CENTER}
              defaultZoom={5}
              center={activeIssue ? { lat: activeIssue.lat, lng: activeIssue.lng } : undefined}
              zoom={activeIssue ? 15 : undefined}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              gestureHandling="cooperative"
              disableDefaultUI={false}
            >
              {showHeatmap && (
                <HeatmapLayer
                  points={issues.map((issue) => ({
                    lat: issue.lat,
                    lng: issue.lng,
                    weight: issue.severity || 1,
                  }))}
                />
              )}
              {issues.map((issue) => {
                const isActive = issue.status === 'Active';
                const isResolved = issue.status === 'Resolved';
                const isEscalated = issue.status === 'Escalated';
                const isCritical = issue.severity >= 8;

                return (
                  <AdvancedMarker
                    key={issue.id}
                    position={{ lat: issue.lat, lng: issue.lng }}
                    title={`${issue.id}: ${issue.title}`}
                    onClick={() => {
                      setActiveMarkerId(issue.id);
                      onSelectIssue(issue.id);
                    }}
                  >
                    <motion.div 
                      className="relative flex items-center justify-center cursor-pointer" 
                      style={{ width: '40px', height: '40px' }}
                      whileHover={{ scale: 1.25 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      {isActive && (
                        <div 
                          className={`absolute rounded-full opacity-45 animate-ping ${
                            isCritical ? 'bg-red-500' : 'bg-orange-400'
                          }`} 
                          style={{ width: '24px', height: '24px' }} 
                        />
                      )}

                      <div className={`w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-300 ${
                        isResolved
                          ? 'bg-emerald-500'
                          : isEscalated
                          ? 'bg-red-600 animate-pulse'
                          : isCritical
                          ? 'bg-red-500'
                          : 'bg-orange-400'
                      }`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>

                      <div className="absolute -bottom-1.5 px-1 py-0.5 bg-slate-900/90 text-[8px] text-white font-mono rounded border border-slate-800 shadow-sm whitespace-nowrap scale-90">
                        {issue.id}
                      </div>
                    </motion.div>
                  </AdvancedMarker>
                );
              })}

              {activeIssue && (
                <InfoWindow
                  position={{ lat: activeIssue.lat, lng: activeIssue.lng }}
                  onCloseClick={() => {
                    setActiveMarkerId(null);
                  }}
                >
                  <div className="p-1 max-w-[240px] space-y-2 text-slate-800">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {activeIssue.id}
                      </span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                        activeIssue.status === 'Resolved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : activeIssue.status === 'Escalated'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {activeIssue.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {activeIssue.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Ward: {activeIssue.ward.split(' ')[0]}
                      </p>
                    </div>

                    <p className="text-[10px] text-slate-600 line-clamp-2">
                      {activeIssue.description}
                    </p>

                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectIssue(activeIssue.id);
                          setActiveMarkerId(null);
                        }}
                        className="w-full py-1.5 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-colors"
                      >
                        <Eye size={11} />
                        <span>View Details & Agent Logs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsStreetViewOpen(true);
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <MapPin size={11} className="text-red-500" />
                        <span>Explore Street View</span>
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        )}

        {/* Legend Panel */}
        <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 p-2.5 rounded-xl z-10 max-w-[155px] pointer-events-none shadow-sm backdrop-blur-sm">
          <p className="text-[10px] font-mono tracking-wider font-bold text-slate-400 mb-1.5 uppercase">Telemetry Legend</p>
          <div className="space-y-1 text-[9px] text-slate-600 font-sans">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>Critical Active Incident</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Standard Grievance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              <span>Escalated Ward Danger</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Municipal Resolved Paving</span>
            </div>
          </div>
        </div>
      </div>

      {/* Street View Visualizer Modal overlay */}
      <StreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        lat={activeIssue?.lat || 18.5204}
        lng={activeIssue?.lng || 73.8567}
        title={activeIssue?.title || ''}
        locationName={activeIssue?.location || ''}
        apiKey={ACTIVE_API_KEY}
      />
    </div>
  );
}
