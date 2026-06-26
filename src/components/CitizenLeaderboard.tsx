import React from 'react';
import { Award, Zap } from 'lucide-react';
import { CivicIssue } from '../types';

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  reports: number;
  city: string;
  avatar: string;
}

interface CitizenLeaderboardProps {
  issues?: CivicIssue[];
}

export default function CitizenLeaderboard({ issues = [] }: CitizenLeaderboardProps) {
  // Aggregate real citizens dynamically from reported issues
  const citizenMap: { [key: string]: { points: number; reports: number; city: string; avatar: string } } = {};

  issues.forEach(issue => {
    const name = issue.reportedBy || 'Anonymous';
    const city = issue.city || 'Municipal Corporation';
    const shortCity = city.replace(' Municipal Corporation', '');
    const points = issue.points || 50;

    if (!citizenMap[name]) {
      citizenMap[name] = {
        points: 0,
        reports: 0,
        city: shortCity,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
      };
    }
    citizenMap[name].points += points;
    citizenMap[name].reports += 1;
  });

  // Convert map to sorted list
  const topCitizens: LeaderboardEntry[] = Object.entries(citizenMap)
    .map(([name, data]) => ({
      name,
      points: data.points,
      reports: data.reports,
      city: data.city,
      avatar: data.avatar
    }))
    .sort((a, b) => b.points - a.points)
    .map((citizen, index) => ({
      rank: index + 1,
      ...citizen
    }));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-full justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-3">
          <Award size={18} className="text-amber-500" />
          <h4 className="font-semibold text-slate-800 font-display">Citizen Reward Board</h4>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Earn civic reward points by filing detailed, accurate incident reports and verifying local resolution.
        </p>

        {/* Leaderboard list */}
        <div className="space-y-3.5">
          {topCitizens.length > 0 ? (
            topCitizens.map((citizen) => {
              let rankColor = "text-slate-500";
              let rankBg = "bg-slate-50 border-slate-200";
              if (citizen.rank === 1) {
                rankColor = "text-amber-700";
                rankBg = "bg-amber-100 border-amber-300";
              } else if (citizen.rank === 2) {
                rankColor = "text-slate-700";
                rankBg = "bg-slate-100 border-slate-300";
              } else if (citizen.rank === 3) {
                rankColor = "text-amber-800";
                rankBg = "bg-amber-50 border-amber-200";
              }

              return (
                <div key={citizen.name} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-6 w-6 rounded-full border flex items-center justify-center font-mono text-[11px] font-bold ${rankBg} ${rankColor}`}>
                      {citizen.rank}
                    </div>
                    <img
                      src={citizen.avatar}
                      alt={citizen.name}
                      className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200"
                    />
                    <div>
                      <h5 className="text-xs font-semibold text-slate-800">
                        {citizen.name} <span className="text-[10px] font-medium text-slate-400">({citizen.city})</span>
                      </h5>
                      <p className="text-[10px] text-slate-500">{citizen.reports} reports verified</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap size={11} className="text-amber-600 fill-amber-500/20" />
                    <span className="text-xs font-bold font-mono text-amber-600">{citizen.points} pts</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-slate-400 text-xs">
              No civic reports registered yet. Be the first to file a report and rank up!
            </div>
          )}
        </div>
      </div>

      {/* Reward description footer */}
      <div className="mt-5 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-500 bg-slate-50 rounded-lg p-3">
        <p className="font-semibold text-slate-700 flex items-center justify-center gap-1 mb-1">
          <Zap size={12} className="text-amber-500" /> Redeeming points for municipal bus passes or parking waivers
        </p>
        Points automatically unlock public transport credits on local metro and bus networks.
      </div>
    </div>
  );
}
