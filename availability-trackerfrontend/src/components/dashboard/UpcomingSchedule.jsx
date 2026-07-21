// simple upcoming schedule component with cancel support
import React, { useState } from 'react';
import { fmtBlockLabel } from '../../utils/time';
import { cancelMeeting } from '../../api/meetings';

export default function UpcomingSchedule({
  meetings,
  upcomingSlots,
  nowMs,
  primaryTz,
  secondaryTz,
  tzView,
  onRefresh,
  role
}) {
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const handleCancel = async (meetingId) => {
    setCancellingId(meetingId);
    try {
      await cancelMeeting(meetingId);
      setConfirmId(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert("Failed to cancel: " + (e.message || "Unknown error"));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="mt-10 pt-6 border-t border-white/[0.06]">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-50">Upcoming Schedule</h3>
        <p className="text-[10px] text-ink-500 mt-0.5">Your scheduled meetings and upcoming free slots</p>
      </div>

      <div className="flex overflow-x-auto gap-3.5 pb-3 mq-scroll">
        {/* Render Meetings first */}
        {Array.isArray(meetings) && meetings.filter(m => new Date(m.endTime).getTime() > nowMs).map(m => {
          const isCancelled = m.status === "CANCELLED";
          const isPast = new Date(m.endTime).getTime() < nowMs;
          const isCurrent = new Date(m.startTime).getTime() <= nowMs && !isPast;
          const isFuture = new Date(m.startTime).getTime() > nowMs;
          const dt = new Date(m.startTime);
          const dayLabel = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const timeLabel = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " - " + new Date(m.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          // cancelled meetings show differently
          if (isCancelled) {
            return (
              <div key={m.id} className="w-[280px] shrink-0 rounded-2xl border border-white/[0.06] bg-navy-900/40 p-4 flex flex-col opacity-60">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-950/40 border border-red-900/30 shrink-0">
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[13px] font-bold text-ink-400 truncate leading-tight line-through">{m.title}</p>
                      <p className="text-[11px] text-ink-500 font-medium mt-1">{dayLabel}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 text-[9px] font-bold bg-red-950 text-red-400 border border-red-900/40 rounded-full shrink-0 ml-2 uppercase tracking-wider">
                    Cancelled
                  </span>
                </div>
                <div className="flex-1 mt-3">
                  <p className="text-[12px] text-ink-500 line-through">{timeLabel}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className="w-[280px] shrink-0 rounded-2xl border border-white/10 bg-[#12121A] p-4 flex flex-col transition hover:border-white/20 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-white/10 transition-colors"></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 border border-white/15 shrink-0 shadow-inner">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13px] font-bold text-white truncate leading-tight tracking-wide">{m.title}</p>
                    <p className="text-[11px] text-slate-300 font-medium mt-1 tracking-wide">{dayLabel}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 text-[9px] font-bold bg-[#1C1C28] text-white border border-white/15 rounded-full shadow shrink-0 ml-2 uppercase tracking-wider">
                  Meeting
                </span>
              </div>
              
              <div className="flex-1 mt-5 mb-1 relative z-10">
                <p className="text-[13px] font-medium text-[#ffedd5]">{timeLabel}</p>
                <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                  With: <span className="text-slate-200">{role === 'MENTOR' ? (m.user?.name || "Participant") : (m.mentor?.name || m.user?.name || "Participant")}</span>
                </p>
              </div>
              
              <div className="mt-4 flex gap-2 relative z-10">
                {m.meetLink && (
                  <a href={m.meetLink} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-[#1C1C28] hover:bg-[#252538] border border-white/15 rounded-xl text-center text-[12px] font-bold text-white transition-all shadow-md">
                    Join Google Meet
                  </a>
                )}
                {/* Cancel button - only for future meetings */}
                {isFuture && confirmId !== m.id && (
                  <button
                    onClick={() => setConfirmId(m.id)}
                    className="px-3 py-2 bg-navy-950/80 hover:bg-red-950/40 border border-white/[0.06] hover:border-red-500/30 rounded-xl text-[11px] font-semibold text-ink-400 hover:text-red-400 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Inline confirmation */}
              {confirmId === m.id && (
                <div className="mt-3 pt-3 border-t border-white/10 relative z-10">
                  <p className="text-[11px] text-red-300 font-semibold mb-2">Are you sure you want to cancel this meeting?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancel(m.id)}
                      disabled={cancellingId === m.id}
                      className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {cancellingId === m.id ? "Cancelling..." : "Yes, Cancel"}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="flex-1 py-1.5 bg-navy-800 hover:bg-navy-700 border border-white/[0.06] text-ink-300 text-[11px] font-semibold rounded-lg transition"
                    >
                      Keep Meeting
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Render Available Slots */}
        {upcomingSlots.length > 0 ? (
          upcomingSlots.map((slot, i) => {
            const dt = new Date(slot.startISO);
            const isToday = slot.dateStr === new Date().toISOString().slice(0, 10);
            const isPast = slot.isPast;
            const isCurrent = slot.isCurrent;
            const dayLabel = dt.toLocaleDateString("en-US", {
              timeZone: primaryTz,
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timeLabel = fmtBlockLabel(slot.startISO, slot.endISO, primaryTz);
            const gmtLabel = fmtBlockLabel(slot.startISO, slot.endISO, secondaryTz);

            return (
              <div
                key={`slot-${i}`}
                className={`w-[260px] shrink-0 rounded-xl border p-3.5 flex items-start gap-3 transition group ${
                  isCurrent
                    ? "border-white/20 bg-white/[0.06] shadow-sm hover:border-white/30"
                    : "border-white/[0.06] bg-navy-900/80 hover:border-white/20"
                } ${isPast ? "opacity-60 grayscale-[30%] hover:opacity-100 hover:grayscale-0" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition ${
                  isCurrent
                    ? "bg-green-950/30 border-green-500/20 group-hover:bg-green-900/40"
                    : "bg-white/10 border-white/15 group-hover:bg-white/20"
                }`}>
                  <svg className={`w-4 h-4 ${isCurrent ? "text-green-400" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-100 flex items-center gap-1.5">
                    {dayLabel}
                    {isToday && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-white/20 text-white rounded-full">
                        Today
                      </span>
                    )}
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-green-950 text-green-400 border border-green-900/50 rounded-full">
                        Current
                      </span>
                    )}
                    {isPast && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-red-950 text-red-400 border border-red-900/50 rounded-full">
                        Past
                      </span>
                    )}
                  </p>
                  <p className={`text-[10px] mt-1 ${isCurrent ? "text-slate-200 font-semibold" : "text-ink-300"}`}>{timeLabel} {tzView}</p>
                  <p className={`text-[9px] mt-0.5 ${isCurrent ? "text-slate-400" : "text-ink-600"}`}>({gmtLabel})</p>
                </div>
              </div>
            );
          })
        ) : (
          Array.isArray(meetings) && meetings.length === 0 && (
            <div className="w-full text-[11px] text-ink-500 p-6 border border-dashed border-white/[0.06] rounded-xl text-center">
              No upcoming schedule for this week. Add availability using the form on the left.
            </div>
          )
        )}
      </div>
    </div>
  );
}
