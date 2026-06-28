import React, { useState } from 'react';
import { CivicIssue } from '../types';
import {
  Search, Filter, MapPin, Calendar, User, ShieldAlert, AlertCircle,
  CheckCircle, ChevronRight, Cpu, Download, Sparkles, FileText, FileCheck, RefreshCw, Eye, Bell,
  Clock, Terminal, Sliders, Flame, ArrowRight, Check, Play, Square, FileJson
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReportsExplorerProps {
  issues: CivicIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onResolveIssue: (id: string) => void;
  onVerifyIssue?: (id: string) => void;
  followedIssueIds: string[];
  onToggleFollow: (id: string) => void;
}

export default function ReportsExplorer({
  issues,
  selectedIssueId,
  onSelectIssue,
  onResolveIssue,
  onVerifyIssue,
  followedIssueIds,
  onToggleFollow
}: ReportsExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'timeline' | 'agents' | 'letter'>('timeline');
  const [isResolving, setIsResolving] = useState(false);

  // Interactive Timeline state variables
  const [selectedEventId, setSelectedEventId] = useState<string>('citizen-submit');
  const [isTechnicalView, setIsTechnicalView] = useState<boolean>(false);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayStep, setReplayStep] = useState<number>(6); // Default to show all steps (0-6)
  const [citizenEscalatedIssues, setCitizenEscalatedIssues] = useState<Record<string, boolean>>({});
  const [isPingAnimating, setIsPingAnimating] = useState<boolean>(false);

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const matchesSearch =
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'All' || issue.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const selectedIssue = issues.find(i => i.id === selectedIssueId) || filteredIssues[0] || null;

  const handleResolveClick = async (id: string) => {
    setIsResolving(true);
    // Simulate some loading work
    setTimeout(() => {
      onResolveIssue(id);
      setIsResolving(false);
    }, 1500);
  };

  // Helper to generate a high-fidelity municipal complaint letter text based on the issue
  const generatePMCLetter = (issue: CivicIssue) => {
    const date = new Date(issue.reportedAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const city = issue.city || 'Mumbai Municipal Corporation';
    const state = issue.state || 'Maharashtra';
    const cityShort = city.replace(' Municipal Corporation', '').toUpperCase();
    
    let deptCommissioner = "The Joint Municipal Commissioner";
    let PMCdept = "Public Works Department (PWD)";
    
    if (issue.category === 'Water/Drainage') {
      deptCommissioner = "The Chief Engineer";
      PMCdept = `${cityShort} Water Supply & Drainage Board`;
    } else if (issue.category === 'Solid Waste') {
      deptCommissioner = "The Director of Solid Waste Management";
      PMCdept = "Solid Waste Management Division";
    } else if (issue.category === 'Electricity') {
      deptCommissioner = "The Executive Engineer (Electrical)";
      PMCdept = "State Electricity Distribution Division";
    } else if (issue.category === 'Parks') {
      deptCommissioner = "The Chief Garden Superintendent";
      PMCdept = `${cityShort} Horticulture & Gardens Department`;
    }

    return {
      reference: `${cityShort}/CIVIC-PULSE/REF-${issue.id.substring(2)}-2026`,
      to: `${deptCommissioner},\n${city} Headquarters,\n${city.replace(' Municipal Corporation', '')}, ${state}, India`,
      subject: `E-SCALATION: Redressal request for public hazard (${issue.category.toUpperCase()}) at ${issue.location}`,
      body: issue.agentResponses?.complaintDraft || `Respected Sir/Madam,

I am writing to formally log a community grievance on behalf of the residents of ${city.replace(' Municipal Corporation', '')}, filed through the CivicPulse AI Community Resolution Grid.

We have recorded a critical civic issue with the following details:
• Category / Classification: ${issue.category}
• Location / Landmark: ${issue.location} (Wards: ${issue.ward})
• Geo-Coordinates: Latitude ${issue.lat.toFixed(4)}, Longitude ${issue.lng.toFixed(4)}
• Severity Assessment: ${issue.severity}/10 (Priority: ${issue.priority})

Grievance Description:
"${issue.description}"

This issue represents a substantial public safety concern and is currently causing local disruption in the specified ${city.replace(' Municipal Corporation', '')} sector. Our telemetry analytics models have clustered this report with neighboring reports, raising its priority level.

We request you to direct the ward engineering team to inspect this site, isolate the damage, and execute necessary restorative maintenance on an emergency basis.

Thank you in anticipation.

Yours faithfully,
CivicPulse AI Resolution Agent & Connected Citizens
(Filer: ${issue.reportedBy})`,
      date
    };
  };

  const pmcLetter = selectedIssue ? generatePMCLetter(selectedIssue) : null;

  // Timeline Events Generator
  const getTimelineEvents = (issue: CivicIssue | null) => {
    if (!issue) return [];
    const baseDate = new Date(issue.reportedAt);
    
    const addSeconds = (date: Date, seconds: number) => {
      return new Date(date.getTime() + seconds * 1000);
    };

    const addDays = (date: Date, days: number) => {
      return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    };

    const orchestratorText = issue.agentResponses?.orchestrator || `Grievance report identified. Dispatched core AI orchestrator to evaluate incident.`;
    const classifierText = issue.agentResponses?.classifier || `Classified as ${issue.category} | Severity: ${issue.severity}/10 | Priority: ${issue.priority}`;
    const geoRouterText = issue.agentResponses?.geoRouter || `Assigned to ${issue.ward}. Coordinate validation verified.`;
    const resolutionText = issue.agentResponses?.resolution || `Formal municipal draft instantiated. Escalating to ${issue.department}.`;

    const events: {
      id: string;
      title: string;
      short: string;
      timestamp: Date;
      icon: string;
      color: string;
      status: string;
      telemetry: Record<string, any>;
      description: string;
    }[] = [
      {
        id: 'citizen-submit',
        title: 'Incident Intake Registered',
        short: `Reported by ${issue.reportedBy} at ${issue.location.split(',')[0]}`,
        timestamp: baseDate,
        icon: 'user',
        color: 'blue',
        status: 'Completed',
        telemetry: {
          event: "CITIZEN_GRIEVANCE_INTAKE",
          source: "CivicPulse Mobile Web",
          user_id: issue.reportedBy,
          assigned_issue_id: issue.id,
          priority_factor: issue.priority,
          coordinates: { lat: issue.lat, lng: issue.lng },
          reward_points_allocated: issue.points
        },
        description: `Grievance successfully submitted to the local community grid. Filer ${issue.reportedBy} allocated ${issue.points} points, fully redeemable across local transit systems.`
      },
      {
        id: 'orchestration',
        title: 'AI Multi-Agent Spawned',
        short: 'Autonomous agents spawned by Central Orchestrator',
        timestamp: addSeconds(baseDate, 4),
        icon: 'cpu',
        color: 'indigo',
        status: 'Completed',
        telemetry: {
          event: "ORCHESTRATOR_DISPATCH",
          pipeline_id: `CP-PIPELINE-${issue.id.substring(2)}`,
          active_workers: ["Classifier", "GeoRouter", "Resolution", "Insights"],
          system_latency_ms: 148,
          model_allocated: "gemini-3.5-flash"
        },
        description: orchestratorText
      },
      {
        id: 'classifier',
        title: 'Category & Severity Diagnostic',
        short: `Categorized: ${issue.category} | Severity: ${issue.severity}/10`,
        timestamp: addSeconds(baseDate, 12),
        icon: 'shield',
        color: 'teal',
        status: 'Completed',
        telemetry: {
          event: "CLASSIFIER_DIAGNOSTIC",
          category_match: issue.category,
          severity_coefficient: issue.severity,
          escalation_index: issue.priority,
          routing_department: issue.department,
          classification_confidence: 0.985
        },
        description: classifierText
      },
      {
        id: 'georouter',
        title: 'Ward Spatial Clustering',
        short: `Mapped to ${issue.ward.split(' ')[0]} ward`,
        timestamp: addSeconds(baseDate, 25),
        icon: 'pin',
        color: 'purple',
        status: 'Completed',
        telemetry: {
          event: "SPATIAL_CLUSTER_MAPPING",
          assigned_sector: issue.ward,
          duplicate_analysis: "0 matches within 120m radius",
          cluster_id: `${issue.city?.replace(' Municipal Corporation', '').toUpperCase() || 'MUNICIPAL'}-GRID-${issue.id.substring(2)}`,
          gis_reference_index: "GIS-411" + Math.floor(100 + Math.random() * 900)
        },
        description: geoRouterText
      },
      {
        id: 'resolution-draft',
        title: 'Municipal SLA & Letter Dispatched',
        short: `Complaint logged | SLA Lock: ${issue.status === 'Resolved' ? 'Closed' : issue.status === 'Escalated' ? 'Exceeded' : 'Active'}`,
        timestamp: addSeconds(baseDate, 45),
        icon: 'letter',
        color: 'pink',
        status: 'Completed',
        telemetry: {
          event: "COMPLAINT_SLA_ACTIVATION",
          recipient_agency: issue.department,
          response_limit_days: 3,
          compliance_standard: "MUNICIPAL-CITIZEN-ACT-2015",
          verification_seal: "SECURE-SYSTEM-SEAL-VERIFIED"
        },
        description: resolutionText
      },
      {
        id: 'field-inspection',
        title: 'Ward Site Inspection',
        short: issue.status === 'Resolved' ? 'Site evaluation complete' : 'Inspection queued in maintenance log',
        timestamp: addDays(baseDate, 1),
        icon: 'calendar',
        color: issue.status === 'Resolved' ? 'emerald' : 'amber',
        status: issue.status === 'Resolved' ? 'Completed' : 'In Progress',
        telemetry: {
          event: "WARD_FIELD_INSPECTION",
          dispatch_team: `${issue.city?.replace(' Municipal Corporation', '').toUpperCase() || 'MUNICIPAL'}-ENG-UNIT-${issue.id.substring(2)}`,
          current_phase: issue.status === 'Resolved' ? "Remediation Complete" : "Scheduled / Queued",
          site_access: "Approved"
        },
        description: issue.status === 'Resolved'
          ? `Municipal field engineers inspected the site at ${issue.location}. Damage isolated and structural remedial measures approved.`
          : `${issue.city?.replace(' Municipal Corporation', '') || 'Municipal'} Ward maintenance unit has scheduled physical inspection. Ward engineers will assess ${issue.location} within the SLA window.`
      }
    ];

    // If citizen fast-tracked this issue, add the fast-track event before the final resolution event
    if (citizenEscalatedIssues[issue.id]) {
      events.push({
        id: 'citizen-fast-track',
        title: 'Urgent Citizen Fast-Track Registered',
        short: 'High-frequency ward notification pinged',
        timestamp: new Date(),
        icon: 'flame',
        color: 'orange',
        status: 'Completed',
        telemetry: {
          event: "CITIZEN_PRIORITY_BOOST",
          trigger: "User Fast-Track Action",
          ping_frequency: "5Hz (Urgent)",
          sent_to: issue.department
        },
        description: `Verified community user triggered an urgent fast-track signal. CivicPulse AI re-sent high-frequency priority pings to ${issue.department} to expedite physical resolution.`
      });
    }

    // Add final outcome event
    if (issue.status === 'Resolved') {
      events.push({
        id: 'resolution-final',
        title: 'Remediation Verified & Resolved',
        short: 'Remedial works completed',
        timestamp: addDays(baseDate, 1.5),
        icon: 'check',
        color: 'emerald',
        status: 'Completed',
        telemetry: {
          event: "RESOLUTION_AUDIT_CLOSED",
          remediation_cost_simulated: "₹" + Math.floor(5000 + Math.random() * 15000),
          quality_assurance_index: 0.95,
          verification_agent: "Resolution Agent",
          final_status: "RESOLVED"
        },
        description: `Remedial works completed at ${issue.location}. Site verified, photo-cleared by CivicPulse AI audit, and officially closed with full civic resolution records.`
      });
    } else if (issue.status === 'Escalated') {
      events.push({
        id: 'escalation-final',
        title: 'SLA Breach - Escalated to Central Headquarters',
        short: 'Escalated to Chief Commissioner',
        timestamp: addDays(baseDate, 2),
        icon: 'alert',
        color: 'red',
        status: 'Completed',
        telemetry: {
          event: "SLA_BREACH_ESCALATION",
          breach_duration_hours: 48,
          target_authority: `Chief Joint Municipal Commissioner, ${issue.city?.replace(' Municipal Corporation', '') || 'Municipal'}`,
          audit_level: "Tier-1 Central Grievance",
          system_action: "Automated Escalation Protocol"
        },
        description: `Grievance response limit exceeded standard SLA guidelines. Automatic escalation protocol activated, routing full diagnostic records directly to the Chief Joint Municipal Commissioner, ${issue.city?.replace(' Municipal Corporation', '') || 'local Municipal Corporation'}.`
      });
    } else {
      events.push({
        id: 'pending-final',
        title: 'Awaiting Municipal Action',
        short: `Active SLA: ${issue.department}`,
        timestamp: addDays(baseDate, 3),
        icon: 'clock',
        color: 'slate',
        status: 'Pending',
        telemetry: {
          event: "SLA_SURVEILLANCE_ACTIVE",
          time_remaining: "Pending Field Team Site Update",
          surveillance_frequency: "Hourly poll cycle",
          next_health_check: "Active"
        },
        description: `Surveillance loop actively tracking response metrics. Grievance remains open and is monitored by CivicPulse AI for SLA compliance.`
      });
    }

    return events;
  };

  const renderTimelineIcon = (icon: string, color: string) => {
    const iconSize = 13;
    let IconComponent = Clock;
    if (icon === 'user') IconComponent = User;
    else if (icon === 'cpu') IconComponent = Cpu;
    else if (icon === 'shield') IconComponent = ShieldAlert;
    else if (icon === 'pin') IconComponent = MapPin;
    else if (icon === 'letter') IconComponent = FileText;
    else if (icon === 'calendar') IconComponent = Calendar;
    else if (icon === 'check') IconComponent = CheckCircle;
    else if (icon === 'alert') IconComponent = AlertCircle;
    else if (icon === 'flame') IconComponent = Flame;

    let bgStyle = 'bg-slate-100 text-slate-500 border-slate-200';
    if (color === 'blue') bgStyle = 'bg-blue-50 text-blue-600 border-blue-200';
    else if (color === 'indigo') bgStyle = 'bg-indigo-50 text-indigo-600 border-indigo-200';
    else if (color === 'teal') bgStyle = 'bg-teal-50 text-teal-600 border-teal-200';
    else if (color === 'purple') bgStyle = 'bg-purple-50 text-purple-600 border-purple-200';
    else if (color === 'pink') bgStyle = 'bg-pink-50 text-pink-600 border-pink-200';
    else if (color === 'amber') bgStyle = 'bg-amber-50 text-amber-600 border-amber-200';
    else if (color === 'orange') bgStyle = 'bg-orange-50 text-orange-600 border-orange-200';
    else if (color === 'emerald') bgStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200';
    else if (color === 'red') bgStyle = 'bg-red-50 text-red-600 border-red-200';

    return (
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 shadow-sm z-10 transition-transform hover:scale-110 ${bgStyle}`}>
        <IconComponent size={iconSize} />
      </div>
    );
  };

  // Reset timeline selection and steps when selectedIssue changes
  React.useEffect(() => {
    if (selectedIssue) {
      const events = getTimelineEvents(selectedIssue);
      setSelectedEventId(events[events.length - 1]?.id || 'citizen-submit');
      setReplayStep(events.length - 1);
      setIsReplaying(false);
    }
  }, [selectedIssueId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full max-h-[85vh] overflow-hidden">
      {/* Sidebar - Issues list */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden max-h-[75vh] lg:max-h-[85vh] shadow-sm">
        
        {/* Sidebar Header & Filters */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports by ID, location, title..."
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-[11px] text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Roads/Potholes">Roads/Potholes</option>
              <option value="Water/Drainage">Water/Drainage</option>
              <option value="Solid Waste">Solid Waste</option>
              <option value="Electricity">Electricity</option>
              <option value="Parks">Parks/Trees</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-[11px] text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <AlertCircle className="mx-auto" size={24} />
              <p className="text-xs">No matching civic reports found.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isSelected = selectedIssue?.id === issue.id;
              const isCritical = issue.severity >= 8;
              return (
                <div
                  key={issue.id}
                  onClick={() => onSelectIssue(issue.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all flex justify-between items-start border ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-200 shadow-sm'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1.5 max-w-[80%]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        {issue.id}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                        issue.status === 'Resolved'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-red-50 text-red-600 border-red-100 animate-pulse'
                      }`}>
                        {issue.status.toUpperCase()}
                      </span>
                      {followedIssueIds.includes(issue.id) && (
                        <span className="text-[9px] px-1 bg-blue-50 text-blue-600 border border-blue-100 rounded font-bold flex items-center gap-0.5 animate-pulse-slow" title="You are following this issue">
                          <Bell size={8} className="fill-blue-600 text-blue-600" />
                          <span>WATCHING</span>
                        </span>
                      )}
                    </div>

                    <h5 className="text-xs font-semibold text-slate-800 truncate">{issue.title}</h5>

                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{issue.location.split(',')[0]}</span>
                    </p>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                      isCritical ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      SEV: {issue.severity}/10
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(issue.reportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Panel - Detail View */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden max-h-[75vh] lg:max-h-[85vh] shadow-sm">
        {selectedIssue ? (
          <>
            {/* Detail Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    {selectedIssue.id}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold border ${
                    selectedIssue.status === 'Resolved'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-red-50 text-red-600 border-red-100 animate-pulse'
                  }`}>
                    {selectedIssue.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">| {selectedIssue.ward.split(' ')[0]} Ward</span>
                  {followedIssueIds.includes(selectedIssue.id) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border bg-blue-50 text-blue-600 border-blue-100 flex items-center gap-1 animate-pulse-slow">
                      <Bell size={10} className="fill-blue-600" />
                      <span>FOLLOWED</span>
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-bold text-slate-900 font-display leading-tight">{selectedIssue.title}</h4>
              </div>

              {/* Action triggers and Follow button */}
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onVerifyIssue && onVerifyIssue(selectedIssue.id)}
                  className="font-semibold text-xs py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  title="Verify this issue to increase its priority and earn civic points"
                >
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span>Verify ({selectedIssue.verificationCount || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFollow(selectedIssue.id)}
                  className={`font-semibold text-xs py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all border ${
                    followedIssueIds.includes(selectedIssue.id)
                      ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/70'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                  title={followedIssueIds.includes(selectedIssue.id) ? "Stop following updates" : "Get notifications when this issue is updated or resolved"}
                >
                  <Bell size={14} className={followedIssueIds.includes(selectedIssue.id) ? "fill-blue-600 text-blue-600 animate-pulse" : ""} />
                  <span>{followedIssueIds.includes(selectedIssue.id) ? 'Following' : 'Follow Updates'}</span>
                </button>

                {selectedIssue.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => handleResolveClick(selectedIssue.id)}
                    disabled={isResolving}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm flex-shrink-0"
                  >
                    {isResolving ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>{isResolving ? 'Resolving...' : 'Simulate Municipal Resolution'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Toggle Tabs */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50/30">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`py-3 px-4 font-mono text-[11px] font-bold tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock size={14} />
                <span>STATUS TIMELINE</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('agents')}
                className={`py-3 px-4 font-mono text-[11px] font-bold tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'agents'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cpu size={14} />
                <span>4-AGENT ORCHESTRATION</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('letter')}
                className={`py-3 px-4 font-mono text-[11px] font-bold tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'letter'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText size={14} />
                <span>MUNICIPAL COMPLAINT DRAFT</span>
              </button>
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <AnimatePresence mode="wait">
                {activeTab === 'timeline' ? (
                  /* Timeline tab */
                  <motion.div
                    key="timeline-tab"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="grid grid-cols-1 md:grid-cols-12 gap-6"
                  >
                    {/* Left Column: Timeline list and Controls */}
                    <div className="md:col-span-7 space-y-4">
                      
                      {/* Timeline Controls */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (isReplaying) {
                                setIsReplaying(false);
                              } else {
                                setIsReplaying(true);
                                setReplayStep(0);
                                const events = getTimelineEvents(selectedIssue);
                                setSelectedEventId(events[0]?.id || 'citizen-submit');
                                let currentStep = 0;
                                const interval = setInterval(() => {
                                  currentStep += 1;
                                  if (currentStep < events.length) {
                                    setReplayStep(currentStep);
                                    setSelectedEventId(events[currentStep].id);
                                  } else {
                                    setIsReplaying(false);
                                    clearInterval(interval);
                                  }
                                }, 1000);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition-all ${
                              isReplaying
                                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {isReplaying ? (
                              <>
                                <Square size={10} className="fill-white text-white" />
                                <span>STOP REPLAY</span>
                              </>
                            ) : (
                              <>
                                <Play size={10} className="fill-white text-white" />
                                <span>REPLAY PIPELINE</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsTechnicalView(!isTechnicalView)}
                            className={`px-3 py-1.5 border rounded-lg text-[10px] font-bold font-mono flex items-center gap-1.5 cursor-pointer transition-all ${
                              isTechnicalView
                                ? 'bg-slate-800 text-slate-100 border-slate-700 shadow-inner'
                                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-800'
                            }`}
                          >
                            <FileJson size={10} />
                            <span>{isTechnicalView ? 'DEVELOPER JSON' : 'HUMAN READABLE'}</span>
                          </button>
                        </div>

                        <div className="text-[9px] font-mono font-bold text-slate-500">
                          {isReplaying ? `Replaying step ${replayStep + 1}/${getTimelineEvents(selectedIssue).length}` : 'Surveillance: Online'}
                        </div>
                      </div>

                      {/* Timeline List */}
                      <div className="relative pl-6 space-y-4 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                        {getTimelineEvents(selectedIssue).map((event, idx) => {
                          if (idx > replayStep) return null;
                          const isSelected = selectedEventId === event.id;

                          return (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: isReplaying ? 0 : idx * 0.05 }}
                              onClick={() => setSelectedEventId(event.id)}
                              className={`relative group p-3 rounded-xl border cursor-pointer transition-all flex gap-3 items-start ${
                                isSelected
                                  ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                                  : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
                              }`}
                            >
                              {/* Timeline dot */}
                              <div className="absolute -left-[27px] top-3 bg-white pr-2">
                                {renderTimelineIcon(event.icon, event.color)}
                              </div>

                              {/* Content */}
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-center">
                                  <h4 className={`text-xs font-bold leading-none ${
                                    isSelected ? 'text-blue-700' : 'text-slate-800'
                                  }`}>
                                    {event.title}
                                  </h4>
                                  <span className="text-[9px] font-mono text-slate-400">
                                    {event.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1">
                                  {event.short}
                                </p>
                              </div>

                              {/* Active indicator */}
                              {isSelected && (
                                <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              )}
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Interactive SLA Fast-Track CTA */}
                      {selectedIssue.status !== 'Resolved' && (
                        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-2 relative overflow-hidden">
                          {isPingAnimating && (
                            <div className="absolute inset-0 bg-orange-100/40 animate-ping pointer-events-none" style={{ animationDuration: '1.5s' }} />
                          )}
                          <div className="flex items-center gap-2">
                            <Flame className="text-orange-600 animate-pulse" size={16} />
                            <h5 className="text-xs font-bold text-orange-900">Ward Escalation Signal Panel</h5>
                          </div>
                          <p className="text-[10px] text-orange-800 leading-relaxed">
                            Is this issue causing major local blockages or risks? Verified community citizens can send high-frequency priority pings to municipal administrators.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (citizenEscalatedIssues[selectedIssue.id]) {
                                  alert("Grievance has already been prioritized. Automated high-frequency signals are already pulsing.");
                                  return;
                                }
                                setIsPingAnimating(true);
                                setTimeout(() => setIsPingAnimating(false), 1500);

                                setCitizenEscalatedIssues(prev => ({
                                  ...prev,
                                  [selectedIssue.id]: true
                                }));

                                alert(`SLA escalation signal broadcasted successfully to ${selectedIssue.department}! Urgent attention logged.`);
                                
                                const events = getTimelineEvents(selectedIssue);
                                setReplayStep(events.length); // will now include custom fast-track step
                                setSelectedEventId('citizen-fast-track');
                              }}
                              className={`py-1.5 px-3.5 rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                                citizenEscalatedIssues[selectedIssue.id]
                                  ? 'bg-orange-100 text-orange-800 border border-orange-300 cursor-not-allowed'
                                  : 'bg-orange-600 hover:bg-orange-500 text-white'
                              }`}
                            >
                              <Bell size={11} className={citizenEscalatedIssues[selectedIssue.id] ? "" : "animate-bounce"} />
                              <span>{citizenEscalatedIssues[selectedIssue.id] ? 'Fast-Track Signal Active' : 'Send Fast-Track Signal'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Interactive Event Inspector / Telemetry Payloads */}
                    <div className="md:col-span-5 space-y-4">
                      {/* Media Evidence Display */}
                      {selectedIssue.imageUrl && (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                          <div className="p-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Attached Media Evidence</span>
                            <span className="text-[9px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">VERIFIED NODE</span>
                          </div>
                          <div className="w-full h-40 bg-slate-100 relative">
                            <img 
                              src={selectedIssue.imageUrl} 
                              alt="Issue evidence" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=500&auto=format&fit=crop';
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col min-h-[350px]">
                        
                        {/* Inspector Header */}
                        <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <Terminal size={12} className="text-blue-400" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">STATE INSPECTOR</span>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-mono font-bold rounded border border-blue-500/20">
                            ID: {selectedIssue.id}
                          </span>
                        </div>

                        {/* Inspector Content */}
                        {(() => {
                          const allEvents = getTimelineEvents(selectedIssue);
                          const activeEvent = allEvents.find(e => e.id === selectedEventId) || allEvents[allEvents.length - 1] || allEvents[0];
                          if (!activeEvent) return (
                            <div className="p-8 text-center text-slate-500 text-xs flex-1 flex flex-col justify-center items-center">
                              <Sliders size={20} className="mb-2 animate-pulse text-slate-600" />
                              <span>Click any timeline event on the left to inspect detailed telemetry.</span>
                            </div>
                          );

                          return (
                            <div className="p-4 flex-1 flex flex-col justify-between space-y-4 overflow-y-auto">
                              <div className="space-y-3">
                                <div>
                                  <span className="text-[9px] font-mono font-bold tracking-widest text-blue-400 uppercase">
                                    {activeEvent.id.replace('-', ' ')} STATE
                                  </span>
                                  <h3 className="text-sm font-bold text-white mt-0.5">{activeEvent.title}</h3>
                                  <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                                    TIMESTAMP: {activeEvent.timestamp.toLocaleString('en-IN')}
                                  </p>
                                </div>

                                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                    {activeEvent.description}
                                  </p>
                                </div>
                              </div>

                              {/* Telemetry section */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-mono font-bold text-slate-400">TELEMETRY PAYLOAD</span>
                                  <span className="text-[8px] font-mono text-emerald-400">SECURE DISPATCH ✓</span>
                                </div>
                                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-[10px] font-mono text-emerald-400 overflow-x-auto select-all max-h-[160px]">
                                  <code>
                                    {isTechnicalView 
                                      ? JSON.stringify(activeEvent.telemetry, null, 2)
                                      : `{\n  "status": "${activeEvent.status}",\n  "phase": "${activeEvent.title}",\n  "label": "${activeEvent.short}",\n  "details": "Switch to DEVELOPER JSON to see custom raw API response blocks"\n}`
                                    }
                                  </code>
                                </pre>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </motion.div>
                ) : activeTab === 'agents' ? (
                  /* 4-Agent logs tab */
                  <motion.div
                    key="agents-tab"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-5"
                  >
                    {/* Agent Pipeline Diagram */}
                    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl shadow-inner border border-slate-800">
                      <div className="flex items-center gap-2 text-teal-400 font-mono text-[10px] font-bold">
                        <span className="bg-teal-950 px-2 py-1 rounded border border-teal-800">CLASSIFIER</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-600" />
                      <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] font-bold">
                        <span className="bg-indigo-950 px-2 py-1 rounded border border-indigo-800">GEO-ROUTER</span>
                      </div>
                      <ArrowRight size={14} className="text-slate-600" />
                      <div className="flex items-center gap-2 text-pink-400 font-mono text-[10px] font-bold">
                        <span className="bg-pink-950 px-2 py-1 rounded border border-pink-800">RESOLUTION AGENT</span>
                      </div>
                    </div>

                    {/* Citizen description block */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-4 items-start">
                      {selectedIssue.imageUrl && (
                        <div className="h-20 w-full md:w-28 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                          <img
                            src={selectedIssue.imageUrl}
                            alt="Filer visual capture"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="space-y-1.5 flex-1">
                        <p className="text-xs text-slate-700 italic font-medium">"{selectedIssue.description}"</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono">
                          <span className="flex items-center gap-1"><User size={10} /> Reported by: {selectedIssue.reportedBy}</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> Date: {new Date(selectedIssue.reportedAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><MapPin size={10} /> Coordinates: Lat {selectedIssue.lat.toFixed(4)}, Lng {selectedIssue.lng.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-4">
                      {/* 1. Orchestrator Card */}
                      <div className="border-l-4 border-blue-600 pl-4 space-y-1">
                        <p className="text-xs font-mono font-bold text-blue-700 flex items-center gap-1.5">
                          <span>🧠</span> ORCHESTRATOR
                        </p>
                        <p className="text-xs text-slate-600 font-sans leading-relaxed">
                          {selectedIssue.agentResponses?.orchestrator || `Acknowledged grievance report. Activated core multi-agent framework.`}
                        </p>
                      </div>

                      {/* 2. Classifier Card */}
                      <div className="border-l-4 border-teal-500 pl-4 space-y-1">
                        <p className="text-xs font-mono font-bold text-teal-700 flex items-center gap-1.5">
                          <span>🔍</span> CLASSIFIER AGENT
                        </p>
                        <p className="text-xs text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                          {selectedIssue.agentResponses?.classifier.replace('🔍 CLASSIFIER AGENT', '') || `Classified as ${selectedIssue.category} with severity of ${selectedIssue.severity}/10.`}
                        </p>
                      </div>

                      {/* 3. Geo-Router Card */}
                      <div className="border-l-4 border-indigo-500 pl-4 space-y-1">
                        <p className="text-xs font-mono font-bold text-indigo-700 flex items-center gap-1.5">
                          <span>📍</span> GEO-ROUTER AGENT
                        </p>
                        <p className="text-xs text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                          {selectedIssue.agentResponses?.geoRouter.replace('📍 GEO-ROUTER AGENT', '') || `Allocated ward sector as ${selectedIssue.ward}. Duplicate check verified.`}
                        </p>
                      </div>

                      {/* 4. Resolution Card */}
                      <div className="border-l-4 border-pink-500 pl-4 space-y-1">
                        <p className="text-xs font-mono font-bold text-pink-700 flex items-center gap-1.5">
                          <span>📄</span> RESOLUTION AGENT
                        </p>
                        <p className="text-xs text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                          {selectedIssue.agentResponses?.resolution.replace('📄 RESOLUTION AGENT', '') || `Complaint drafted. Routed to relevant Municipal Engineering Department.`}
                        </p>
                      </div>

                      {/* 5. Insights Card */}
                      <div className="border-l-4 border-amber-500 pl-4 space-y-1">
                        <p className="text-xs font-mono font-bold text-amber-700 flex items-center gap-1.5">
                          <span>📊</span> INSIGHTS AGENT
                        </p>
                        <p className="text-xs text-slate-600 font-sans leading-relaxed whitespace-pre-wrap">
                          {selectedIssue.agentResponses?.insights.replace('📊 INSIGHTS AGENT', '') || `Infrastructure forecasting alert calculated successfully.`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* Municipal Styled Letterhead Tab */
                  <motion.div
                    key="letter-tab"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-4"
                  >
                    <div className="p-6 bg-white border border-slate-200 text-slate-900 rounded-xl shadow-lg relative overflow-hidden font-sans">
                      
                      {/* Letterhead Header */}
                      <div className="border-b-2 border-double border-slate-900 pb-4 text-center space-y-1.5 relative">
                        <h2 className="text-base font-extrabold tracking-wide text-slate-900 uppercase">{selectedIssue?.city || 'Municipal Corporation'}</h2>
                        <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Civic Grievance & Complaint Department</p>
                        <p className="text-[9px] text-slate-400 italic">Central Municipal Headquarters, {selectedIssue?.city?.replace(' Municipal Corporation', '') || 'Municipal'}, {selectedIssue?.state || 'Maharashtra'}, India</p>
                      </div>

                      {/* Letterhead Fields */}
                      <div className="pt-4 flex justify-between text-[11px] font-mono text-slate-600 mb-6">
                        <div>
                          <strong>REF:</strong> {pmcLetter?.reference}
                        </div>
                        <div>
                          <strong>DATE:</strong> {pmcLetter?.date}
                        </div>
                      </div>

                      {/* Letterhead Content */}
                      <div className="space-y-4 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                        <div>
                          <strong className="text-slate-900 block mb-1">TO,</strong>
                          {pmcLetter?.to}
                        </div>

                        <div>
                          <strong className="text-slate-900 block mb-1">SUBJECT:</strong>
                          <span className="underline font-semibold text-slate-950">{pmcLetter?.subject}</span>
                        </div>

                        <div className="pt-2 font-serif text-[13px] text-slate-900">
                          {pmcLetter?.body}
                        </div>
                      </div>

                      {/* Stamp Footer */}
                      <div className="pt-8 mt-8 border-t border-slate-100 flex justify-between items-end">
                        <div className="text-[9px] text-slate-400 font-mono">
                          SECURE ELECTRONIC DISPATCH | MUNICIPAL-GATEWAY-2.4
                        </div>
                        <div className="text-right space-y-1">
                          <div className="h-12 w-12 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-600 bg-emerald-50/50 mx-auto transform rotate-12">
                            <FileCheck size={20} />
                          </div>
                          <span className="text-[9px] font-semibold font-mono text-slate-500 block uppercase tracking-wider">Verified System Seal</span>
                        </div>
                      </div>
                    </div>

                    {/* Copy / Print helper */}
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(pmcLetter?.body || '');
                          alert("Official Municipal Complaint Letter copied to clipboard!");
                        }}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-mono text-[10px] py-1.5 px-3.5 rounded-lg border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <FileText size={12} />
                        <span>Copy Letter Text</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </>
        ) : (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
            <Cpu className="animate-pulse mb-3 text-slate-300" size={32} />
            <p className="text-sm font-medium text-slate-500">Select any active civic issue from the left catalog to examine agent orchestration logs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
