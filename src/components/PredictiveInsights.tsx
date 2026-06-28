import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';

export default function PredictiveInsights() {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/predictive-insights')
      .then(res => res.json())
      .then(data => {
        setInsights(data.insights || []);
        setLoading(false);
      })
      .catch(() => {
        setInsights(["Unable to load insights."]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col gap-3">
      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
        <TrendingUp size={18} className="text-indigo-500" />
        <h4 className="font-semibold font-display">Predictive AI Insights</h4>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="text-xs text-slate-500">Analyzing data...</div>
        ) : (
          insights.map((insight, i) => (
            <div key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              {typeof insight === 'string' ? insight : `${insight.location} ${insight.type} issue: ${insight.indicator}. ${insight.preventiveAction}.`}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
