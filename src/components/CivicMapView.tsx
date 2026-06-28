import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { CivicIssue } from '../types';
import { MapPin, Eye, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import StreetViewModal from './StreetViewModal';

interface CivicMapViewProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
}

const ACTIVE_API_KEY = 'AIzaSyBsDZElnhpfKp-DrtQ-StRh0E5tz05bdFo';

export default function CivicMapView({ issues, selectedIssueId, onSelectIssue }: CivicMapViewProps) {
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);

  const WORLD_CENTER = { lat: 20.5937, lng: 78.9629 }; // India default center
  const activeIssue = issues.find((i) => i.id === selectedIssueId);

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
      </div>

      {/* Map Canvas Frame */}
      <div className="relative flex-1 rounded-xl border border-slate-200 overflow-hidden min-h-[380px] h-[380px] bg-slate-50">
        <APIProvider apiKey={ACTIVE_API_KEY} version="weekly">
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

                    <div className={`w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-300 ${
                      isResolved
                        ? 'bg-emerald-500'
                        : isEscalated
                        ? 'bg-red-600 animate-pulse'
                        : isCritical
                        ? 'bg-red-600'
                        : 'bg-orange-500'
                    }`}>
                      <MapPin size={16} className="text-white" />
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
