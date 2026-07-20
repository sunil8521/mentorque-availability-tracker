import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability";
import {
  getViewWeekDates,
  formatDateLocal,
  formatTimeLocal,
  formatTimeRange,
  slotToUTC,
  isPastDate,
  isPastDateTime,
} from "../utils/time";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "GMT (GMT+0)" },
  { value: "IST", label: "IST (GMT+5:30)" },
];

export default function Availability() {
  const { user } = useAuth();
  const [displayTimezone, setDisplayTimezone] = useState(user?.timezone || "UTC");
  const [viewMode, setViewMode] = useState("week"); // "week" | "template"
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current Mon–Sun week
  const [data, setData] = useState({ dates: [], availability: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState({});
  const [error, setError] = useState("");

  const [selectorDate, setSelectorDate] = useState("");
  const [selectorHour, setSelectorHour] = useState(0);

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const weekDates = getViewWeekDates(weekOffset);
      const res = await availabilityApi.getWeekly({ weekStart: weekDates[0], scope: viewMode });
      setData(res);
      setToggles({});
    } catch (e) {
      setError(e.message || "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [weekOffset, viewMode]);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  const isSlotEnabled = (dateStr, hour) => {
    const key = `${dateStr}-${hour}`;
    if (toggles[key] !== undefined) return toggles[key];
    const slots = data.availability[dateStr] || [];
    const { startTime } = slotToUTC(dateStr, hour);
    return slots.some((s) => s.startTime.slice(0, 13) === startTime.slice(0, 13));
  };

  const isSlotDisabled = (dateStr, hour) => {
    if (isPastDate(dateStr)) return true;
    const utcTodayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === utcTodayStr) {
      const { startTime } = slotToUTC(dateStr, hour);
      return isPastDateTime(startTime);
    }
    return false;
  };

  const toggleSlot = (dateStr, hour) => {
    if (isSlotDisabled(dateStr, hour)) return;
    const key = `${dateStr}-${hour}`;
    setToggles((prev) => ({ ...prev, [key]: !isSlotEnabled(dateStr, hour) }));
  };

  const saveBatch = async () => {
    setSaving(true);
    setError("");
    const slots = [];
    const pattern = [];
    
    if (viewMode === "template") {
      gridDates.forEach((dateStr, dayOfWeek) => {
        HOURS.forEach((hour) => {
          if (isSlotEnabled(dateStr, hour)) {
            pattern.push({ dayOfWeek, hour, enabled: true });
          }
        });
      });
    } else {
      gridDates.forEach((dateStr, dayOfWeek) => {
        HOURS.forEach((hour) => {
          const key = `${dateStr}-${hour}`;
          if (toggles[key] === undefined) return;
          slots.push({
            dayOfWeek,
            hour,
            enabled: toggles[key],
          });
        });
      });
    }

    if (viewMode === "week" && slots.length === 0) {
      setSaving(false);
      return;
    }

    try {
      await availabilityApi.saveBatch({
        weekStart: gridStart,
        scope: viewMode,
        slots,
        pattern,
      });
      await fetchWeekly();
      setToggles({});
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(toggles).length > 0;

  const gridDates = getViewWeekDates(weekOffset);
  const gridStart = gridDates[0];

  const prevWeek = () => {
    if (weekOffset === 0) return; // do not navigate into the past
    setWeekOffset((prev) => Math.max(0, prev - 1));
  };
  const nextWeek = () => {
    setWeekOffset((prev) => prev + 1);
  };

  const weekMin = gridDates[0] || "";
  const weekMax = gridDates[6] || "";

  /** selectorDate is UTC date (YYYY-MM-DD), selectorHour is UTC hour index (0-23). */
  const isSelectorSlotDisabled =
    selectorDate !== "" && isSlotDisabled(selectorDate, selectorHour);

  const confirmSelectorSlot = () => {
     console.log("=== confirmSelectorSlot called ===");
    console.log("selectorDate:", selectorDate);
    console.log("selectorHour:", selectorHour);
    console.log("isSelectorSlotDisabled:", isSelectorSlotDisabled);
    console.log("!selectorDate:", !selectorDate);

    if (!selectorDate || isSelectorSlotDisabled){
      console.log("RETURNING EARLY — button did nothing");
      return;
    } 
    const key = `${selectorDate}-${selectorHour}`;
    console.log("key being set:", key);
    setToggles((prev) => ({ ...prev, [key]: true }));
    console.log("toggle set successfully");
  };

  const cancelChanges = () => {
    setToggles({});
  };

  /** Format UTC hour slot (0-23) for display in current timezone. */
  const formatTimeOptionLabel = (utcHourIndex) => {
    const startISO = new Date(Date.UTC(2000, 0, 1, utcHourIndex, 0)).toISOString();
    const endISO = new Date(Date.UTC(2000, 0, 1, utcHourIndex + 1, 0)).toISOString();
    const start = formatTimeLocal(startISO, displayTimezone);
    const end = formatTimeLocal(endISO, displayTimezone);
    return formatTimeRange(`${start} – ${end}`);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">User Dashboard</h1>
        <p className="text-slate-400 font-medium">Manage your availability.</p>
      </header>

      {error && (
        <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <section className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-4">
          <div className="w-full md:w-40">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Timezone</label>
            <select
              value={displayTimezone}
              onChange={(e) => setDisplayTimezone(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Date</label>
            <input
              type="date"
              value={selectorDate}
              min={weekMin}
              max={weekMax}
              onChange={(e) => setSelectorDate(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark] appearance-none"
            />
          </div>
          <div className="w-full md:w-52">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Time</label>
            <select
              value={selectorHour}
              onChange={(e) => setSelectorHour(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-[12rem] overflow-y-auto"
            >
              {HOURS.map((utcHourIndex) => {
                const disabled = selectorDate ? isSlotDisabled(selectorDate, utcHourIndex) : false;
                return (
                  <option key={utcHourIndex} value={utcHourIndex} disabled={disabled}>
                    {formatTimeOptionLabel(utcHourIndex)}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            type="button"
            onClick={confirmSelectorSlot}
            disabled={!selectorDate || isSelectorSlotDisabled}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            Confirm / Save
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden p-6">
        <div className="mb-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your availability</h2>
            <p className="text-slate-400 font-medium text-sm mt-0.5">
              Click slots to toggle availability. Save when done.
            </p>
            <div className="mt-4 flex bg-slate-950 p-1 rounded-lg border border-slate-800 w-fit">
              <button
                type="button"
                onClick={() => setViewMode("template")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                  viewMode === "template"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Default Schedule (Every Week)
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                  viewMode === "week"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Specific Dates (Overrides)
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancelChanges}
              disabled={!hasChanges}
              className="rounded-lg border border-slate-600 bg-transparent text-slate-300 font-medium px-5 py-2.5 hover:bg-slate-800 hover:border-slate-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveBatch}
              disabled={saving || (viewMode === "week" && !hasChanges)}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : (viewMode === "template" ? "Save Default Schedule" : "Save Overrides")}
            </button>
          </div>
        </div>
        {viewMode === "week" && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4 mb-6">
            <button
              type="button"
              onClick={prevWeek}
              disabled={weekOffset === 0}
              className={`rounded-full w-9 h-9 flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-300 font-medium transition shrink-0 ${
                weekOffset === 0
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-slate-800 hover:border-slate-600"
              }`}
              aria-label="Previous week"
            >
              ←
            </button>
            <span className="text-slate-400 font-medium text-sm text-center">
              Week of {formatDateLocal(gridStart, displayTimezone)}
            </span>
            <button
              type="button"
              onClick={nextWeek}
              className="rounded-full w-9 h-9 flex items-center justify-center border border-slate-700 bg-slate-800/50 text-slate-300 font-medium hover:bg-slate-800 hover:border-slate-600 transition shrink-0"
              aria-label="Next week"
            >
              →
            </button>
          </div>
        )}

        <div className="overflow-x-auto -mx-1 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium">Loading...</div>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "11rem" }} />
                {gridDates.map((d) => (
                  <col key={d} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs whitespace-nowrap">Time</th>
                  {gridDates.map((d) => {
                    const dObj = new Date(d);
                    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dObj.getUTCDay()];
                    return (
                      <th key={d} className="py-2 px-1 text-white font-medium text-xs text-center">
                        {viewMode === "template" ? dayName : formatDateLocal(d, displayTimezone)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-slate-800/80">
                    <td className="py-1.5 px-2 text-slate-400 font-medium text-xs whitespace-nowrap align-middle">
                      {formatTimeOptionLabel(hour)}
                    </td>
                    {gridDates.map((dateStr) => {
                      const enabled = isSlotEnabled(dateStr, hour);
                      const disabled = isSlotDisabled(dateStr, hour);
                      return (
                        <td key={dateStr} className="p-1 align-middle">
                          <button
                            type="button"
                            onClick={() => toggleSlot(dateStr, hour)}
                            disabled={disabled}
                            className={`
                              block w-full py-2 rounded-md border font-medium text-xs uppercase tracking-wide transition
                              ${disabled
                                ? "bg-slate-800/50 border-slate-800 cursor-not-allowed opacity-40 text-slate-500"
                                : ""}
                              ${!disabled && enabled
                                ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-500"
                                : ""}
                              ${!disabled && !enabled
                                ? "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:bg-slate-800/80"
                                : ""}
                            `}
                          >
                            {enabled ? "AVAILABLE" : "Off"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
