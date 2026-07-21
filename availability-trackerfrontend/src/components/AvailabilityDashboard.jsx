import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability.js";
import * as adminApi from "../api/admin.js";
import { cancelMeeting } from "../api/meetings.js";
import { createRequest } from "../api/requests.js";
import {
  getViewWeekDates,
  formatDateLocal,
  formatTimeLocal,
  formatSlotLabel,
  slotToUTC,
  isSlotInPast,
  fmtBlockLabel,
} from "../utils/time";
import UpcomingSchedule from "./dashboard/UpcomingSchedule";
import { X, Trash2, CalendarX2 } from "lucide-react";

/* ──────────── constants ──────────── */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TZ_MAP = {
  IST: "Asia/Kolkata",
  UTC: "UTC",
};

const TIMEZONE_VIEW_OPTIONS = [
  { value: "both", label: "Both (IST & GMT)" },
  { value: "IST", label: "IST (GMT+5:30)" },
  { value: "UTC", label: "GMT (GMT+0)" },
];

/* ──────────── helpers ──────────── */

/** Format a UTC hour (0‑23) to a display string in the given IANA timezone.
 *  e.g. utcHour=4, tz="Asia/Kolkata" → "09:30 AM" */
function fmtHour(utcHour, ianaTz) {
  const d = new Date(Date.UTC(2000, 0, 1, utcHour, 0));
  return d.toLocaleTimeString("en-US", {
    timeZone: ianaTz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Given an ISO startTime string, returns { localDateStr, localHour, localMinute } */
function toLocalParts(isoStr, ianaTz) {
  const d = new Date(isoStr);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ianaTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "0";
  return {
    localDateStr: `${get("year")}-${get("month")}-${get("day")}`,
    localHour: parseInt(get("hour"), 10),
    localMinute: parseInt(get("minute"), 10),
  };
}

/** Group consecutive 1‑hour blocks for display.
 *  Input:  Array of { localHour, ...rest }   (sorted)
 *  Output: Array of { startHour, endHour, blocks[] }  */
function groupConsecutive(blocks) {
  if (!blocks.length) return [];
  const sorted = [...blocks].sort((a, b) => a.localHour - b.localHour);
  const groups = [];
  for (let i = 0; i < sorted.length; i++) {
    groups.push({
      startHour: sorted[i].localHour,
      endHour: sorted[i].localHour + 1,
      blocks: [sorted[i]]
    });
  }
  return groups;
}

/* ──────────── component ──────────── */

export default function AvailabilityDashboard({
  role = "USER",
  viewAs = null,
  readOnly: readOnlyProp,
  embedded = false,
}) {
  const { user } = useAuth();
  const readOnly = readOnlyProp ?? false;

  /* ── display state ── */
  const [tzView, setTzView] = useState("IST");        // which tz tab is active for the grid
  const [tzViewMode, setTzViewMode] = useState("both"); // dropdown: "both" | "IST" | "UTC"
  const primaryTz = TZ_MAP[tzView] || "Asia/Kolkata";
  const secondaryTz = tzView === "IST" ? "UTC" : "Asia/Kolkata";

  /* ── data state ── */
  const [viewMode, setViewMode] = useState("week");   // "template" | "week"
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState({ dates: [], availability: {}, hasTemplate: false });
  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [meetings, setMeetings] = useState([]);

  /* ── form state (sidebar) ── */
  const [formSlots, setFormSlots] = useState([
    { id: 1, dateStr: "", startHour: null, endHour: null },
  ]);
  const nextSlotId = useMemo(() => {
    return Math.max(0, ...formSlots.map((s) => s.id)) + 1;
  }, [formSlots]);

  const [requirementType, setRequirementType] = useState("");
  const [requirementDesc, setRequirementDesc] = useState("");

  /* ── toggles for grid changes ── */
  const [toggles, setToggles] = useState({});
  const [activeTimePicker, setActiveTimePicker] = useState(null);

  // Popup state
  const [selectedSlotDetails, setSelectedSlotDetails] = useState(null);
  const [slotActionLoading, setSlotActionLoading] = useState(false);

  /* ── derived grid dates ── */
  const gridDates = useMemo(() => getViewWeekDates(weekOffset), [weekOffset]);
  const gridStart = gridDates[0];

  const gridContainerRef = useRef(null);

  useEffect(() => {
    if (!loading && gridContainerRef.current) {
      const currentUTCHour = new Date().getUTCHours();
      const targetScrollTop = Math.max(0, currentUTCHour * GRID_HOUR_HEIGHT - 120);
      gridContainerRef.current.scrollTop = targetScrollTop;
    }
  }, [loading]);

  /* ── effects ── */
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const fetchWeekly = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const weekDates = getViewWeekDates(weekOffset);
      const params = { weekStart: weekDates[0], scope: viewMode };
      if (viewAs?.userId) params.userId = viewAs.userId;
      if (viewAs?.mentorId) params.mentorId = viewAs.mentorId;

      const [res, mtgs, requests] = await Promise.all([
        availabilityApi.getWeekly(params),
        adminApi.listMeetings().then(res => res.data || res).catch(() => []),
        (user.role === "USER" && !viewAs) ? import("../api/requests.js").then(m => m.getMyRequests()).then(r => r.data || r).catch(() => []) : Promise.resolve([])
      ]);

      setData(res);
      setMeetings(mtgs || []);

      if (requests && requests.length > 0) {
        // Find the active request (PENDING or SCHEDULED)
        const activeReq = requests.find(r => r.status === "PENDING" || r.status === "SCHEDULED");
        if (activeReq) {
          setRequirementType(activeReq.requirementType || "");
          setRequirementDesc(activeReq.requirementDesc || "");
        }
      }

      setToggles({});
    } catch (e) {
      setError(e.message || "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [weekOffset, viewMode, user?.id, viewAs?.userId, viewAs?.mentorId]);

  useEffect(() => {
    if (user) fetchWeekly();
  }, [fetchWeekly]);

  useEffect(() => {
    // reset form dates when week changes ONLY if they already had a date selected and it's no longer in gridDates
    setFormSlots((prev) =>
      prev.map((s) => {
        if (!s.dateStr) return s;
        return {
          ...s,
          dateStr: gridDates.includes(s.dateStr) ? s.dateStr : "",
        };
      })
    );
  }, [gridDates]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeTimePicker && !e.target.closest(".time-picker-el")) {
        setActiveTimePicker(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeTimePicker]);

  /* ── slot helpers (same logic as old grid, kept for save compatibility) ── */
  const isSlotEnabled = (dateStr, hour) => {
    const key = `${dateStr}-${hour}`;
    if (toggles[key] !== undefined) return toggles[key];
    const slots = data.availability[dateStr] || [];
    const { startTime } = slotToUTC(dateStr, hour);
    return slots.some((s) => s.startTime.slice(0, 13) === startTime.slice(0, 13));
  };

  const isSlotDisabled = (dateStr, hour) => {
    if (viewMode === "template") return false;
    return isSlotInPast(dateStr, hour, nowMs);
  };

  // Popup action handlers
  const handleSlotCancelMeeting = async (meetingId) => {
    if (!meetingId) return;
    setSlotActionLoading(true);
    try {
      await cancelMeeting(meetingId);
      await fetchWeekly();
      setSelectedSlotDetails(null);
    } catch (e) {
      alert("Failed to cancel meeting: " + (e.message || "Unknown error"));
    } finally {
      setSlotActionLoading(false);
    }
  };

  const handleSlotDeleteAvailability = () => {
    if (!selectedSlotDetails || readOnly) return;
    removeBlockGroup(selectedSlotDetails.dateStr, selectedSlotDetails.group.blocks.map(b => b.utcHour));
    setSelectedSlotDetails(null);
  };

  /* ── build save payload ── */
  const buildWeekChanges = () =>
    Object.entries(toggles).map(([key, enabled]) => {
      const sep = key.lastIndexOf("-");
      const dateStr = key.slice(0, sep);
      const hour = Number(key.slice(sep + 1));
      const dayOfWeek = gridDates.indexOf(dateStr);
      return { dayOfWeek, hour, enabled };
    });

  const buildFullPattern = () => {
    const pattern = [];
    gridDates.forEach((dateStr, dayOfWeek) => {
      HOURS.forEach((hour) => {
        if (isSlotEnabled(dateStr, hour)) {
          pattern.push({ dayOfWeek, hour });
        }
      });
    });
    return pattern;
  };

  /* ── save ── */
  const commitSave = async (overrideToggles = null) => {
    setSaving(true);
    setError("");
    try {
      const currentToggles = overrideToggles || toggles;
      const finalToggles = { ...currentToggles };

      // If no override toggles, it means it's a form save, so apply form slots locally first
      if (!overrideToggles) {
        formSlots.forEach((fs) => {
          if (!fs.dateStr || fs.startHour === null || fs.endHour === null) return;
          for (let h = fs.startHour; h < fs.endHour; h++) {
            const key = `${fs.dateStr}-${h}`;
            if (viewMode === "template" || !isSlotInPast(fs.dateStr, h, nowMs)) {
              finalToggles[key] = true;
            }
          }
        });
      }

      let slots = [];
      let pattern = undefined;

      if (viewMode === "week") {
        // For week, send just the changes (toggles)
        slots = Object.entries(finalToggles).map(([key, enabled]) => {
          const sep = key.lastIndexOf("-");
          const dateStr = key.slice(0, sep);
          const hour = Number(key.slice(sep + 1));
          const dayOfWeek = gridDates.indexOf(dateStr);
          return { dayOfWeek, hour, enabled };
        });
      } else {
        // For template, we MUST send the full pattern as slots (or pattern) 
        // to avoid wiping out the existing template.
        gridDates.forEach((dateStr, dayOfWeek) => {
          HOURS.forEach((hour) => {
            const key = `${dateStr}-${hour}`;
            let enabled = finalToggles[key];
            if (enabled === undefined) {
              const slotsData = data.availability[dateStr] || [];
              const { startTime } = slotToUTC(dateStr, hour);
              enabled = slotsData.some((s) => s.startTime.slice(0, 13) === startTime.slice(0, 13));
            }
            if (enabled) {
              slots.push({ dayOfWeek, hour, enabled: true });
            }
          });
        });
        pattern = slots;
      }

      const payload = {
        weekStart: gridStart,
        scope: viewMode,
        slots,
        pattern,
        ...(viewAs?.userId && { userId: viewAs.userId }),
        ...(viewAs?.mentorId && { mentorId: viewAs.mentorId }),
      };

      const reqPromises = [availabilityApi.saveBatch(payload)];

      if (requirementType && !viewAs) {
        reqPromises.push(createRequest({ requirementType, requirementDesc }));
      }

      const [res] = await Promise.all(reqPromises);

      setData(res);
      setToggles({});
      // Reset form if it was a form save
      if (!overrideToggles) {
        setFormSlots([{ id: 1, dateStr: "", startHour: null, endHour: null }]);
        setRequirementType("");
        setRequirementDesc("");
      }
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ── form handlers ── */
  const addFormSlot = () => {
    setFormSlots((prev) => [
      ...prev,
      { id: nextSlotId, dateStr: "", startHour: null, endHour: null },
    ]);
  };

  const removeFormSlot = (id) => {
    setFormSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const updateFormSlot = (id, field, value) => {
    const val = field === "dateStr" ? value : (value === "" ? null : Number(value));
    setFormSlots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: val };
        if (field === "startHour" && updated.endHour !== null && updated.endHour <= updated.startHour) {
          updated.endHour = updated.startHour + 1;
        }
        return updated;
      })
    );
  };

  /** Applies form slots into the toggles map (marks those hours enabled). */
  const applyFormSlots = () => {
    const newToggles = { ...toggles };
    formSlots.forEach((fs) => {
      if (!fs.dateStr) return;
      for (let h = fs.startHour; h < fs.endHour; h++) {
        // The grid uses UTC dateStr + UTC hour — we need to figure out which UTC slot
        // corresponds to this local time selection.
        // For simplicity and compatibility with the existing backend, we keep
        // the same model: dateStr IS a UTC date and hour IS a UTC hour (0‑23).
        // The form shows times in the primaryTz, so we convert back.
        //
        // Actually, looking at the existing save logic, gridDates are UTC dates
        // and hours are UTC hours. The form should also use UTC dates and UTC hours.
        // The display will convert to local tz later.
        const key = `${fs.dateStr}-${h}`;
        if (!isSlotDisabled(fs.dateStr, h)) {
          newToggles[key] = true;
        }
      }
    });
    setToggles(newToggles);
  };

  /** Remove a group of blocks from the grid */
  const removeBlockGroup = (dateStr, hours) => {
    const newToggles = { ...toggles };
    hours.forEach((h) => {
      newToggles[`${dateStr}-${h}`] = false;
    });
    setToggles(newToggles);
    // Immediately save when removing a slot
    commitSave(newToggles);
  };

  const hasChanges = Object.keys(toggles).length > 0;

  const isFormUntouched = formSlots.length === 1 &&
    formSlots[0].dateStr === "" &&
    formSlots[0].startHour === null &&
    formSlots[0].endHour === null;

  const isFormValid = formSlots.every(
    (fs) => fs.dateStr !== "" && fs.startHour !== null && fs.endHour !== null
  );

  const canSave = isFormValid || (isFormUntouched && hasChanges);

  /* ── compute blocks for the visual grid ── */
  const gridBlocks = useMemo(() => {
    // For each gridDate, collect which hours are enabled and compute local representations
    const result = {};
    gridDates.forEach((dateStr) => {
      const blocks = [];
      HOURS.forEach((utcHour) => {
        if (isSlotEnabled(dateStr, utcHour)) {
          const startISO = `${dateStr}T${String(utcHour).padStart(2, "0")}:00:00.000Z`;
          const endISO = `${dateStr}T${String(utcHour + 1 < 24 ? utcHour + 1 : 0).padStart(2, "0")}:00:00.000Z`;
          const local = toLocalParts(startISO, primaryTz);
          const localEnd = toLocalParts(endISO, primaryTz);
          blocks.push({
            utcDateStr: dateStr,
            utcHour,
            localHour: local.localHour,
            localMinute: local.localMinute,
            localDateStr: local.localDateStr,
            startISO,
            endISO,
          });
        }
      });
      result[dateStr] = blocks;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, toggles, gridDates, primaryTz]);

  /* ── upcoming slots (sorted, max 4) ── */
  const upcomingSlots = useMemo(() => {
    const all = [];
    gridDates.forEach((dateStr) => {
      const blocks = gridBlocks[dateStr] || [];
      const groups = groupConsecutive(blocks);
      groups.forEach((g) => {
        const startISO = g.blocks[0].startISO;
        const endISO = g.blocks[g.blocks.length - 1].endISO;
        const isPast = new Date(endISO).getTime() <= nowMs;
        const isCurrent = new Date(startISO).getTime() <= nowMs && new Date(endISO).getTime() > nowMs;
        const isToday = dateStr === new Date().toISOString().slice(0, 10);

        // check if this slot overlaps with any meeting
        const hasMeeting = Array.isArray(meetings) && meetings.some(m => {
          const mStart = new Date(m.startTime).getTime();
          const mEnd = new Date(m.endTime).getTime();
          const sStart = new Date(startISO).getTime();
          const sEnd = new Date(endISO).getTime();
          return (mStart < sEnd && mEnd > sStart); // overlap condition
        });

        if (!hasMeeting && (!isPast || isToday)) {
          all.push({
            dateStr,
            startISO,
            endISO,
            startHour: g.startHour,
            endHour: g.endHour,
            blocks: g.blocks,
            isPast,
            isCurrent,
          });
        }
      });
    });
    all.sort((a, b) => a.startISO.localeCompare(b.startISO));
    return all.slice(0, 4);
  }, [gridBlocks, gridDates, nowMs, meetings]);

  /* ── time option labels for the form ── */
  const timeOptions = useMemo(
    () =>
      HOURS.map((h) => {
        const label = fmtHour(h, primaryTz);
        return { value: h, label };
      }),
    [primaryTz]
  );

  /* ── format helpers for the grid ── */

  /* ──────────── GRID HOURS to render (only 8am‑2pm-ish range like screenshot, but show all 24 for full data) ── */
  // Show hours that have visibility. We'll render all 24 but the scroll will start at a useful position.
  const GRID_HOUR_HEIGHT = 64; // px per hour row

  /* ──────────── RENDER ──────────── */
  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto text-ink-50 font-sans p-4 relative">
      {/* ── Top Header Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Your Availability</h1>
          <p className="text-xs text-ink-500 mt-1">View and manage your available time slots.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-ink-500">Timezone View</span>
          <select
            value={tzViewMode}
            onChange={(e) => {
              setTzViewMode(e.target.value);
              if (e.target.value !== "both") setTzView(e.target.value);
            }}
            className="bg-[#12121C] border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-white font-medium focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition cursor-pointer"
          >
            {TIMEZONE_VIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Timezone toggle pills ── */}
      {tzViewMode === "both" && (
        <div className="flex">
          <div className="inline-flex bg-[#0A0A10] rounded-xl p-1 border border-white/[0.08]">
            <button
              onClick={() => setTzView("IST")}
              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 select-none focus:outline-none focus:ring-0 ${tzView === "IST"
                ? "bg-[#1C1C28] text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
            > 
              IST (GMT+5:30)
            </button>
            <button
              onClick={() => setTzView("UTC")}
              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 select-none focus:outline-none focus:ring-0 ${tzView === "UTC"
                ? "bg-[#1C1C28] text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
            >
              GMT (GMT+0)
            </button>
          </div>
        </div>
      )}

      {/* ── Main Flex Layout (Sidebar next to Calendar Grid) ── */}
      <div className="flex flex-col xl:flex-row gap-4 w-full">
        {/* ═══════════════ LEFT SIDEBAR ═══════════════ */}
        <aside className="w-full xl:w-[320px] shrink-0 space-y-5">
          {/* ── Set Your Availability Card ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-navy-900/80 backdrop-blur p-5 shadow-lg">
            <h2 className="text-base font-semibold text-ink-50">
              Set Your Availability {viewMode === "template" ? "for every week" : "for this week"}
            </h2>
            <p className="text-[11px] text-ink-500 mt-1 mb-5 leading-relaxed">
              Add availability {viewMode === "template" ? "for every week" : "for this week only"}.
            </p>

            {/* Add Time Slot */}
            <h3 className="text-xs font-semibold text-ink-100 mb-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
              </svg>
              Add Time Slot
            </h3>

            <div className="space-y-4">
              {formSlots.map((fs, idx) => (
                <div
                  key={fs.id}
                  className="rounded-xl border border-white/[0.05] bg-navy-950/60 p-3.5 space-y-3"
                >
                  {/* Select Date */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-ink-500 uppercase tracking-wider">
                      Select Date
                    </label>
                    <select
                      value={fs.dateStr}
                      onChange={(e) => updateFormSlot(fs.id, "dateStr", e.target.value)}
                      className="w-full bg-navy-900 border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-ink-100 focus:outline-none focus:ring-1 focus:ring-white/20 transition font-semibold"
                    >
                      <option value="">Select Date</option>
                      {gridDates.map((d) => {
                        const dt = new Date(d + "T12:00:00Z");
                        const label = dt.toLocaleDateString("en-US", {
                          timeZone: primaryTz,
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                        return (
                          <option key={d} value={d}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Start / End */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-medium text-ink-500 mb-1 uppercase tracking-wider">
                        Start Time ({tzView})
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTimePicker(
                              activeTimePicker?.id === fs.id && activeTimePicker?.field === "startHour"
                                ? null
                                : { id: fs.id, field: "startHour" }
                            )
                          }
                          className="time-picker-el w-full bg-navy-900 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-ink-100 text-left flex justify-between items-center font-semibold hover:border-white/[0.15] focus:outline-none focus:ring-1 focus:ring-white/20 transition"
                        >
                          <span>{fs.startHour !== null ? fmtHour(fs.startHour, primaryTz) : "Start Time"}</span>
                          <svg className="w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {activeTimePicker?.id === fs.id && activeTimePicker?.field === "startHour" && (
                          <div className="time-picker-el absolute top-full left-0 mt-1 w-[240px] bg-navy-950/95 border border-white/[0.1] rounded-xl p-2 shadow-2xl z-50 backdrop-blur-md">
                            <div className="grid grid-cols-4 gap-1 p-0.5">
                              {HOURS.map((h) => {
                                const label = fmtHour(h, primaryTz);
                                const selected = fs.startHour === h;
                                const isDisabled = viewMode === "week" && isSlotInPast(fs.dateStr, h, nowMs);
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => {
                                      updateFormSlot(fs.id, "startHour", h);
                                      setActiveTimePicker(null);
                                    }}
                                    className={`text-[9px] font-semibold py-1.5 rounded transition-all text-center ${isDisabled
                                      ? "bg-navy-950/40 border border-white/[0.02] text-ink-700 cursor-not-allowed opacity-25 pointer-events-none"
                                      : selected
                                        ? "bg-white/20 text-white font-bold border border-white/20"
                                        : "bg-navy-900/60 border border-white/[0.03] text-ink-300 hover:bg-navy-800 hover:text-white"
                                      }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-ink-500 mb-1 uppercase tracking-wider">
                        End Time ({tzView})
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          disabled={fs.startHour === null}
                          onClick={() =>
                            setActiveTimePicker(
                              activeTimePicker?.id === fs.id && activeTimePicker?.field === "endHour"
                                ? null
                                : { id: fs.id, field: "endHour" }
                            )
                          }
                          className="time-picker-el w-full bg-navy-900 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-ink-100 text-left flex justify-between items-center font-semibold hover:border-white/[0.15] focus:outline-none focus:ring-1 focus:ring-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span>{fs.endHour !== null ? fmtHour(fs.endHour, primaryTz) : "End Time"}</span>
                          <svg className="w-3.5 h-3.5 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {activeTimePicker?.id === fs.id && activeTimePicker?.field === "endHour" && (
                          <div className="time-picker-el absolute top-full right-0 mt-1 w-[240px] bg-navy-950/95 border border-white/[0.1] rounded-xl p-2 shadow-2xl z-50 backdrop-blur-md">
                            <div className="grid grid-cols-4 gap-1 p-0.5">
                              {HOURS.map((h) => {
                                const label = fmtHour(h, primaryTz);
                                const selected = fs.endHour === h;
                                const isDisabled =
                                  h <= fs.startHour || (viewMode === "week" && isSlotInPast(fs.dateStr, h, nowMs));
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    onClick={() => {
                                      updateFormSlot(fs.id, "endHour", h);
                                      setActiveTimePicker(null);
                                    }}
                                    className={`text-[9px] font-semibold py-1.5 rounded transition-all text-center ${isDisabled
                                      ? "bg-navy-950/40 border border-white/[0.02] text-ink-700 cursor-not-allowed opacity-25 pointer-events-none"
                                      : selected
                                        ? "bg-white/20 text-white font-bold border border-white/20"
                                        : "bg-navy-900/60 border border-white/[0.03] text-ink-300 hover:bg-navy-800 hover:text-white"
                                      }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  {formSlots.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => removeFormSlot(fs.id)}
                        className="flex items-center gap-1 text-[10px] font-medium text-red-400/80 hover:text-red-300 transition"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* + Add another slot */}
              {formSlots.length < 5 && (
                <button
                  onClick={addFormSlot}
                  className="w-full py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold bg-[#161622] hover:bg-[#202030] text-white border border-white/10 hover:border-white/20 rounded-xl transition shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add another slot
                </button>
              )}
            </div>

            {/* User Requirements (What and Description) */}
            {!readOnly && role === "USER" && (
              <div className="mt-8 space-y-5">
                {/* Call Type */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Choose Call Type</h3>
                  <p className="text-[11px] text-ink-400 mb-3">What do you need help with?</p>

                  <div className="space-y-2">
                    {[
                      { value: "RESUME_REVAMP", label: "Resume Revamp" },
                      { value: "JOB_MARKET_GUIDANCE", label: "Job Market Guidance" },
                      { value: "MOCK_INTERVIEW", label: "Mock Interview" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-2.5 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="radio"
                            name="callType"
                            value={option.value}
                            checked={requirementType === option.value}
                            onChange={(e) => setRequirementType(e.target.value)}
                            className="peer sr-only"
                          />
                          <div className="w-4 h-4 rounded-full border border-white/[0.15] bg-navy-950 peer-checked:border-white peer-checked:bg-white/20 transition-all group-hover:border-slate-300"></div>
                          <div className="absolute w-2 h-2 rounded-full bg-white scale-0 peer-checked:scale-100 transition-transform"></div>
                        </div>
                        <span className="text-[12px] font-medium text-ink-200 group-hover:text-white transition-colors">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Describe Your Requirement</h3>
                  <p className="text-[11px] text-ink-400 mb-2">Describe your goal</p>
                  <textarea
                    value={requirementDesc}
                    onChange={(e) => setRequirementDesc(e.target.value)}
                    placeholder={"\"I am targeting backend roles.\nPlease review my resume and suggest improvements.\""}
                    className="w-full h-24 bg-navy-950 border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/10 transition resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Timezone info */}
            <div className="mt-6 flex items-start gap-2 bg-navy-950/50 rounded-lg p-3 border border-white/[0.04]">
              <div className="w-2 h-2 mt-0.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
              <div>
                <p className="text-[11px] font-semibold text-ink-200">Time Zone</p>
                <p className="text-[10px] text-ink-500 leading-relaxed">
                  All times are shown in your local timezone.
                  <br />
                  Current: <span className="text-white font-bold">{tzView} (GMT+5:30)</span>
                </p>
              </div>
            </div>

            {/* Apply + Save */}
            {!readOnly && (
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => commitSave()}
                  disabled={saving || !canSave}
                  className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-[#161622] hover:bg-[#202030] text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md"
                >
                  {saving ? "Saving…" : "Save Availability"}
                </button>
              </div>
            )}
            {error && <p className="text-red-400 text-[11px] mt-2 text-center">{error}</p>}
          </div>
        </aside>

        {/* ═══════════════ RIGHT MAIN ═══════════════ */}
        <div className="flex-1 min-w-0">
          {/* ── Calendar Card ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-navy-900/80 backdrop-blur shadow-lg overflow-hidden">
            {/* Nav row */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center bg-[#0A0A10] rounded-xl border border-white/[0.08] p-0.5">
                  <button
                    onClick={() => setWeekOffset((p) => p - 1)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-[11px] font-bold text-white px-3 select-none whitespace-nowrap">
                    {(() => {
                      const s = new Date(gridStart + "T12:00:00Z");
                      const e = new Date(gridDates[6] + "T12:00:00Z");
                      const fmt = (d) => d.toLocaleDateString("en-US", { timeZone: primaryTz, month: "short", day: "numeric" });
                      const yr = s.toLocaleDateString("en-US", { timeZone: primaryTz, year: "numeric" });
                      return `${fmt(s)} – ${fmt(e)}, ${yr.split(", ")[1] || s.getFullYear()}`;
                    })()}
                  </span>
                  <button
                    onClick={() => setWeekOffset((p) => p + 1)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="px-3.5 py-1.5 bg-[#161622] hover:bg-[#202030] border border-white/[0.08] rounded-xl text-[11px] font-bold text-white transition-all select-none focus:outline-none focus:ring-0 shadow-sm"
                >
                  Today
                </button>
              </div>
              {/* Tabs / Mode Toggle */}
              <div className="flex bg-[#0A0A10] rounded-xl p-1 border border-white/[0.08]">
                <button
                  onClick={() => setViewMode("template")}
                  className={`px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 select-none focus:outline-none focus:ring-0 ${viewMode === "template"
                    ? "bg-[#1C1C28] text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                >
                  Every Week
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 select-none focus:outline-none focus:ring-0 ${viewMode === "week"
                    ? "bg-[#1C1C28] text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                >
                  This Week Only
                </button>
              </div>
            </div>

            {/* Grid */}
            <div ref={gridContainerRef} className="flex overflow-auto mq-scroll" style={{ maxHeight: "56vh" }}>
              {/* Y‑axis time labels */}
              <div className="w-16 shrink-0 border-r border-white/[0.05] bg-navy-900/60 relative">
                <div className="h-10 border-b border-white/[0.05] sticky top-0 z-20 bg-navy-900/90 backdrop-blur-sm" />
                <div>
                  <div style={{ height: 16 }} />
                  {HOURS.map((utcHour) => {
                    const main = fmtHour(utcHour, primaryTz);
                    const sec = fmtHour(utcHour, secondaryTz);
                    return (
                      <div key={utcHour} className="relative border-b border-white/[0.03]" style={{ height: GRID_HOUR_HEIGHT }}>
                        <div className="absolute -top-2.5 left-0 right-0 flex flex-col items-center">
                          <span className="text-[10px] font-medium text-ink-400 leading-tight">{main}</span>
                          {tzViewMode === "both" && (
                            <span className="text-[8px] text-ink-600 leading-tight">{sec}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day columns */}
              <div className="flex-1 flex flex-col min-w-[600px]">
                {/* Day headers */}
                <div className="flex sticky top-0 z-20 bg-navy-900/90 backdrop-blur-sm border-b border-white/[0.05] h-10">
                  {gridDates.map((d) => {
                    const dt = new Date(d + "T12:00:00Z");
                    const dayName = dt.toLocaleDateString("en-US", { timeZone: primaryTz, weekday: "short" });
                    const dayNum = dt.toLocaleDateString("en-US", { timeZone: primaryTz, month: "short", day: "numeric" });
                    const isToday = d === new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={d}
                        className={`flex-1 flex flex-col items-center justify-center border-r border-white/[0.03] last:border-r-0 ${isToday ? "bg-white/[0.06]" : ""
                          }`}
                      >
                        <span className={`text-[11px] font-bold ${isToday ? "text-white" : "text-ink-100"}`}>
                          {dayName}
                        </span>
                        <span className={`text-[9px] ${isToday ? "text-slate-300 font-semibold" : "text-ink-500"}`}>{dayNum}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Grid body */}
                {loading ? (
                  <div className="flex items-center justify-center py-20 text-ink-500 text-sm">Loading…</div>
                ) : (
                  <div>
                    <div className="flex relative">
                      {/* Horizontal gridlines */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col">
                        <div style={{ height: 16 }} />
                        {HOURS.map((h) => (
                          <div key={h} className="border-b border-white/[0.03] w-full" style={{ height: GRID_HOUR_HEIGHT }} />
                        ))}
                      </div>

                      {/* Columns with blocks */}
                      {gridDates.map((dateStr) => {
                        const blocks = gridBlocks[dateStr] || [];
                        const groups = groupConsecutive(blocks);
                        const isToday = dateStr === new Date().toISOString().slice(0, 10);

                        return (
                          <div
                            key={dateStr}
                            className={`flex-1 relative border-r border-white/[0.03] last:border-r-0 ${isToday ? "bg-white/[0.02]" : ""
                              }`}
                            style={{ height: HOURS.length * GRID_HOUR_HEIGHT + 16 }}
                          >
                            {groups.map((g, gi) => {
                              // Position based on UTC hour since our grid Y-axis is mapped to UTC hours
                              const topPx = (g.blocks[0].utcHour * GRID_HOUR_HEIGHT) + 16;
                              const heightPx = g.blocks.length * GRID_HOUR_HEIGHT;
                              const startISO = g.blocks[0].startISO;
                              const endISO = g.blocks[g.blocks.length - 1].endISO;
                              const label1 = fmtBlockLabel(startISO, endISO, primaryTz);
                              const label2 = fmtBlockLabel(startISO, endISO, secondaryTz);
                              const isPast = viewMode === "week" && new Date(endISO).getTime() <= nowMs;
                              const isCurrent = viewMode === "week" && new Date(startISO).getTime() <= nowMs && new Date(endISO).getTime() > nowMs;

                              const blockMeetings = Array.isArray(meetings) ? meetings.filter(m =>
                                new Date(m.startTime).getTime() >= new Date(startISO).getTime() &&
                                new Date(m.startTime).getTime() < new Date(endISO).getTime()
                              ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

                              const activeMeeting = blockMeetings.find(m => m.status !== "CANCELLED");

                              return (
                                <div
                                  key={gi}
                                  onClick={() => {
                                    if (!isPast) {
                                      setSelectedSlotDetails({ group: g, dateStr, meetings: blockMeetings, activeMeeting, label1, label2, isCurrent });
                                    }
                                  }}
                                  className={`absolute left-1 right-1 rounded-lg overflow-hidden transition-all shadow-lg ${isPast ? "cursor-default" : "cursor-pointer hover:-translate-y-[1px] hover:shadow-xl"
                                    } ${isPast
                                      ? "bg-navy-950/60 border border-red-900/30 opacity-75"
                                      : isCurrent
                                        ? "bg-[#1C1C28] border border-white/20 opacity-95 shadow-md"
                                        : "bg-[#181824] border border-white/10 hover:bg-[#202030] hover:border-white/20"
                                    }`}
                                  style={{ top: topPx + 2, height: heightPx - 4 }}
                                >
                                  <div className="p-1.5 h-full flex flex-col justify-between relative">
                                    <div>
                                      <div className="flex items-center justify-between gap-1 w-full">
                                        <span className={`text-[9px] font-bold leading-tight ${isPast
                                            ? "text-red-300/90"
                                            : "text-white"
                                          }`}>{label1}</span>
                                        {isPast && (
                                          <span className="px-1.5 py-0.5 text-[7px] font-bold bg-red-950 text-red-400 border border-red-900/50 rounded shrink-0">
                                            Past
                                          </span>
                                        )}
                                        {isCurrent && (
                                          <span className="px-1.5 py-0.5 text-[7px] font-bold bg-green-950 text-green-400 border border-green-500/50 rounded shrink-0">
                                            Current
                                          </span>
                                        )}
                                      </div>
                                      <span className={`text-[8px] leading-tight block mt-0.5 ${isPast
                                          ? "text-red-400/60"
                                          : "text-slate-300 font-medium"
                                        }`}>
                                        ({label2})
                                      </span>
                                    </div>
                                    {activeMeeting && (
                                      <div className="absolute bottom-1 right-1">
                                        <span className="px-1.5 py-0.5 text-[7px] font-bold bg-emerald-600 text-white rounded shadow-sm border border-emerald-500/30">
                                          Meeting
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* ── Upcoming Meetings & Availability ── */}
          <UpcomingSchedule
            meetings={meetings}
            upcomingSlots={upcomingSlots}
            nowMs={nowMs}
            primaryTz={primaryTz}
            secondaryTz={secondaryTz}
            tzView={tzView}
            onRefresh={fetchWeekly}
            role={role}
          />
        </div>
      </div>

      {/* Slot Details Modal */}
      {selectedSlotDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-[#0A0A10]/95 border border-white/[0.08] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative shadow-purple-950/10">
            <button
              onClick={() => setSelectedSlotDetails(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors bg-white/[0.03] hover:bg-white/[0.08] p-1.5 rounded-full border border-white/[0.05]"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-6 pb-4 border-b border-white/[0.04]">
              <h3 className="text-base font-bold text-white tracking-tight">Slot Details</h3>
              <p className="text-xs text-slate-400 font-medium mt-1 font-mono tracking-wide uppercase">
                {new Date(selectedSlotDetails.dateStr).toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto mq-scroll">
              <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/35 to-transparent opacity-50"></div>
                <span className="text-base font-black text-white mb-1.5">{selectedSlotDetails.label1}</span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">GMT: {selectedSlotDetails.label2}</span>
              </div>

              {selectedSlotDetails.meetings.length > 0 && (
                <div className="space-y-3.5">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Slot History</h4>
                  {selectedSlotDetails.meetings.map(m => {
                    const isActive = m.status !== "CANCELLED";

                    let cancelLabel = "Cancelled";
                    let cancelColor = "text-red-400";
                    let cancelBg = "bg-red-500/10";
                    let cancelBorder = "border-red-500/20";

                    if (!isActive && m.cancelledBy) {
                      if (m.cancelledBy === m.bookedUserId) {
                        cancelLabel = "Cancelled by User";
                        cancelColor = "text-orange-400";
                        cancelBg = "bg-orange-500/10";
                        cancelBorder = "border-orange-500/20";
                      } else if (m.cancelledBy === m.bookedMentorId) {
                        cancelLabel = "Cancelled by Mentor";
                        cancelColor = "text-rose-400";
                        cancelBg = "bg-rose-500/10";
                        cancelBorder = "border-rose-500/20";
                      } else {
                        cancelLabel = "Cancelled by Admin";
                        cancelColor = "text-red-400";
                        cancelBg = "bg-red-500/10";
                        cancelBorder = "border-red-500/20";
                      }
                    }

                    return (
                      <div key={m.id} className={`border rounded-2xl p-4 transition-all ${isActive ? 'bg-emerald-950/15 border-emerald-500/25 shadow-sm' : `bg-white/[0.01] ${cancelBorder} opacity-75 hover:opacity-100`}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isActive ? 'text-emerald-400' : cancelColor}`}>
                            {isActive ? 'Scheduled Meeting' : cancelLabel}
                          </span>
                          <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full border ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : `${cancelBg} ${cancelColor} ${cancelBorder}`}`}>
                            {isActive ? 'Active' : 'Cancelled'}
                          </span>
                        </div>
                        <h4 className={`text-sm font-bold mt-2 mb-1 ${isActive ? 'text-white' : 'text-slate-500 line-through'}`}>{m.title}</h4>
                        <p className="text-xs text-slate-400 font-medium">With {role === 'MENTOR' ? (m.user?.name || "Participant") : (m.mentor?.name || m.user?.name)}</p>

                        {isActive && (
                          <button
                            onClick={() => handleSlotCancelMeeting(m.id)}
                            disabled={slotActionLoading || selectedSlotDetails.isCurrent}
                            className="w-full mt-4 py-2.5 bg-red-950/25 hover:bg-red-950/45 border border-red-500/20 hover:border-red-500/35 text-red-400 font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 duration-200"
                          >
                            <CalendarX2 className="w-3.5 h-3.5" />
                            {slotActionLoading ? "Cancelling..." : "Cancel Meeting"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Only show delete availability if there is NO active meeting */}
              {!selectedSlotDetails.activeMeeting && !readOnly && !selectedSlotDetails.isCurrent && (
                <div className="pt-2.5 border-t border-white/[0.04]">
                  <button
                    onClick={handleSlotDeleteAvailability}
                    className="w-full py-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-800/40 text-red-300/80 hover:text-red-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 duration-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Availability Slot
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
