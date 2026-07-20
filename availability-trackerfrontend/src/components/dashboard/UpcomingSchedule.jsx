// simple upcoming schedule component
import React from 'react';
import { fmtBlockLabel } from '../../utils/time';

export default function UpcomingSchedule({
  meetings,
  upcomingSlots,
  nowMs,
  primaryTz,
  secondaryTz,
  tzView
}) {
  return (
    <div className="mt-10 pt-6 border-t border-white/[0.06]">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Upcoming Schedule</h3>
          <p className="text-[10px] text-ink-500 mt-0.5">Your scheduled meetings and upcoming free slots</p>
        </div>
        <button className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition">
          View All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Render Meetings first */}
        {Array.isArray(meetings) && meetings.filter(m => new Date(m.endTime).getTime() > nowMs).map(m => {
          const isPast = new Date(m.endTime).getTime() < nowMs;
          const isCurrent = new Date(m.startTime).getTime() <= nowMs && !isPast;
          const dt = new Date(m.startTime);
          const dayLabel = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const timeLabel = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " - " + new Date(m.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

          return (
            <div key={m.id} className="rounded-2xl border border-purple-500/40 bg-[#160a22] p-4 flex flex-col transition hover:border-purple-400/60 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-900/60 border border-purple-700/50 shrink-0 shadow-inner">
                    <svg className="w-5 h-5 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13px] font-bold text-white truncate leading-tight tracking-wide">{m.title}</p>
                    <p className="text-[11px] text-purple-300/80 font-medium mt-1 tracking-wide">{dayLabel}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 text-[9px] font-bold bg-[#c026d3] text-white rounded-full shadow shrink-0 ml-2 uppercase tracking-wider">
                  Meeting
                </span>
              </div>
              
              <div className="flex-1 mt-5 mb-1 relative z-10">
                <p className="text-[13px] font-medium text-[#ffedd5]">{timeLabel}</p>
                <p className="mt-1.5 text-[11px] font-medium text-purple-400">
                  With: <span className="text-purple-300">{m.mentor?.name || m.user?.name || "Participant"}</span>
                </p>
              </div>
              
              {m.meetLink && (
                <a href={m.meetLink} target="_blank" rel="noreferrer" className="mt-4 block w-full py-2 bg-purple-900/80 hover:bg-purple-800 border border-purple-700/50 rounded-xl text-center text-[12px] font-bold text-white transition-all shadow-md relative z-10">
                  Join Google Meet
                </a>
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
                className={`rounded-xl border p-3.5 flex items-start gap-3 transition group ${
                  isPast
                    ? "border-red-950/40 bg-navy-950/55 opacity-70 hover:border-red-900/30"
                    : isCurrent
                      ? "border-purple-500/30 bg-purple-950/30 shadow shadow-purple-500/5 hover:border-purple-500/50"
                      : "border-white/[0.06] bg-navy-900/80 hover:border-purple-500/30"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition ${
                  isPast
                    ? "bg-red-950/30 border-red-900/20 group-hover:bg-red-900/40"
                    : isCurrent
                      ? "bg-green-950/30 border-green-500/20 group-hover:bg-green-900/40"
                      : "bg-purple-900/40 border-purple-500/20 group-hover:bg-purple-800/50"
                }`}>
                  <svg className={`w-4 h-4 ${isPast ? "text-red-400" : isCurrent ? "text-green-400" : "text-purple-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-100 flex items-center gap-1.5">
                    {dayLabel}
                    {isToday && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-purple-600 text-white rounded-full">
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
                  <p className={`text-[10px] mt-1 ${isPast ? "text-red-300/60" : isCurrent ? "text-purple-200" : "text-ink-300"}`}>{timeLabel} {tzView}</p>
                  <p className={`text-[9px] mt-0.5 ${isPast ? "text-red-400/40" : isCurrent ? "text-purple-300/40" : "text-ink-600"}`}>({gmtLabel})</p>
                </div>
              </div>
            );
          })
        ) : (
          Array.isArray(meetings) && meetings.length === 0 && (
            <div className="col-span-4 text-[11px] text-ink-500 p-6 border border-dashed border-white/[0.06] rounded-xl text-center">
              No upcoming schedule for this week. Add availability using the form on the left.
            </div>
          )
        )}
      </div>
    </div>
  );
}
