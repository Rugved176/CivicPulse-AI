import React, { useState, useEffect } from 'react';
import { CivicIssue } from '../types';
import {
  Lock, Unlock, User, ShieldAlert, Filter, Search, Building2, MapPin,
  ClipboardList, CheckCircle2, AlertTriangle, ChevronDown, Check, Activity,
  Briefcase, FileEdit, LogOut, Sliders, Calendar, ChevronRight, UserCheck, HelpCircle, AlertOctagon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPortalProps {
  issues: CivicIssue[];
  onRefresh: () => void;
}

interface AuthorityUser {
  email: string;
  name: string;
  designation: string;
  role: 'Admin' | 'WardOfficer' | 'DeptEngineer';
  wardRestriction: string; // "All" or specific ward name
  deptRestriction: string; // "All" or specific department name
  avatarText: string;
}

const PRESET_USERS: (AuthorityUser & { pin: string })[] = [
  {
    email: "commissioner@pmc.gov.in",
    name: "Dr. Rajendra Bhosale",
    designation: "PMC Municipal Commissioner",
    role: "Admin",
    wardRestriction: "All",
    deptRestriction: "All",
    avatarText: "RB",
    pin: "1111"
  },
  {
    email: "ward.shivajinagar@pmc.gov.in",
    name: "Shri. Sandeep Kadam",
    designation: "Shivajinagar Ward Officer",
    role: "WardOfficer",
    wardRestriction: "Shivajinagar-Ghole Road Ward",
    deptRestriction: "All",
    avatarText: "SK",
    pin: "2222"
  },
  {
    email: "ward.yerawada@pmc.gov.in",
    name: "Smt. Somnath Bankar",
    designation: "Yerawada Ward Officer",
    role: "WardOfficer",
    wardRestriction: "Yerawada-Kalas-Dhanori Ward",
    deptRestriction: "All",
    avatarText: "SB",
    pin: "3333"
  },
  {
    email: "ward.kothrud@pmc.gov.in",
    name: "Shri. Girish Daundkar",
    designation: "Kothrud-Bawdhan Ward Officer",
    role: "WardOfficer",
    wardRestriction: "Kothrud-Bawdhan Ward",
    deptRestriction: "All",
    avatarText: "GD",
    pin: "4444"
  },
  {
    email: "engineer.water@pmc.gov.in",
    name: "Shri. Nandkumar Jagtap",
    designation: "Chief Water Supply Engineer",
    role: "DeptEngineer",
    wardRestriction: "All",
    deptRestriction: "Water Supply & Sewerage Dept",
    avatarText: "NJ",
    pin: "5555"
  },
  {
    email: "engineer.waste@pmc.gov.in",
    name: "Smt. Asha Raut",
    designation: "Deputy Commissioner, Solid Waste",
    role: "DeptEngineer",
    wardRestriction: "All",
    deptRestriction: "Solid Waste Management Dept",
    avatarText: "AR",
    pin: "6666"
  }
];

const MUNICIPAL_WARDS = [
  "Ward-01 (North East Sector)",
  "Ward-02 (Central Sector)",
  "Ward-03 (East Sector)",
  "Ward-04 (West Sector)",
  "Ward-05 (North Sector)",
  "Ward-06 (South Sector)",
  "Ward-07 (South East Sector)",
  "General Ward"
];

const MUNICIPAL_DEPARTMENTS = [
  { name: "Roads & Traffic Dept", category: "Roads/Potholes" },
  { name: "Water Supply & Sewerage Dept", category: "Water/Drainage" },
  { name: "Solid Waste Management Dept", category: "Solid Waste" },
  { name: "Electrical Infrastructure Dept", category: "Electricity" },
  { name: "Horticulture Dept", category: "Parks" }
];

const CITY_TO_STATE_MAP: { [key: string]: string } = {
  "Pune Municipal Corporation": "Maharashtra",
  "Dhule Municipal Corporation (DMC / DUBL)": "Maharashtra",
  "Dhule Municipal Corporation": "Maharashtra",
  "Mumbai Municipal Corporation": "Maharashtra",
  "Bengaluru Municipal Corporation": "Karnataka",
  "Delhi Municipal Corporation": "Delhi",
  "Ahmedabad Municipal Corporation": "Gujarat",
  "Surat Municipal Corporation": "Gujarat"
};

export default function AdminPortal({ issues, onRefresh }: AdminPortalProps) {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthorityUser | null>(() => {
    try {
      const saved = localStorage.getItem('pmc_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [loginState, setLoginState] = useState('Maharashtra');
  const [loginCity, setLoginCity] = useState('Mumbai Municipal Corporation');
  const [customLoginCity, setCustomLoginCity] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Resolved' | 'Escalated'>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'Low' | 'Medium' | 'High' | 'Critical'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [wardFilter, setWardFilter] = useState<string>('All');
  const [stateFilter, setStateFilter] = useState<string>('Maharashtra');
  const [cityFilter, setCityFilter] = useState<string>('Mumbai Municipal Corporation');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Synchronize login state/city with selected top-level filters
  useEffect(() => {
    setLoginState(stateFilter);
    setLoginCity(cityFilter);
  }, [stateFilter, cityFilter]);

  // Synchronize state and city filters with logged in admin's jurisdiction
  useEffect(() => {
    if (currentUser) {
      if (currentUser.state) {
        setStateFilter(currentUser.state);
      }
      if (currentUser.city) {
        setCityFilter(currentUser.city);
      }
    }
  }, [currentUser]);

  const availableStates = Array.from(new Set([
    'Maharashtra',
    'Gujarat',
    'Delhi',
    'Karnataka',
    ...issues.map(i => i.state || 'Maharashtra')
  ]));

  const getCitiesForState = (state: string) => {
    const presetCities = Object.keys(CITY_TO_STATE_MAP).filter(city => CITY_TO_STATE_MAP[city] === state);
    const dynamicCities = issues
      .filter(i => (i.state || 'Maharashtra') === state)
      .map(i => i.city || 'Mumbai Municipal Corporation');
    return Array.from(new Set([...presetCities, ...dynamicCities]));
  };

  // Administrative Modification States
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'Active' | 'Resolved' | 'Escalated'>('Active');
  const [updatePriority, setUpdatePriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [updateWard, setUpdateWard] = useState('');
  const [updateDept, setUpdateDept] = useState('');
  const [adminNotesText, setAdminNotesText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Scope enforcement flag
  const [viewScopeOnly, setViewScopeOnly] = useState(true);

  // Synchronize local issue detail when issues list updates (e.g., via polling)
  useEffect(() => {
    if (selectedIssueId) {
      const live = issues.find(i => i.id === selectedIssueId);
      if (live) {
        setSelectedIssue(live);
      }
    }
  }, [issues, selectedIssueId]);

  // Set default values when an issue is selected
  const handleSelectIssue = (issue: CivicIssue) => {
    setSelectedIssueId(issue.id);
    setSelectedIssue(issue);
    setUpdateStatus(issue.status);
    setUpdatePriority(issue.priority);
    setUpdateWard(issue.ward);
    setUpdateDept(issue.department);
    setAdminNotesText(issue.adminNotes || '');
    setUpdateSuccess(false);
  };

  const handlePresetFill = (preset: typeof PRESET_USERS[0]) => {
    setLoginEmail(preset.email);
    setLoginPin(preset.pin);
    setLoginError('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    setTimeout(() => {
      const match = PRESET_USERS.find(
        u => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.pin === loginPin.trim()
      );

      if (match) {
        const { pin, ...userProfile } = match;
        const actualCity = (loginCity === 'Other' || loginCity === 'Other (Type custom)') ? customLoginCity : loginCity;
        const loggedInUser = {
          ...userProfile,
          state: loginState,
          city: actualCity || 'Mumbai Municipal Corporation'
        };
        setCurrentUser(loggedInUser);
        localStorage.setItem('civic_admin_user', JSON.stringify(loggedInUser));
        // Reset filters for the new user's jurisdiction
        setSearchQuery('');
        setStatusFilter('All');
        setPriorityFilter('All');
        setCategoryFilter('All');
        setWardFilter('All');
        setSelectedIssueId(null);
        setSelectedIssue(null);
      } else {
        setLoginError('Invalid municipal email address or Security PIN.');
      }
      setIsLoggingIn(false);
    }, 800);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pmc_admin_user');
    setSelectedIssueId(null);
    setSelectedIssue(null);
  };

  // Check if current user has modification permission on this issue (RBAC check)
  const hasWritePermission = (issue: CivicIssue): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;

    // Ward Officer check
    if (currentUser.role === 'WardOfficer') {
      return issue.ward === currentUser.wardRestriction;
    }

    // Department Engineer check
    if (currentUser.role === 'DeptEngineer') {
      return issue.department === currentUser.deptRestriction;
    }

    return false;
  };

  // Submit Admin Updates to Backend
  const handleAdminUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !currentUser) return;

    if (!hasWritePermission(selectedIssue)) {
      alert("RBAC Violation: You do not have permission to modify issues outside your jurisdiction.");
      return;
    }

    setIsUpdating(true);
    setUpdateSuccess(false);

    try {
      const res = await fetch(`/api/admin/update-issue/${selectedIssue.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: updateStatus,
          priority: updatePriority,
          ward: updateWard,
          department: updateDept,
          adminNotes: adminNotesText
        })
      });

      if (res.ok) {
        setUpdateSuccess(true);
        onRefresh(); // Refresh issues list in parent components
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
      } else {
        const errData = await res.json();
        alert(`Failed to update issue: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting administrative update.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter the issues list based on user's scope + active search filters
  const getFilteredIssues = () => {
    return issues.filter(issue => {
      // 1. Role-based Scope Filtering (if viewScopeOnly is checked, restrict strictly to jurisdiction)
      if (currentUser && viewScopeOnly) {
        if (currentUser.role === 'WardOfficer' && currentUser.wardRestriction !== 'All') {
          if (issue.ward !== currentUser.wardRestriction) return false;
        }
        if (currentUser.role === 'DeptEngineer' && currentUser.deptRestriction !== 'All') {
          if (issue.department !== currentUser.deptRestriction) return false;
        }
      }

      // 2. Location / Area text search (includes Ward, Landmark, Title, ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          issue.id.toLowerCase().includes(query) ||
          issue.title.toLowerCase().includes(query) ||
          issue.location.toLowerCase().includes(query) ||
          issue.ward.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'All' && issue.status !== statusFilter) return false;

      // 4. Priority filter
      if (priorityFilter !== 'All' && issue.priority !== priorityFilter) return false;

      // 5. Category filter
      if (categoryFilter !== 'All' && issue.category !== categoryFilter) return false;

      // 6. Ward filter
      if (wardFilter !== 'All' && issue.ward !== wardFilter) return false;

      // 7. State filter
      const issueState = issue.state || 'Maharashtra';
      if (stateFilter !== 'All' && issueState !== stateFilter) return false;

      // 8. City/Municipal Corporation filter
      const issueCity = issue.city || 'Pune Municipal Corporation';
      if (cityFilter !== 'All' && issueCity !== cityFilter) return false;

      return true;
    });
  };

  const filteredIssues = getFilteredIssues();

  // Color mappings
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Escalated': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Active': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div id="admin-portal-root" className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden min-h-[600px] flex flex-col shadow-sm">
      {/* Top-Level Mandatory Jurisdiction Selector */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Building2 size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Administrative Jurisdiction Focus
            </h4>
            <p className="text-[10px] text-slate-400">
              Select State and Municipal Corporation to isolate civic dashboard telemetry
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* State Selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold font-mono text-slate-500 uppercase">STATE:</span>
            <select
              value={stateFilter}
              onChange={(e) => {
                const newState = e.target.value;
                setStateFilter(newState);
                const cities = getCitiesForState(newState);
                if (cities.length > 0) {
                  setCityFilter(cities[0]);
                }
              }}
              className="bg-transparent text-white text-xs font-semibold outline-none border-none cursor-pointer focus:ring-0"
            >
              {availableStates.map(st => (
                <option key={st} value={st} className="bg-slate-900 text-white font-sans">{st}</option>
              ))}
            </select>
          </div>

          {/* City/Municipal Corporation Selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] font-bold font-mono text-slate-500 uppercase">JURISDICTION:</span>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold outline-none border-none cursor-pointer focus:ring-0 min-w-[200px]"
            >
              {getCitiesForState(stateFilter).map(ct => (
                <option key={ct} value={ct} className="bg-slate-900 text-white font-sans">
                  {ct.replace(' Municipal Corporation', '')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Login Screen (If not authenticated) */}
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <motion.div
            key="login-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex items-center justify-center p-6 bg-slate-100/50 min-h-[580px]"
          >
            {/* Centered Login Card */}
            <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200/80 shadow-md space-y-6">
              <div className="mb-6 text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl text-white font-display mx-auto mb-3 shadow-md shadow-blue-500/20">
                  M
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-display">Municipal Administrator Gate</h3>
                <p className="text-xs text-slate-500 mt-1">Please provide your official municipal email and security PIN.</p>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg mb-4 flex items-center gap-2 font-medium">
                  <AlertOctagon size={14} className="text-red-600 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="admin-email-input" className="block text-[10px] font-bold font-mono uppercase text-slate-600">
                    Municipal Email Address
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      id="admin-email-input"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. ward.shivajinagar@pmc.gov.in"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-pin-input" className="block text-[10px] font-bold font-mono uppercase text-slate-600">
                    4-Digit Security PIN
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      id="admin-pin-input"
                      type="password"
                      maxLength={4}
                      required
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      placeholder="••••"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold font-mono uppercase text-slate-600">
                      Login State
                    </label>
                    <select
                      value={loginState}
                      onChange={(e) => setLoginState(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer text-slate-700"
                    >
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Karnataka">Karnataka</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold font-mono uppercase text-slate-600">
                      Municipal Corporation
                    </label>
                    <select
                      value={loginCity}
                      onChange={(e) => setLoginCity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer text-slate-700"
                    >
                      <option value="Pune Municipal Corporation">Pune Municipal Corporation</option>
                      <option value="Dhule Municipal Corporation">Dhule Municipal Corporation (DMC / DUBL)</option>
                      <option value="Mumbai Municipal Corporation">Mumbai Municipal Corporation</option>
                      <option value="Bengaluru Municipal Corporation">Bengaluru Municipal Corporation</option>
                      <option value="Other">Other (Enter custom below)</option>
                    </select>
                  </div>
                </div>

                {loginCity === 'Other' && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold font-mono uppercase text-slate-600">
                      Specify Custom Municipal Corporation
                    </label>
                    <input
                      type="text"
                      required
                      value={customLoginCity}
                      onChange={(e) => setCustomLoginCity(e.target.value)}
                      placeholder="e.g. Nagpur Municipal Corporation"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>VALIDATING CREDENTIALS...</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={14} />
                      <span>SIGN IN TO ADMIN CONTROL</span>
                    </>
                  )}
                </button>
              </form>

              {/* Demo auto-fill help */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-3 text-[10px] font-bold font-mono uppercase text-slate-400">
                  <HelpCircle size={12} />
                  <span>DEMO ROLES (CLICK TO AUTO-FILL)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_USERS.map((user) => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => handlePresetFill(user)}
                      className="p-2 text-left bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-xl transition-all cursor-pointer group"
                    >
                      <div className="font-bold text-[10px] text-slate-700 group-hover:text-blue-800 leading-tight">
                        {user.name}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">
                        {user.designation}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Active Admin Portal View */
          <motion.div
            key="portal-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col h-full bg-slate-50"
          >
            {/* Top Operational Status Bar */}
            <div className="bg-slate-900 text-slate-100 px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs font-mono shadow-inner">
                  {currentUser.avatarText}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{currentUser.name}</span>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-mono font-bold rounded uppercase tracking-wider border border-blue-500/20">
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {currentUser.designation}
                  </p>
                </div>
              </div>

              {/* Role-Based Jurisdiction Summary Badge */}
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono font-bold uppercase">
                {currentUser.city && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <Building2 size={12} className="text-emerald-400" />
                    <span className="text-slate-400">JURISDICTION:</span>
                    <span className="text-emerald-400">
                      {currentUser.city.replace(' Municipal Corporation', '')} ({currentUser.state || 'MH'})
                    </span>
                  </div>
                )}

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                  <Building2 size={12} className="text-blue-400" />
                  <span className="text-slate-400">WARD LIMITS:</span>
                  <span className={currentUser.wardRestriction === 'All' ? "text-emerald-400" : "text-amber-400"}>
                    {currentUser.wardRestriction}
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                  <Briefcase size={12} className="text-blue-400" />
                  <span className="text-slate-400">DEPT LIMITS:</span>
                  <span className={currentUser.deptRestriction === 'All' ? "text-emerald-400" : "text-amber-400"}>
                    {currentUser.deptRestriction.split(' ')[0]}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <LogOut size={11} />
                  <span>LOGOUT</span>
                </button>
              </div>
            </div>

            {/* Sub-Filters / Search Toolbar */}
            <div className="bg-white border-b border-slate-200 p-4 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
              {/* Search Bar & Scope Checkbox */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, Title, Area, or Ward keyword..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {currentUser.role !== 'Admin' && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={viewScopeOnly}
                      onChange={(e) => setViewScopeOnly(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-slate-600 font-mono tracking-wide uppercase">
                      Strict Jurisdiction Only
                    </span>
                  </label>
                )}
              </div>

              {/* Filters dropdown row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">STATUS:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-[10px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Escalated">Escalated</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">PRIORITY:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-[10px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">CATEGORY:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-[10px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="Roads/Potholes">Roads</option>
                    <option value="Water/Drainage">Water & Drainage</option>
                    <option value="Solid Waste">Solid Waste</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Parks">Parks & Horticulture</option>
                  </select>
                </div>

                {/* Ward Filter (only if Admin or not strict) */}
                {(!viewScopeOnly || currentUser.role === 'Admin') && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">WARD:</span>
                    <select
                      value={wardFilter}
                      onChange={(e) => setWardFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-[10px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="All">All Wards</option>
                      {MUNICIPAL_WARDS.map(w => (
                        <option key={w} value={w}>{w.split(' ')[0]}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Portal Workspace Grid Layout */}
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-0 overflow-hidden">
              
              {/* Left Side: Incidents Table/List */}
              <div className="xl:col-span-7 border-r border-slate-200 bg-white flex flex-col overflow-y-auto max-h-[580px]">
                {filteredIssues.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredIssues.map((issue) => {
                      const isSelected = selectedIssueId === issue.id;
                      const hasWrite = hasWritePermission(issue);

                      return (
                        <div
                          key={issue.id}
                          onClick={() => handleSelectIssue(issue)}
                          className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all cursor-pointer border-l-4 ${
                            isSelected
                              ? 'bg-blue-50/45 border-l-blue-600'
                              : 'hover:bg-slate-50 border-l-transparent'
                          }`}
                        >
                          <div className="space-y-1.5 flex-1 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-mono font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {issue.id}
                              </span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${getPriorityColor(issue.priority)}`}>
                                {issue.priority}
                              </span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${getStatusColor(issue.status)}`}>
                                {issue.status}
                              </span>
                              {!hasWrite && (
                                <span className="text-[8px] font-mono bg-slate-100 text-slate-400 border border-slate-200 px-1 rounded flex items-center gap-0.5" title="You are restricted to read-only for this issue">
                                  <Lock size={8} />
                                  <span>READ-ONLY</span>
                                </span>
                              )}
                            </div>
                            
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{issue.title}</h4>
                            
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium">
                              <span className="flex items-center gap-1">
                                <MapPin size={11} className="text-slate-400" />
                                <span className="line-clamp-1 max-w-[150px]">{issue.location}</span>
                              </span>
                              <span>|</span>
                              <span className="text-slate-600">{issue.ward.split(' ')[0]}</span>
                              <span>|</span>
                              <span className="text-slate-400 font-mono text-[9px]">
                                {new Date(issue.reportedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-end gap-2 text-right">
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              SEVERITY: {issue.severity}/10
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                {issue.category}
                              </span>
                              <ChevronRight size={14} className="text-slate-300" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                    <ClipboardList size={32} className="text-slate-300 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-slate-700 text-xs">No active complaints logged</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                        No grievances found matching the selected filters or your active jurisdiction restrictions.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: Inspector and RBAC controls */}
              <div className="xl:col-span-5 bg-slate-50 p-6 flex flex-col overflow-y-auto max-h-[580px]">
                {selectedIssue ? (
                  <div className="space-y-6">
                    {/* Brief Header */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2.5">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          PMC GRIEVANCE LOG: {selectedIssue.id}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(selectedIssue.reportedAt).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <h3 className="text-xs font-extrabold text-slate-800 leading-snug">{selectedIssue.title}</h3>
                      
                      <p className="text-[11px] text-slate-600 leading-relaxed font-sans bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {selectedIssue.description}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
                        <div className="bg-slate-50/50 p-2 border border-slate-100 rounded">
                          <span className="text-slate-400 block uppercase">Reporter</span>
                          <strong className="text-slate-700 font-bold">{selectedIssue.reportedBy}</strong>
                        </div>
                        <div className="bg-slate-50/50 p-2 border border-slate-100 rounded">
                          <span className="text-slate-400 block uppercase">Reward Points</span>
                          <strong className="text-emerald-600 font-bold font-mono">+{selectedIssue.points} pts</strong>
                        </div>
                      </div>
                    </div>

                    {/* RBAC Rules Indicator for Selected Issue */}
                    {(() => {
                      const writable = hasWritePermission(selectedIssue);
                      return (
                        <div className={`p-3.5 border rounded-xl flex items-start gap-3 shadow-sm ${
                          writable
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                          <div className="flex-shrink-0 mt-0.5">
                            {writable ? (
                              <UserCheck size={16} className="text-emerald-600" />
                            ) : (
                              <Lock size={16} className="text-red-600 animate-pulse" />
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-bold font-mono uppercase tracking-wider">
                              {writable ? 'Write Authorization Granted' : 'Administrative Lock Active'}
                            </h4>
                            <p className="text-[10px] leading-relaxed opacity-90 font-sans">
                              {writable ? (
                                `Your active role permits modifying coordinates, updating status, adjusting urgency, and assigning departments for this complaint.`
                              ) : (
                                `This complaint falls outside your active ward/department restriction (${
                                  currentUser.role === 'WardOfficer' ? currentUser.wardRestriction : currentUser.deptRestriction
                                }). Modification actions are locked.`
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Admin Actions Form */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
                        <Sliders size={14} className="text-slate-700" />
                        <h4 className="text-xs font-bold text-slate-700 font-display uppercase tracking-wide">
                          Executive Actions Panel
                        </h4>
                      </div>

                      {updateSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] rounded-lg flex items-center gap-2 font-medium animate-pulse">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>PMC Operations Database Updated Successfully!</span>
                        </div>
                      )}

                      <form onSubmit={handleAdminUpdate} className="space-y-4">
                        {/* Status Toggle & Priority Select */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold font-mono uppercase text-slate-500">
                              Resolution Status
                            </label>
                            <select
                              disabled={!hasWritePermission(selectedIssue) || isUpdating}
                              value={updateStatus}
                              onChange={(e) => setUpdateStatus(e.target.value as any)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="Active">Active / On-Going</option>
                              <option value="Escalated">Escalated to Head</option>
                              <option value="Resolved">Resolved & Closed</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold font-mono uppercase text-slate-500">
                              Urgency / Priority
                            </label>
                            <select
                              disabled={!hasWritePermission(selectedIssue) || isUpdating}
                              value={updatePriority}
                              onChange={(e) => setUpdatePriority(e.target.value as any)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                            >
                              <option value="Low">Low Priority</option>
                              <option value="Medium">Medium Priority</option>
                              <option value="High">High Priority</option>
                              <option value="Critical">Critical Priority</option>
                            </select>
                          </div>
                        </div>

                        {/* Ward Reassignment & Dept Reassignment */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold font-mono uppercase text-slate-500">
                              Reassign Ward Sector
                            </label>
                            <select
                              disabled={currentUser.role !== 'Admin' || isUpdating}
                              value={updateWard}
                              onChange={(e) => setUpdateWard(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer text-ellipsis overflow-hidden"
                            >
                              {MUNICIPAL_WARDS.map(w => (
                                <option key={w} value={w}>{w}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[9px] font-bold font-mono uppercase text-slate-500">
                              Department Assignment
                            </label>
                            <select
                              disabled={currentUser.role !== 'Admin' || isUpdating}
                              value={updateDept}
                              onChange={(e) => setUpdateDept(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 cursor-pointer text-ellipsis overflow-hidden"
                            >
                              {MUNICIPAL_DEPARTMENTS.map(d => (
                                <option key={d.name} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Official Administrative Notes */}
                        <div className="space-y-1">
                          <label className="block text-[9px] font-bold font-mono uppercase text-slate-500 flex justify-between items-center">
                            <span>Official Administrative Action Notes</span>
                            <span className="text-[8px] opacity-75 lowercase">visible to citizens</span>
                          </label>
                          <textarea
                            disabled={!hasWritePermission(selectedIssue) || isUpdating}
                            rows={3}
                            value={adminNotesText}
                            onChange={(e) => setAdminNotesText(e.target.value)}
                            placeholder="Provide official resolution dispatch logs, contractor assignments, or site verification reports here..."
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans disabled:opacity-50"
                          />
                        </div>

                        {/* Submit button */}
                        <button
                          type="submit"
                          disabled={!hasWritePermission(selectedIssue) || isUpdating}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                            hasWritePermission(selectedIssue)
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isUpdating ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>COMMITTING TRANSACTIONS...</span>
                            </>
                          ) : (
                            <>
                              <Check size={14} />
                              <span>SAVE AND COMMIT ACTION</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* AI multi-agent orchestration summary for insights */}
                    {selectedIssue.agentResponses && (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-inner text-slate-100 space-y-3">
                        <div className="flex items-center gap-1.5 text-blue-400">
                          <Activity size={13} className="animate-pulse" />
                          <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider">AI Grid Diagnostics</h5>
                        </div>
                        <div className="text-[10px] font-mono text-slate-300 space-y-2">
                          <div>
                            <span className="text-slate-500 block">Classifier Categorization Checklist:</span>
                            <span className="text-slate-200">{selectedIssue.agentResponses.classifier}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Geo-Router Cluster Diagnostics:</span>
                            <span className="text-slate-200">{selectedIssue.agentResponses.geoRouter}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                    <Sliders size={32} className="text-slate-300" />
                    <div>
                      <h4 className="font-bold text-slate-600 text-xs">No complaint selected</h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Select any registered complaint from the list on the left to inspect telemetry, view agent clusters, and log action dispatches.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
