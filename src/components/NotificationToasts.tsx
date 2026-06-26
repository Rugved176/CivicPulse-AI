import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle, ShieldAlert, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { NotificationToast } from '../types';

interface NotificationToastsProps {
  toasts: NotificationToast[];
  onDismiss: (id: string) => void;
  onSelectToast: (issueId: string) => void;
}

export default function NotificationToasts({ toasts, onDismiss, onSelectToast }: NotificationToastsProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full sm:w-[380px] pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let icon = <Bell className="text-blue-600" size={18} />;
          let bgClass = "bg-white border-blue-100 shadow-blue-100/20";
          let badgeText = "UPDATE";
          let badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
          let lineClass = "bg-blue-500";

          if (toast.type === 'resolved') {
            icon = <CheckCircle className="text-emerald-600" size={18} />;
            bgClass = "bg-white border-emerald-100 shadow-emerald-100/20";
            badgeText = "RESOLVED";
            badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
            lineClass = "bg-emerald-500";
          } else if (toast.type === 'escalated') {
            icon = <ShieldAlert className="text-red-600 animate-pulse" size={18} />;
            bgClass = "bg-white border-red-100 shadow-red-100/20";
            badgeText = "ESCALATED";
            badgeClass = "bg-red-50 text-red-700 border-red-200";
            lineClass = "bg-red-500";
          }

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 100, transition: { duration: 0.2 } }}
              className={`pointer-events-auto w-full border rounded-2xl p-4 shadow-xl flex gap-3 relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] cursor-pointer ${bgClass}`}
              onClick={() => onSelectToast(toast.issueId)}
            >
              {/* Type Accent Strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${lineClass}`} />

              {/* Icon Container */}
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                  {icon}
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 pr-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded border tracking-wider ${badgeClass}`}>
                    {badgeText}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono font-medium">
                    {toast.issueId}
                  </span>
                </div>
                
                <h5 className="text-xs font-bold text-slate-800 leading-tight">
                  {toast.type === 'resolved' 
                    ? `Issue Resolved: ${toast.title}`
                    : toast.type === 'escalated'
                    ? `Issue Escalated: ${toast.title}`
                    : `Status Update: ${toast.title}`
                  }
                </h5>
                
                <p className="text-[10px] text-slate-500 line-clamp-2">
                  {toast.type === 'resolved'
                    ? "Municipal engineering works completed. The reported community grievance has been resolved successfully."
                    : toast.type === 'escalated'
                    ? "Multi-agent priority evaluation raised this issue due to critical municipal safety patterns."
                    : "The autonomous agent grid has checked sensors and updated municipal grievance tracking."
                  }
                </p>

                <div className="pt-1.5 flex items-center gap-1 text-[10px] text-blue-600 font-bold font-mono">
                  <span>Examine Agents Logs</span>
                  <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // prevent triggering click event of the card
                  onDismiss(toast.id);
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
