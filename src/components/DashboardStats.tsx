import React from 'react';
import { PlatformStats } from '../types';
import { ShieldAlert, Users, TrendingUp, Calendar, AlertTriangle, Hammer, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardStatsProps {
  stats: PlatformStats;
  onRefresh?: () => void;
}

export default function DashboardStats({ stats, onRefresh }: DashboardStatsProps) {
  const [deployingId, setDeployingId] = React.useState<string | null>(null);
  const [successId, setSuccessId] = React.useState<string | null>(null);

  const handleDeploy = async (id: string) => {
    setDeployingId(id);
    try {
      const res = await fetch(`/api/stats/deploy-preventive/${id}`, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessId(id);
        setTimeout(() => {
          setSuccessId(null);
          onRefresh?.();
        }, 1200);
      } else {
        alert("Failed to deploy preventive team. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deploying preventive corrective action.");
    } finally {
      setDeployingId(null);
    }
  };

  // Compute circular progress properties for resolution rate
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.resolutionRate / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Upper Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reports */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={100} className="text-slate-300" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Monthly Reports</p>
            <h3 className="text-3xl font-bold text-slate-800 font-display tracking-tight">{stats.totalIssuesThisMonth}</h3>
            <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <TrendingUp size={12} />
              <span>+18.4% from last month</span>
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
            <TrendingUp size={20} />
          </div>
        </div>

        {/* Resolution Rate Circular Progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center relative overflow-hidden group shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Resolution Rate</p>
            <h3 className="text-3xl font-bold text-blue-600 font-display tracking-tight">{stats.resolutionRate}%</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span>{stats.resolvedIssues} of {stats.totalIssuesThisMonth} resolved</span>
            </p>
          </div>
          <div className="relative flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-slate-100 fill-none"
                strokeWidth="5"
              />
              <motion.circle
                cx="32"
                cy="32"
                r={radius}
                className="stroke-blue-600 fill-none"
                strokeWidth="5"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[11px] font-mono font-semibold text-blue-600">{stats.resolutionRate}%</span>
          </div>
        </div>

        {/* Average SLA Days */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center relative overflow-hidden group shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Avg Resolution SLA</p>
            <h3 className="text-3xl font-bold text-slate-800 font-display tracking-tight">{stats.avgResolutionDays} <span className="text-sm font-normal text-slate-400">days</span></h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar size={12} className="text-sky-500" />
              <span>National SLA baseline</span>
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 border border-sky-100">
            <Calendar size={20} />
          </div>
        </div>

        {/* Active Citizens */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center relative overflow-hidden group shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Active Citizens</p>
            <h3 className="text-3xl font-bold text-slate-800 font-display tracking-tight">{stats.activeCitizens.toLocaleString()}</h3>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live community reports</span>
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Middle Row: Department Load and Issue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Workloads */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Hammer size={18} className="text-blue-600" />
            <h4 className="font-semibold text-slate-800 font-display">Government Department Loads</h4>
          </div>
          <div className="space-y-4">
            {stats.departmentLoad.map((dept) => {
              const isOverloaded = dept.load >= 80;
              return (
                <div key={dept.department} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">{dept.department}</span>
                    <span className={isOverloaded ? 'text-red-600 font-bold' : 'text-slate-500'}>
                      {dept.load}% {isOverloaded ? '(OVERLOADED)' : ''}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        isOverloaded
                          ? 'bg-red-500'
                          : dept.load >= 60
                          ? 'bg-orange-500'
                          : 'bg-blue-500'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${dept.load}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Issue Categorization Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-3">
              <TrendingUp size={18} className="text-blue-500" />
              <h4 className="font-semibold text-slate-800 font-display">Sector Incident Distribution</h4>
            </div>
            <p className="text-xs text-slate-500 mb-4">Total civic issues classified by category during this month</p>
          </div>

          <div className="space-y-3.5">
            {Object.entries(stats.issueBreakdown).map(([category, count]) => {
              const total = Object.values(stats.issueBreakdown).reduce((a, b) => a + b, 0);
              const pct = Math.round((count / total) * 100);
              return (
                <div key={category} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-medium text-slate-700 truncate">{category}</div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-md overflow-hidden relative">
                    <div
                      className="h-full bg-blue-100 rounded-md transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                      <span className="text-[10px] font-mono text-slate-600 font-semibold">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-8 text-right text-xs font-mono font-bold text-slate-800">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
