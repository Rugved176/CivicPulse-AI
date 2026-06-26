import React, { useState, useEffect, useRef } from 'react';
import { initAuth, googleSignIn, logout as firebaseLogout } from './lib/firebase';
import { CivicIssue, PlatformStats, NotificationToast } from './types';
import DashboardStats from './components/DashboardStats';
import CivicMapView from './components/CivicMapView';
import ReportsExplorer from './components/ReportsExplorer';
import CitizenLeaderboard from './components/CitizenLeaderboard';
import ReportIssueForm from './components/ReportIssueForm';
import NotificationToasts from './components/NotificationToasts';
import AdminPortal from './components/AdminPortal';
import {
  Cpu, LayoutDashboard, Database, ShieldAlert,
  PlusCircle, RefreshCw, AlertCircle, Info, Landmark, HelpCircle, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'admin'>('dashboard');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Simulated FAQ State
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isAuthSetupOpen, setIsAuthSetupOpen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Google OAuth State
  const [userProfile, setUserProfile] = useState<{
    email: string;
    name: string;
    picture?: string;
    gamification?: any;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        const profile = {
          email: user.email || '',
          name: user.displayName || 'Citizen',
          picture: user.photoURL || undefined
        };
        setUserProfile(profile);
        setAuthLoading(false);
      },
      () => {
        setUserProfile(null);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Trigger Google Login Popup
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        const profile = {
          email: result.user.email || '',
          name: result.user.displayName || 'Citizen',
          picture: result.user.photoURL || undefined
        };
        setUserProfile(profile);
        
        // Welcome notification
        const welcomeToast: NotificationToast = {
          id: Math.random().toString(36).substring(2, 9),
          issueId: 'google-auth',
          title: `Signed in as ${profile.name}`,
          type: 'resolved',
          timestamp: new Date().toISOString()
        };
        setToasts(prev => [welcomeToast, ...prev]);
        setIsAuthSetupOpen(false);
      }
    } catch (error) {
      console.error("Error signing in", error);
      alert("Failed to sign in. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await firebaseLogout();
    setUserProfile(null);
  };

  // In-app Notification & Follow system states
  const [followedIssueIds, setFollowedIssueIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('followed_civic_issues');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const prevIssuesRef = useRef<CivicIssue[]>([]);

  // Toggle Following state
  const handleToggleFollow = (id: string) => {
    setFollowedIssueIds(prev => {
      const isFav = prev.includes(id);
      const updated = isFav ? prev.filter(item => item !== id) : [...prev, id];
      localStorage.setItem('followed_civic_issues', JSON.stringify(updated));
      return updated;
    });
  };

  // Helper to add toast alert
  const addToast = (issueId: string, title: string, type: 'resolved' | 'escalated' | 'updated') => {
    const newToast: NotificationToast = {
      id: Math.random().toString(36).substring(2, 9),
      issueId,
      title,
      type,
      timestamp: new Date().toISOString()
    };
    setToasts(prev => [newToast, ...prev]);

    // Automatically remove after 6.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 6500);
  };

  // Handle clicking on a notification toast
  const handleSelectToast = (issueId: string) => {
    setSelectedIssueId(issueId);
    setActiveTab('explorer');
    // Clear toast immediately upon click action
    setToasts(prev => prev.filter(t => t.issueId !== issueId));
  };

  // Fetch Stats and Issues from the server
  const fetchData = async () => {
    setErrorMsg('');
    setIsRefreshing(true);
    try {
      const [statsRes, issuesRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/reports')
      ]);

      if (!statsRes.ok || !issuesRes.ok) {
        throw new Error("Failed to communicate with the CivicPulse API backend.");
      }

      const statsContentType = statsRes.headers.get("content-type");
      if (statsContentType && !statsContentType.includes("application/json")) {
        throw new Error("Server is starting or returned invalid data. Please try again in a few seconds.");
      }

      const statsData: PlatformStats = await statsRes.json();
      const issuesData: CivicIssue[] = await issuesRes.json();

      setStats(statsData);
      setIssues(issuesData);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Could not retrieve live civic grid data.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load and periodic polling for real-time simulated server updates
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 7000); // Polling every 7 seconds
    return () => clearInterval(interval);
  }, []);

  // Monitor updates to followed issues
  useEffect(() => {
    if (prevIssuesRef.current.length > 0 && issues.length > 0) {
      followedIssueIds.forEach(id => {
        const oldIssue = prevIssuesRef.current.find(i => i.id === id);
        const newIssue = issues.find(i => i.id === id);

        if (oldIssue && newIssue) {
          if (oldIssue.status !== newIssue.status) {
            const toastType = newIssue.status === 'Resolved' ? 'resolved' : newIssue.status === 'Escalated' ? 'escalated' : 'updated';
            addToast(newIssue.id, newIssue.title, toastType);
          }
        }
      });
    }
    prevIssuesRef.current = issues;
  }, [issues, followedIssueIds]);

  const handleIssueReported = (newIssue: CivicIssue) => {
    // Automatically follow newly reported issues
    setFollowedIssueIds(prev => {
      const updated = [...prev, newIssue.id];
      localStorage.setItem('followed_civic_issues', JSON.stringify(updated));
      return updated;
    });

    // Add new issue locally and refresh server stats to ensure perfect full-stack sync
    setIssues(prev => [newIssue, ...prev]);
    setSelectedIssueId(newIssue.id);
    setActiveTab('explorer');
    fetchData(); // Sync official stats count
  };

  const handleResolveIssue = async (id: string) => {
    try {
      const response = await fetch(`/api/resolve/${id}`, {
        method: 'POST'
      });
      if (response.ok) {
        // Refresh grid which triggers the toast alert if followed
        fetchData();
      }
    } catch (err) {
      console.error("Resolution sync failed", err);
    }
  };

  const handleVerifyIssue = async (id: string) => {
    try {
      const userIdentifier = userProfile ? userProfile.email : 'anonymous_citizen';
      const response = await fetch(`/api/verify/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user: userIdentifier })
      });
      if (response.ok) {
        fetchData();
        fetchCitizenProfile();
      }
    } catch (err) {
      console.error("Verification sync failed", err);
    }
  };

  const fetchCitizenProfile = async () => {
    if (!userProfile) return;
    try {
      const res = await fetch(`/api/citizen-profile?email=${encodeURIComponent(userProfile.email)}&name=${encodeURIComponent(userProfile.name)}`);
      if (res.ok) {
        const data = await res.json();
        // Just store the points/badges in a ref or state if needed, or update userProfile.
        setUserProfile(prev => prev ? { ...prev, gamification: data } : prev);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchCitizenProfile();
    }
  }, [userProfile, issues.length]);

  const handleSelectFromMap = (id: string) => {
    setSelectedIssueId(id);
    setActiveTab('explorer');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Header / Nav */}
      <header className="border-b border-slate-200 bg-white text-slate-900 sticky top-0 z-40 px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg text-white font-display shadow-sm animate-pulse-slow">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 font-display">
                CivicPulse <span className="text-blue-600">AI</span>
              </h1>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Multi-Agent Community Civic Issue Platform</p>
          </div>
        </div>

        {/* Live Agent Operational Indicators from Theme */}
        <div className="hidden lg:flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-l border-slate-200 pl-4">
          <span className="text-emerald-600">● Classifier</span>
          <span className="text-emerald-600">● Geo-Router</span>
          <span className="text-emerald-600">● Resolution</span>
          <span className="text-emerald-600">● Insights</span>
        </div>

        {/* Global Controls & CTA */}
        <div className="flex items-center gap-2.5">
          {/* Google OAuth Login Section */}
          <div className="flex items-center gap-2">
            {userProfile ? (
              <div className="flex items-center gap-2 border border-slate-100 bg-slate-50/70 p-1 pr-3 rounded-full shadow-sm transition-all hover:bg-slate-100">
                {userProfile.picture ? (
                  <img
                    src={userProfile.picture}
                    alt={userProfile.name}
                    className="w-6 h-6 rounded-full border border-white"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] flex items-center justify-center border border-white">
                    {userProfile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-bold text-slate-700 leading-none flex items-center gap-1">
                    {userProfile.name}
                    {userProfile.gamification && (
                      <span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded-sm text-[8px] font-mono leading-none">
                        ⭐ {userProfile.gamification.points}
                      </span>
                    )}
                  </span>
                  <span className="text-[8px] text-slate-400 font-mono leading-none">{userProfile.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="ml-1 text-[8px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 px-1 py-0.5 rounded transition-colors cursor-pointer"
                  title="Disconnect Google Account"
                >
                  LOGOUT
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthSetupOpen(true)}
                disabled={authLoading}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] py-1.5 px-3 rounded-lg flex items-center gap-2 shadow-sm cursor-pointer transition-all disabled:opacity-50"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>{authLoading ? 'Connecting...' : 'Connect Google'}</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsFaqOpen(true)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer shadow-sm"
            title="View Platform FAQ"
          >
            <HelpCircle size={14} />
          </button>

          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono shadow-sm"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
            <span>{isRefreshing ? 'SYNCING' : 'REFRESH'}</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-600/10 cursor-pointer transition-all hover:scale-[1.01]"
          >
            <PlusCircle size={14} />
            <span>Report Incident</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* Error Warning */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center gap-3 shadow-sm">
            <AlertCircle size={18} className="flex-shrink-0 text-red-600 animate-bounce" />
            <div className="flex-1">
              <strong className="font-semibold text-red-800 block mb-0.5">API Server Communication Alert</strong>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Tab Selection Row */}
        <div className="flex justify-between items-center border-b border-slate-200 pb-px">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase font-mono border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard size={14} />
              <span>Civic Command Center</span>
            </button>

            <button
              onClick={() => setActiveTab('explorer')}
              className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase font-mono border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'explorer'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Database size={14} />
              <span>Active Grievances ({issues.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`pb-3 px-4 text-xs font-bold tracking-wider uppercase font-mono border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Landmark size={14} />
              <span>Municipal Admin Portal</span>
            </button>
          </div>
        </div>

        {/* Tab View Render */}
        {stats ? (
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              /* Dashboard tab */
              <motion.div
                key="dashboard-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-6"
              >
                {/* Stats cards */}
                <DashboardStats stats={stats} onRefresh={fetchData} />

                {/* Map & Leaderboard Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[400px]">
                  {/* SVG Map */}
                  <div className="lg:col-span-8">
                    <CivicMapView
                      issues={issues}
                      selectedIssueId={selectedIssueId}
                      onSelectIssue={handleSelectFromMap}
                    />
                  </div>

                  {/* Leaderboard panel */}
                  <div className="lg:col-span-4">
                    <CitizenLeaderboard issues={issues} />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'explorer' && (
              /* Grievances list explorer tab */
              <motion.div
                key="explorer-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="h-full"
              >
                <ReportsExplorer
                  issues={issues}
                  selectedIssueId={selectedIssueId}
                  onSelectIssue={setSelectedIssueId}
                  onResolveIssue={handleResolveIssue}
                  onVerifyIssue={handleVerifyIssue}
                  followedIssueIds={followedIssueIds}
                  onToggleFollow={handleToggleFollow}
                />
              </motion.div>
            )}

            {activeTab === 'admin' && (
              /* PMC Administrative Portal tab */
              <motion.div
                key="admin-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="h-full"
              >
                <AdminPortal
                  issues={issues}
                  onRefresh={fetchData}
                />
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="py-20 text-center text-slate-600 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-xs font-mono tracking-wide uppercase">Establishing municipal civic grid connection...</p>
          </div>
        )}
      </main>

      {/* Floating Info Note */}
      <footer className="border-t border-slate-200 bg-white p-4 text-center text-[10px] text-slate-400 font-mono">
        <p>© 2026 CivicPulse AI — Serving Connected Municipal Corporations, Maharashtra, India. All agents active.</p>
      </footer>

      {/* Report Civic Issue Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl"
            >
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="absolute right-4 top-4 text-slate-500 hover:text-slate-800 z-50 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              <ReportIssueForm
                onIssueReported={handleIssueReported}
                onClose={() => setIsReportModalOpen(false)}
                defaultReporterName={userProfile?.name || ''}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FAQ / Info Modal */}
      <AnimatePresence>
        {isFaqOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative space-y-4 text-slate-800"
            >
              <button
                type="button"
                onClick={() => setIsFaqOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <Landmark className="text-blue-600" size={18} />
                <h4 className="font-semibold text-slate-900 font-display">CivicPulse AI Architecture FAQs</h4>
              </div>
              <div className="space-y-4 text-xs overflow-y-auto max-h-[60vh] pr-1">
                <div>
                  <h5 className="font-bold text-slate-800">Q1: Who are the 4 autonomous sub-agents?</h5>
                  <p className="text-slate-600 mt-1">
                    <strong>1. CLASSIFIER AGENT:</strong> Performs NLP parsing of the description to evaluate severity, classify type, determine priority, and route directly to the designated department.
                    <br /><strong>2. GEO-ROUTER AGENT:</strong> Performs coordinate clustering to avoid duplicates. It groups close-by reports into unified spatial buckets, assigning local municipal wards.
                    <br /><strong>3. RESOLUTION AGENT:</strong> Instantiates formal grievance drafts addressed to specific Municipal Corporation Commissioners with active SLAs.
                    <br /><strong>4. INSIGHTS AGENT:</strong> Cross-references infrastructure pressure curves and structural deterioration ratios to generate localized prediction warnings.
                  </p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Q2: What government departments are routed to?</h5>
                  <p className="text-slate-600 mt-1">
                    • Roads/Potholes → <strong>Public Works Department (PWD)</strong>
                    <br />• Water/Drainage → <strong>Municipal Water Works Department</strong>
                    <br />• Electricity → <strong>State Electricity Distribution</strong>
                    <br />• Solid Waste → <strong>Solid Waste Management Dept</strong>
                    <br />• Parks/Trees → <strong>Horticulture Department</strong>
                  </p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Q3: How do Citizen Reward Points work?</h5>
                  <p className="text-slate-600 mt-1">
                    By filing detailed reports with precise descriptions and attaching photos, citizens earn civic points (50-200 pts) matching issue severity. These points translate directly into public transit discounts on local transit networks.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-right">
                <button
                  type="button"
                  onClick={() => setIsFaqOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-4 rounded-xl cursor-pointer"
                >
                  Close FAQ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Google OAuth & Connection Troubleshooting Portal */}
      <AnimatePresence>
        {isAuthSetupOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-xl shadow-2xl relative space-y-4 text-slate-800"
            >
              <button
                type="button"
                onClick={() => setIsAuthSetupOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <h4 className="font-semibold text-slate-900 font-display">Google OAuth Connection Portal</h4>
              </div>

              <div className="space-y-4 text-xs">
                {/* Warning Card */}
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle size={14} className="text-amber-600" />
                    <span>Resolving Error 400: redirect_uri_mismatch</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Google strictly validates the redirect URL of the authentication popup. Since your app runs on a dynamic preview URL, you must authorize this specific URL inside your Google Cloud Console.
                  </p>
                </div>

                {/* Redirect URIs to Whitelist */}
                <div className="space-y-2">
                  <p className="font-bold text-slate-700">Add these Authorized Redirect URIs in GCP Console:</p>
                  
                  <div className="space-y-1.5">
                    {[
                      `${window.location.origin}/auth/callback`,
                      'https://ais-pre-esdv6wzsleplfnalmapgvy-974090484839.asia-east1.run.app/auth/callback',
                      'http://localhost:3000/auth/callback'
                    ].map((uri) => (
                      <div key={uri} className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] text-slate-600">
                        <span className="truncate">{uri}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(uri);
                            setCopiedText(uri);
                            setTimeout(() => setCopiedText(null), 2000);
                          }}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded cursor-pointer transition-colors flex-shrink-0"
                        >
                          {copiedText === uri ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-slate-600 leading-relaxed">
                  <p className="font-bold text-slate-700 mb-1">How to fix in 3 steps:</p>
                  <p>1. Open the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center gap-0.5">Google Cloud Credentials Console</a>.</p>
                  <p>2. Edit your OAuth 2.0 Client ID (<code>47639126...</code>).</p>
                  <p>3. Paste the dynamic callback URL into <strong>Authorized redirect URIs</strong> and click <strong>Save</strong>.</p>
                </div>
              </div>

              {/* Action options */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                {/* Guest Login */}
                <button
                  type="button"
                  onClick={() => {
                    const profile = {
                      email: 'jury@example.com',
                      name: 'Hackathon Jury',
                      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
                    };
                    setUserProfile(profile);
                    localStorage.setItem('google_user_profile', JSON.stringify(profile));
                    
                    const welcomeToast: NotificationToast = {
                      id: Math.random().toString(36).substring(2, 9),
                      issueId: 'google-auth-simulated',
                      title: `Signed in as Hackathon Jury`,
                      type: 'resolved',
                      timestamp: new Date().toISOString()
                    };
                    setToasts(prev => [welcomeToast, ...prev]);
                    setIsAuthSetupOpen(false);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold py-2 px-4 rounded-xl cursor-pointer transition-all"
                  title="Login as a guest evaluator to bypass Google Cloud OAuth propagation issues"
                >
                  🚀 Guest Login (Jury Evaluation)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthSetupOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAuthSetupOpen(false);
                      handleGoogleLogin();
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <span>Launch Google Auth</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Toast Alerts Stack */}
      <NotificationToasts
        toasts={toasts}
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
        onSelectToast={handleSelectToast}
      />

    </div>
  );
}

// Add CSS-like Loader2 icon fallback
function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 16}
      height={size || 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
