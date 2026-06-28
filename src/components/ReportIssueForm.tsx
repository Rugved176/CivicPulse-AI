import React, { useState, useEffect } from 'react';
import { CivicIssue, AgentResponses } from '../types';
import {
  FileText, MapPin, Tag, User, Camera, ShieldAlert,
  Loader2, Cpu, CheckCircle, AlertCircle, ArrowRight, Zap, Download, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LocationPicker from './LocationPicker';

interface ReportIssueFormProps {
  onIssueReported: (issue: CivicIssue) => void;
  onClose: () => void;
  defaultReporterName?: string;
}

// Category preset images for high fidelity
const IMAGE_PRESETS = {
  'Roads/Potholes': 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?w=600&auto=format&fit=crop',
  'Water/Drainage': 'https://images.unsplash.com/photo-1542060748-10c28b629f6f?w=600&auto=format&fit=crop',
  'Solid Waste': 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600&auto=format&fit=crop',
  'Electricity': 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=600&auto=format&fit=crop',
  'Parks': 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=600&auto=format&fit=crop',
};

// General landmarks for quick reference
const COMMON_LANDMARKS = [
  "Main Street, Central Area",
  "Station Road, near Railway Gate",
  "Ring Road, near Bypass Circle",
  "Sector 4, Market Complex",
  "Gandhi Road, near Town Hall",
  "Civic Center, near Public Park"
];

export default function ReportIssueForm({ onIssueReported, onClose, defaultReporterName = '' }: ReportIssueFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CivicIssue['category']>('Roads/Potholes');
  const [location, setLocation] = useState('');
  const [reportedBy, setReportedBy] = useState(defaultReporterName);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [state, setState] = useState('Maharashtra');
  const [city, setCity] = useState('Municipal Corporation');
  const [isDrafting, setIsDrafting] = useState(false);
  const [imageFileBase64, setImageFileBase64] = useState<string | undefined>(undefined);
  const [imageFileName, setImageFileName] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoDraft = async () => {
    const promptText = title.trim() + " " + description.trim();
    if (!promptText.trim()) return;
    
    setIsDrafting(true);
    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText })
      });
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.draft) setDescription(data.draft);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDrafting(false);
    }
  };
  
  // Update reportedBy when user profile logins
  useEffect(() => {
    if (defaultReporterName) {
      setReportedBy(defaultReporterName);
    }
  }, [defaultReporterName]);

  // Synchronize state and city fields based on map selected location address
  useEffect(() => {
    if (selectedLocation?.address) {
      const addr = selectedLocation.address.toLowerCase();
      // Try to match state
      if (addr.includes("maharashtra")) {
        setState("Maharashtra");
      } else if (addr.includes("gujarat")) {
        setState("Gujarat");
      } else if (addr.includes("delhi")) {
        setState("Delhi");
      } else if (addr.includes("karnataka")) {
        setState("Karnataka");
      } else {
        const parts = selectedLocation.address.split(',');
        if (parts.length > 1) {
          const possibleState = parts[parts.length - 2]?.trim();
          if (possibleState && possibleState.length > 2 && !/\d/.test(possibleState)) {
            setState(possibleState);
          }
        }
      }
      
      // Try to match city/corporation
      if (addr.includes("pune")) {
        setCity("Pune Municipal Corporation");
      } else if (addr.includes("dhule") || addr.includes("dubl") || addr.includes("sakri")) {
        setCity("Dhule Municipal Corporation");
      } else if (addr.includes("mumbai")) {
        setCity("Mumbai Municipal Corporation");
      } else if (addr.includes("bangalore") || addr.includes("bengaluru")) {
        setCity("Bengaluru Municipal Corporation");
      } else {
        const parts = selectedLocation.address.split(',');
        const possibleCity = parts[Math.max(0, parts.length - 4)]?.trim();
        if (possibleCity && possibleCity.length > 2 && !/\d/.test(possibleCity)) {
          setCity(`${possibleCity} Municipal Corporation`);
        }
      }
    }
  }, [selectedLocation]);
  
  // Submission orchestration states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [orchestratorStep, setOrchestratorStep] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<CivicIssue | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Quick select location handler
  const handleQuickLocation = (loc: string) => {
    setLocation(loc);
    // Autofill title matching location category if simple
    if (loc.includes("Koregaon")) {
      setCategory("Roads/Potholes");
      setTitle("Severe pothole cluster blocking Lane 4 traffic");
    } else if (loc.includes("FC Road")) {
      setCategory("Electricity");
      setTitle("Low hanging electrical wire near traffic signal");
    } else if (loc.includes("DP Road")) {
      setCategory("Solid Waste");
      setTitle("Overflowing garbage containers onto primary sidewalk");
    } else if (loc.includes("Gliding")) {
      setCategory("Water/Drainage");
      setTitle("Freshwater underground main leak causing flooding");
    } else if (loc.includes("Sambhaji")) {
      setCategory("Parks");
      setTitle("Uprooted tree branch blocking park walking path");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !location || !reportedBy) {
      setErrorMessage("All fields are required to run multi-agent civic analysis.");
      return;
    }

    setIsCheckingDuplicate(true);
    try {
        const dupRes = await fetch('/api/check-duplicates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, location, description })
        });
        const dupData = await dupRes.json();
        if (dupData.duplicate) {
            setErrorMessage(`Duplicate likely: A similar issue was reported recently. (Reason: ${dupData.reason}) - Please upvote the existing report ${dupData.duplicate} instead.`);
            setIsCheckingDuplicate(false);
            return;
        }
    } catch (err) { }
    setIsCheckingDuplicate(false);

    setErrorMessage('');
    setIsSubmitting(true);
    setOrchestratorStep(0);
    
    // Simulate pipeline
    const steps = [
      "Classifier Agent analyzing image...",
      "Geo-Router Agent locating nearest ward...",
      "Resolution Agent assigning department...",
      "Insights Agent updating risk model..."
    ];
    
    for (let i = 0; i <= steps.length; i++) {
        await new Promise(r => setTimeout(r, 1000));
        setOrchestratorStep(i + 1);
    }
    
    setOrchestratorStep(steps.length + 1);

    try {
      const payload = {
        title,
        description,
        category,
        location,
        reportedBy,
        imageUrl: imageFileBase64 || IMAGE_PRESETS[category],
        lat: selectedLocation?.lat,
        lng: selectedLocation?.lng,
        state,
        city
      };

      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok || (contentType && !contentType.includes("application/json"))) {
        throw new Error("Server failed to run agent orchestration model or returned invalid data.");
      }

      const issueData: CivicIssue = await response.json();
      setSubmissionResult(issueData);

      // Staged timing loops to animate the 4 sub-agents beautifully
      // Step 1: Orchestrator active (0s)
      // Step 2: Classifier running (1.5s)
      // Step 3: Geo-Router running (3s)
      // Step 4: Resolution drafting complaint (4.5s)
      // Step 5: Insights compiling (6s)
      // Step 6: Complete summary reveal (7.5s)
      
      const timings = [1500, 3000, 4500, 6000, 7500];
      timings.forEach((ms, index) => {
        setTimeout(() => {
          setOrchestratorStep(index + 2);
        }, ms);
      });

    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (submissionResult) {
      onIssueReported(submissionResult);
    }
    onClose();
  };

  // Helper to get formatted department code
  const getDeptCode = () => {
    switch (category) {
      case "Roads/Potholes": return "PWD";
      case "Water/Drainage": return "WTW";
      case "Solid Waste": return "SWM";
      case "Electricity": return "MSD";
      case "Parks": return "HRT";
    }
  };

  return (
    <div id="report-issue-modal" className="bg-white border border-slate-200 rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]">
      
      <AnimatePresence mode="wait">
        {!isSubmitting ? (
          /* Form Entry Screen */
          <motion.div
            key="form-entry"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col md:flex-row w-full"
          >
            {/* Visual Column */}
            <div className="md:w-5/12 bg-slate-50 p-6 flex flex-col justify-between border-r border-slate-200">
              <div className="space-y-4">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <Cpu size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-display">CivicPulse AI Portal</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    An intelligent civic pipeline. Once reported, 4 autonomous LLM agents classify, cluster-check, draft formal municipal complaints, and run failure forecasting models in seconds.
                  </p>
                </div>
              </div>

              {/* Universal Jurisdiction Notice */}
              <div className="space-y-2 mt-6 bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                <p className="text-[10px] font-mono uppercase tracking-wider text-blue-700 font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                  <span>Dynamic Jurisdiction Routing</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                  Drop a pin on the interactive global map or enter any address (like <b>Sakri Road, Dhule</b> or any Indian city area). The platform automatically extracts your state and local municipal corporation for instant routing!
                </p>
              </div>

              <div className="hidden md:block pt-4 border-t border-slate-200">
                <p className="text-[10px] text-slate-400 font-mono">LOCATION SECURE PORTAL | MUNICIPAL-GRID-982</p>
              </div>
            </div>

            {/* Form Entry Column */}
            <form onSubmit={handleSubmit} className="md:w-7/12 p-6 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800">Incident Details Form</h4>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Issue Headline</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3.5 text-slate-400" size={15} />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Water main leakage flooding road lane"
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Description Input */}
              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Full Context Description</label>
                  <button
                    type="button"
                    onClick={handleAutoDraft}
                    disabled={isDrafting || (!title && !description)}
                    className="flex items-center gap-1.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-md font-semibold transition-colors disabled:opacity-50"
                  >
                    {isDrafting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {isDrafting ? "Drafting..." : "AI Auto-Draft"}
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise details... (e.g. dimensions, safety risks, landmarks like Sakri Road or local signs)"
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Dynamic Jurisdiction Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">State Jurisdiction</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g., Maharashtra"
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Municipal Authority (City)</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Dhule Municipal Corporation"
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Media Evidence Upload */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Media Evidence (Image/Video)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="evidence-upload"
                  />
                  <label 
                    htmlFor="evidence-upload" 
                    className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-xl py-3 px-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <Camera className="text-slate-400 mb-1" size={18} />
                    <span className="text-xs text-slate-600 font-medium">
                      {imageFileName ? imageFileName : "Click to upload image or video evidence"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Sector</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-3 text-slate-400" size={14} />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CivicIssue['category'])}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                    >
                      <option value="Roads/Potholes">Roads/Potholes</option>
                      <option value="Water/Drainage">Water/Drainage</option>
                      <option value="Solid Waste">Solid Waste</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Parks">Parks/Trees</option>
                    </select>
                  </div>
                </div>

                {/* Reporter Name */}
                <div className="space-y-1">
                  <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Reporter ID/Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={reportedBy}
                      onChange={(e) => setReportedBy(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Location Picker Map */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Pick Incident Location on Live Map</label>
                <LocationPicker
                  value={selectedLocation}
                  onChange={(val) => {
                    setSelectedLocation(val);
                    if (val) {
                      setLocation(val.address);
                    }
                  }}
                />
              </div>

              {/* Location Landmark */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">Specific Landmark / Address Details</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Lane 5, Koregaon Park near Post Office"
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Presets Visualizer preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="h-10 w-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                  <img
                    src={IMAGE_PRESETS[category]}
                    alt="Category visual placeholder"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 text-[11px] text-slate-600 leading-normal">
                  <span className="text-slate-700 font-semibold">Automatic telemetry capture:</span> Presetting high-contrast engineering visual sample representing <span className="text-blue-600 font-semibold">{category}</span>.
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isCheckingDuplicate}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-70"
                >
                  {isCheckingDuplicate ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Checking Duplicates...</span>
                    </>
                  ) : (
                    <>
                      <span>Dispatch CivicPulse Agent Orchestrator</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* Multi-Agent Orchestration Visual Console */
          <div className="w-full p-6 flex flex-col bg-slate-50 font-mono text-slate-700 text-xs leading-relaxed max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                <h4 className="text-xs font-bold text-slate-800 tracking-wider">CIVICPULSE AI — MULTI-AGENT ORCHESTRATION STREAM</h4>
              </div>
              <span className="text-[10px] text-slate-400">SESSIONID: S-{Math.floor(1000 + Math.random() * 9000)}</span>
            </div>

            {/* Staged Console Streams */}
            <div className="space-y-5 flex-1 select-text">
              {/* 1. Orchestrator Stream */}
              {orchestratorStep >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5 border-l-4 border-blue-600 pl-3.5"
                >
                  <p className="text-blue-700 font-bold flex items-center gap-1.5">
                    <span className="text-sm">🧠</span> ORCHESTRATOR
                  </p>
                  <p className="font-sans text-slate-600 leading-relaxed text-xs">
                    {submissionResult?.agentResponses?.orchestrator || `Acknowledging new civic incident report. Initiating multi-agent analysis loops on Category: ${category}. Dispatched Classifier, Geo-Router, Resolution, and Insights Agents.`}
                  </p>
                  {orchestratorStep === 1 && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] italic">
                      <Loader2 className="animate-spin text-blue-600" size={12} />
                      <span>Classifier analyzing image... ✓ Pothole, Severity: High</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 2. Classifier Stream */}
              {orchestratorStep >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5 border-l-4 border-teal-500 pl-3.5"
                >
                  <p className="text-teal-700 font-bold flex items-center gap-1.5">
                    <span className="text-sm">🔍</span> CLASSIFIER AGENT
                  </p>
                  <p className="font-sans text-slate-600 leading-relaxed text-xs whitespace-pre-wrap">
                    {submissionResult?.agentResponses?.classifier.replace('🔍 CLASSIFIER AGENT', '') || `[Classifying type | Severity: 7/10 | Routing to: Local Municipal Office | Priority: High]\nAnalyzed description keywords: determined sector is ${category}. Assessing infrastructure priority.`}
                  </p>
                  {orchestratorStep === 2 && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] italic">
                      <Loader2 className="animate-spin text-teal-500" size={12} />
                      <span>Geo-Router locating nearest ward... ✓ Ward 15, Pune</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 3. Geo-Router Stream */}
              {orchestratorStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5 border-l-4 border-indigo-500 pl-3.5"
                >
                  <p className="text-indigo-700 font-bold flex items-center gap-1.5">
                    <span className="text-sm">📍</span> GEO-ROUTER AGENT
                  </p>
                  <p className="font-sans text-slate-600 leading-relaxed text-xs whitespace-pre-wrap">
                    {submissionResult?.agentResponses?.geoRouter.replace('📍 GEO-ROUTER AGENT', '') || `[Duplicate check: Verified | Ward: Deccan-Ghole Road | Cluster status: New cluster KP-${getDeptCode()}-${Math.floor(100+Math.random()*900)} created]\nMapping reported GPS offsets inside local boundaries.`}
                  </p>
                  {orchestratorStep === 3 && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] italic">
                      <Loader2 className="animate-spin text-indigo-500" size={12} />
                      <span>Resolution Agent assigning department... ✓ PWD, SLA: 48hrs</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 4. Resolution Stream */}
              {orchestratorStep >= 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5 border-l-4 border-pink-500 pl-3.5"
                >
                  <p className="text-pink-700 font-bold flex items-center gap-1.5">
                    <span className="text-sm">📄</span> RESOLUTION AGENT
                  </p>
                  <p className="font-sans text-slate-600 leading-relaxed text-xs whitespace-pre-wrap">
                    {submissionResult?.agentResponses?.resolution.replace('📄 RESOLUTION AGENT', '') || `[Action: complaint drafted | Complaint ID: CP-${getDeptCode()}-${Math.floor(1000+Math.random()*9000)} | SLA: 3 days]\nGenerated formal Municipal Corporation PWD letter for immediate dispatch.`}
                  </p>
                  {orchestratorStep === 4 && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] italic">
                      <Loader2 className="animate-spin text-pink-500" size={12} />
                      <span>Insights Agent updating risk model... ✓ Done</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 5. Insights Stream */}
              {orchestratorStep >= 5 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1.5 border-l-4 border-amber-500 pl-3.5"
                >
                  <p className="text-amber-700 font-bold flex items-center gap-1.5">
                    <span className="text-sm">📊</span> INSIGHTS AGENT
                  </p>
                  <p className="font-sans text-slate-600 leading-relaxed text-xs whitespace-pre-wrap">
                    {submissionResult?.agentResponses?.insights.replace('📊 INSIGHTS AGENT', '') || `[Pattern analysis complete | Infrastructure warning: Area shows steady degradation baseline. Recommendation to PWD team: reinforce sector immediately.]`}
                  </p>
                  {orchestratorStep === 5 && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] italic">
                      <Loader2 className="animate-spin text-amber-500" size={12} />
                      <span>Assembling summary checklist and calculating point rewards...</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 6. Summary Block */}
              {orchestratorStep >= 6 && submissionResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 rounded-2xl bg-white border-2 border-emerald-100 flex flex-col md:flex-row justify-between items-center gap-4 mt-4 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                      <CheckCircle size={16} />
                      <span>✅ CITIZEN SUBMISSION ANALYZED & SECURED</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                      <div><strong className="text-slate-500 font-medium font-mono">Issue ID:</strong> {submissionResult.id}</div>
                      <div><strong className="text-slate-500 font-medium font-mono">SLA ETA:</strong> {submissionResult.points > 120 ? '1-2 days' : '2-3 days'}</div>
                      <div><strong className="text-slate-500 font-medium font-mono">Escalation:</strong> {submissionResult.severity >= 8 ? 'Escalated' : 'Active'}</div>
                      <div><strong className="text-slate-500 font-medium font-mono">Assigned Ward:</strong> {submissionResult.ward.split(' ')[0]}</div>
                    </div>
                    {submissionResult.suggestedResolution && (
                      <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-800">
                        <strong className="block font-semibold mb-0.5">Suggested Resolution:</strong>
                        {submissionResult.suggestedResolution}
                      </div>
                    )}
                  </div>

                  {/* Points Card */}
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center flex flex-col items-center justify-center min-w-[140px] shadow-sm">
                    <Zap size={22} className="text-emerald-500 fill-emerald-500/20 mb-1" />
                    <span className="text-xl font-black font-mono text-emerald-600 leading-none">+{submissionResult.points}</span>
                    <span className="text-[9px] font-mono tracking-wider uppercase text-emerald-700 font-semibold mt-1">Civic Points Awarded</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Completion Trigger */}
            {orchestratorStep >= 6 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 justify-end"
              >
                <button
                  type="button"
                  onClick={handleFinish}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 px-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>Sync to Live Civic Grid</span>
                  <ArrowRight size={14} />
                </button>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
