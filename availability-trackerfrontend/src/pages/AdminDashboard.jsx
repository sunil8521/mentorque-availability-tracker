import { useState, useEffect, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { useAuth } from "../context/AuthContext";
import * as adminApi from "../api/admin";
import * as availabilityApi from "../api/availability";
import { getWeekStartStr } from "../utils/time";
import {
  Search, ChevronLeft, ChevronRight, Calendar, User, Clock,
  CheckCircle2, Check, ArrowRight, FileText, History, Info,
  AlertTriangle, Users, CalendarCheck, XCircle, LayoutDashboard,
  MoreVertical, TrendingUp, Filter, SortDesc, X, Video, UserCheck, Settings, BarChart3
} from "lucide-react";

function UserCard({ person, isMentor = false, onAction, actionText = "View Details", badgeText, subBadgeText, footerText }) {
  const initials = person.name?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) || "U";

  return (
    <div className="bg-[#0E0E16] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 flex flex-col justify-between group shadow-xl">
      {/* Top Section */}
      <div className="p-5 flex-1 flex flex-col space-y-3.5">
        {/* Avatar + Header Info */}
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-full border flex items-center justify-center text-sm font-bold shrink-0 ${isMentor
            ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
            : "bg-white/10 border-white/15 text-white"
            }`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-sm font-bold text-white truncate">{person.name}</h3>
              {badgeText && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/15 uppercase tracking-wide whitespace-nowrap">
                  {badgeText}
                </span>
              )}
              {subBadgeText && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 whitespace-nowrap">
                  {subBadgeText}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate mb-1">{person.email}</p>
          </div>
        </div>

        {/* Tags Section */}
        {person.tags && person.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {person.tags.map(t => (
              <span key={t} className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-[#161622] text-slate-300 border border-white/[0.06]">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Description Section */}
        {person.description && (
          <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed flex-1">
            {person.description}
          </p>
        )}
      </div>

      {/* Bottom Footer Bar */}
      <div className="bg-[#12121C] px-5 py-3 border-t border-white/[0.06] flex items-center justify-between group-hover:bg-white/[0.03] transition-colors">
        <span className="text-[10px] text-slate-500 font-medium">
          {footerText || (isMentor ? "Verified Mentor" : "Registered User")}
        </span>
        {onAction && (
          <button
            onClick={() => onAction(person)}
            className="px-3.5 py-1.5 bg-[#1C1C28] hover:bg-[#252538] text-white text-[11px] font-bold rounded-xl transition border border-white/15 hover:border-white/25 shadow-md flex items-center gap-1.5"
          >
            {actionText} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user: authUser } = useAuth();

  // Data State
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mentorOverlaps, setMentorOverlaps] = useState({});

  // Selection State
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Availability State
  const [userAvail, setUserAvail] = useState(null);
  const [mentorAvail, setMentorAvail] = useState(null);

  // AI Recommendation State
  const [aiLoadingState, setAiLoadingState] = useState(0);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [aiFallbackMentors, setAiFallbackMentors] = useState([]);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("Pending");
  const [displayTz, setDisplayTz] = useState("IST");
  const [availTab, setAvailTab] = useState("Upcoming");
  const [bookingLoading, setBookingLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState("details"); // "details" | "schedule"

  // Initialization
  const weekStart = useMemo(() => {
    const today = new Date();
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    return getWeekStartStr(base);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [u, m, mtgs] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listMentors(),
        adminApi.listMeetings()
      ]);
      setUsers(u || []);
      setMentors(m || []);
      setMeetings(mtgs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived: Pending Users
  const pendingUsers = useMemo(() => {
    return users.filter(u => {
      if (!u.requirementType) return false;
      if (!u.hasFutureAvailability) return false;
      const scheduledMeetings = (u.meetingsAsUser || []).filter(m => m.status === "SCHEDULED");
      if (scheduledMeetings.length > 0) return false;
      return true;
    }).map(u => {
      const cancelledMeetings = (u.meetingsAsUser || []).filter(m => m.status === "CANCELLED");
      return { ...u, wasCancelled: cancelledMeetings.length > 0 };
    }).filter(u => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, searchQuery]);

  // Load Availabilities when selected
  useEffect(() => {
    if (selectedUser) {
      availabilityApi.getWeekly({ userId: selectedUser.id, weekStart }).then(setUserAvail).catch(() => setUserAvail(null));
    } else {
      setUserAvail(null);
    }
  }, [selectedUser, weekStart]);

  useEffect(() => {
    if (selectedMentor) {
      availabilityApi.getWeekly({ mentorId: selectedMentor.id, weekStart }).then(setMentorAvail).catch(() => setMentorAvail(null));
    } else {
      setMentorAvail(null);
      setSelectedSlot(null);
    }
  }, [selectedMentor, weekStart]);

  // AI Recommendations logic — triggered when user opens schedule view
  // Two independent streams: (1) LLM recommendations, (2) overlap computation
  const triggerAiRecommendations = useCallback(() => {
    if (!selectedUser) return;
    setAiLoadingState(1); // 1 = LLM loading
    setAiRecommendations([]);
    setAiFallbackMentors([]);
    setMentorOverlaps({});

    // Stream 1: LLM recommendations (just user data, no availability sent)
    adminApi.recommendMentors(selectedUser.id).then((res) => {
      setAiRecommendations(res.recommendations || []);
      setAiFallbackMentors(res.allMentors || []);
      setAiLoadingState(0); // done
    }).catch(e => {
      console.error("LLM recommendation failed", e);
      setAiLoadingState(0);
      setAiFallbackMentors(mentors);
    });

    // Stream 2: Compute overlaps for ALL mentors independently
    (async () => {
      try {
        const uAvail = await availabilityApi.getWeekly({ userId: selectedUser.id, weekStart });
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const newOverlaps = {};

        await Promise.all(mentors.map(async (m) => {
          try {
            const mAvail = await availabilityApi.getWeekly({ mentorId: m.id, weekStart });
            let overlapStr = "❌ No overlap";
            if (uAvail && uAvail.dates && mAvail && mAvail.dates) {
              for (const date of uAvail.dates) {
                if (date < today) continue;
                const uSlots = uAvail.availability[date] || [];
                const mSlots = mAvail.availability[date] || [];
                const nowMs = Date.now();
                const overlap = uSlots.find(us => 
                  new Date(us.startTime).getTime() > nowMs && 
                  mSlots.some(ms => ms.startTime === us.startTime && ms.endTime === us.endTime)
                );
                if (overlap) {
                  const timeStr = new Date(overlap.startTime).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
                  let dayStr = date === today ? "Today" : date === tomorrow ? "Tomorrow" : new Date(date).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
                  overlapStr = `✅ ${dayStr} ${timeStr}`;
                  break;
                }
              }
            }
            newOverlaps[m.id] = overlapStr;
          } catch {
            newOverlaps[m.id] = "❌ Unknown";
          }
        }));
        setMentorOverlaps(newOverlaps);
      } catch (e) {
        console.error("Failed to compute overlaps", e);
      }
    })();
  }, [selectedUser, mentors, weekStart]);

  // Mentors with availability overlap (computed from mentorOverlaps state)
  const availableMentors = useMemo(() => {
    return mentors.filter(m => mentorOverlaps[m.id]?.startsWith("✅"));
  }, [mentors, mentorOverlaps]);

  // Mentor Recommendations (Fallback)
  const recommendedMentors = useMemo(() => {
    if (!selectedUser) return [];
    return [...mentors].map(m => {
      const tagOverlap = m.tags.filter(t => selectedUser.tags.includes(t)).length;
      return { ...m, score: tagOverlap };
    }).sort((a, b) => b.score - a.score);
  }, [selectedUser, mentors]);

  // Overlapping Slots Calculation
  const overlappingSlots = useMemo(() => {
    if (!userAvail || !mentorAvail || !userAvail.dates) return [];
    const overlaps = [];
    for (const date of userAvail.dates) {
      const uSlots = userAvail.availability[date] || [];
      const mSlots = mentorAvail.availability[date] || [];
      for (const us of uSlots) {
        for (const ms of mSlots) {
          const usStart = new Date(us.startTime).getTime();
          const usEnd = new Date(us.endTime).getTime();
          const msStart = new Date(ms.startTime).getTime();
          const msEnd = new Date(ms.endTime).getTime();
          const maxStart = Math.max(usStart, msStart);
          const minEnd = Math.min(usEnd, msEnd);
          if (maxStart < minEnd) {
            overlaps.push({ date, startTime: new Date(maxStart).toISOString(), endTime: new Date(minEnd).toISOString() });
          }
        }
      }
    }
    return overlaps.filter(s => new Date(s.startTime).getTime() > Date.now());
  }, [userAvail, mentorAvail]);

  const groupedOverlaps = useMemo(() => {
    const groups = {};
    for (const slot of overlappingSlots) {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    }
    return groups;
  }, [overlappingSlots]);

  const categorizedUserAvail = useMemo(() => {
    if (!userAvail) return { past: {}, future: {} };
    const past = {};
    const future = {};
    const now = Date.now();
    for (const date of userAvail.dates || []) {
      const slots = userAvail.availability[date] || [];
      const pSlots = slots.filter(s => new Date(s.startTime).getTime() <= now);
      const fSlots = slots.filter(s => new Date(s.startTime).getTime() > now);
      if (pSlots.length > 0) past[date] = pSlots;
      if (fSlots.length > 0) future[date] = fSlots;
    }
    return { past, future };
  }, [userAvail]);

  // Handle Booking
  const handleBookMeeting = async () => {
    if (!selectedUser || !selectedMentor || !selectedSlot) {
      alert("Please select a user, mentor, and an overlapping time slot.");
      return;
    }
    setBookingLoading(true);
    try {
      const title = `${selectedUser.requirementType?.replace(/_/g, " ") || "Mentoring Session"} - ${selectedUser.name} & ${selectedMentor.name}`;
      await adminApi.scheduleMeeting({
        title,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        bookedUserId: selectedUser.id,
        bookedMentorId: selectedMentor.id,
        callType: selectedUser.requirementType,
        requestId: selectedUser.activeRequestId,
        what: selectedUser.requirementType,
        description: selectedUser.requirementDesc,
        participantEmails: [selectedUser.email, selectedMentor.email]
      });
      setModalOpen(false);
      setSelectedUser(null);
      setSelectedMentor(null);
      setSelectedSlot(null);
      await loadData();
    } catch (e) {
      alert("Failed to book: " + e.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const getInitials = (name) => name?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) || "U";

  const formatTime = (isoString, tz) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: '2-digit', minute: '2-digit',
      timeZone: tz === "IST" ? "Asia/Kolkata" : "UTC"
    });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Derived stats
  const todaysMeetings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return meetings.filter(m => m.status !== "CANCELLED" && m.startTime?.slice(0, 10) === today && m.bookedMentorId);
  }, [meetings]);
  const completedMeetings = useMemo(() => meetings.filter(m => m.status !== "CANCELLED" && new Date(m.endTime) < new Date() && m.bookedMentorId), [meetings]);
  const cancelledMeetings = useMemo(() => meetings.filter(m => m.status === "CANCELLED" && m.bookedMentorId), [meetings]);

  const filteredMeetingsList = useMemo(() => {
    let list = [];
    if (activeSection === "Todays") list = todaysMeetings;
    else if (activeSection === "Completed") list = completedMeetings;
    else if (activeSection === "Cancelled") list = cancelledMeetings;
    else return [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.user?.name && m.user.name.toLowerCase().includes(q)) ||
      (m.mentor?.name && m.mentor.name.toLowerCase().includes(q))
    );
  }, [activeSection, todaysMeetings, completedMeetings, cancelledMeetings, searchQuery]);

  // Open modal for user
  const openUserModal = (u) => {
    setSelectedUser(u);
    setSelectedMentor(null);
    setSelectedSlot(null);
    setModalView("details");
    setModalOpen(true);
    setAiLoadingState(0);
    setAiRecommendations([]);
    setAiFallbackMentors([]);
  };

  // Switch to schedule view in modal
  const openScheduleView = () => {
    setModalView("schedule");
    triggerAiRecommendations();
  };

  const sectionInfo = {
    Pending: { title: "Pending Queue", desc: "Users waiting for mentor assignment" },
    Todays: { title: "Today's Meetings", desc: "Meetings scheduled for today" },
    Completed: { title: "Completed Meetings", desc: "Successfully completed sessions" },
    Cancelled: { title: "Cancelled Meetings", desc: "Sessions that were cancelled" },
    Mentors: { title: "Mentors Directory", desc: "Registered mentors and their tags" },
    Users: { title: "Users Directory", desc: "All users registered on the platform" },
    Availability: { title: "Team Availability Overview", desc: "Manage availability schedules" },
    Reports: { title: "Analytics & Reports", desc: "Platform usage and meeting analytics" },
    Settings: { title: "Settings", desc: "Configure admin options" },
  };

  const sidebarGroups = [
    {
      group: "REQUESTS",
      items: [
        { id: "Pending", label: "Pending Queue", icon: Users, count: pendingUsers.length },
        { id: "Todays", label: "Today's Meetings", icon: Calendar, count: todaysMeetings.length },
        { id: "Completed", label: "Completed Meetings", icon: CalendarCheck, count: completedMeetings.length },
        { id: "Cancelled", label: "Cancelled Meetings", icon: XCircle, count: cancelledMeetings.length },
      ]
    },
    {
      group: "MANAGEMENT",
      items: [
        { id: "Mentors", label: "Mentors", icon: UserCheck, count: mentors.length },
        { id: "Users", label: "Users", icon: User, count: users.length },
        { id: "Availability", label: "Availability", icon: Clock },
      ]
    },
    {
      group: "SYSTEM",
      items: [
        { id: "Reports", label: "Reports", icon: FileText },
        { id: "Settings", label: "Settings", icon: Settings },
      ]
    }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-white w-full items-stretch">

      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="w-full lg:w-[240px] shrink-0 bg-[#0A0A10] border border-white/[0.06] rounded-2xl flex flex-col p-4 lg:h-[calc(100vh-140px)] sticky top-20">
        {/* Brand / Header */}
        <div className="p-3 mb-3 bg-[#12121B] border border-white/[0.05] rounded-xl flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#1C1C28] border border-white/15 flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white leading-none">Dashboard</h1>
            <p className="text-[9px] text-slate-500 mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-4 overflow-y-auto">
          {sidebarGroups.map((g, gi) => (
            <div key={gi}>
              <div className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.15em] px-2 mb-1.5">{g.group}</div>
              <div className="space-y-1">
                {g.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === "Settings") {
                          window.location.href = "/admin/settings";
                          return;
                        }
                        setActiveSection(item.id);
                        setSearchQuery("");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200 select-none focus:outline-none focus:ring-0 ${isActive
                        ? "bg-[#1C1C28] text-white shadow-sm border border-transparent"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.count !== undefined && item.count > 0 && (
                        <span className={`min-w-[18px] text-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isActive ? "bg-white/20" : "bg-white/5 text-slate-500"
                          }`}>{item.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col min-w-0 space-y-6">

        {/* KPI Cards */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Pending Requests", value: pendingUsers.length, icon: Users, iconBg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-400", sub: `${pendingUsers.filter(u => u.wasCancelled).length} rescheduling` },
              { label: "Today's Meetings", value: todaysMeetings.length, icon: Calendar, iconBg: "bg-sky-500/10 border-sky-500/20", iconColor: "text-sky-400", sub: "active today" },
              { label: "Completed", value: completedMeetings.length, icon: CalendarCheck, iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400", sub: "total sessions" },
              { label: "Cancelled", value: cancelledMeetings.length, icon: XCircle, iconBg: "bg-red-500/10 border-red-500/20", iconColor: "text-red-400", sub: "total cancelled" },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="bg-[#0E0E16] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3.5 hover:border-white/[0.1] transition">
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} border flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${c.iconColor}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold text-white leading-none">{c.value}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{c.label}</div>
                    <div className="text-[9px] text-slate-600 flex items-center gap-1 mt-0.5">
                      <TrendingUp className="w-2.5 h-2.5" /> {c.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-0 justify-between pt-2 pb-1">
          <div>
            <h2 className="text-lg font-bold text-white">{sectionInfo[activeSection].title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{sectionInfo[activeSection].desc}</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full sm:w-[220px] bg-[#12121B] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div>

          {/* ─── PENDING: User Cards Grid ─── */}
          {activeSection === "Pending" && (
            <div>
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {!loading && pendingUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Users className="w-10 h-10 text-slate-700 mb-3" />
                  <p className="text-sm font-medium">No pending requests</p>
                  <p className="text-xs text-slate-600 mt-1">All users have been matched</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {pendingUsers.map(u => (
                  <UserCard
                    key={u.id}
                    person={u}
                    onAction={openUserModal}
                    actionText="View Details"
                    badgeText={u.requirementType?.replace(/_/g, " ")}
                    subBadgeText={u.wasCancelled ? "Rescheduling" : null}
                    footerText={`Requested ${timeAgo(u.createdAt)}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── MEETINGS VIEW (Todays / Completed / Cancelled) ─── */}
          {["Todays", "Completed", "Cancelled"].includes(activeSection) && (
            <div>
              {!loading && filteredMeetingsList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Calendar className="w-10 h-10 text-slate-700 mb-3" />
                  <p className="text-sm font-medium">No meetings found</p>
                  <p className="text-xs text-slate-600 mt-1">Nothing to display in this section</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredMeetingsList.map(m => {
                  const isCancelled = m.status === "CANCELLED";
                  const isCompleted = activeSection === "Completed" || new Date(m.endTime) < new Date();
                  return (
                    <div
                      key={m.id}
                      className={`bg-[#0E0E16] border border-white/[0.08] rounded-2xl overflow-hidden hover:border-white/[0.2] transition-all duration-300 flex flex-col justify-between group shadow-xl ${isCancelled ? "opacity-85" : ""
                        }`}
                    >
                      {/* Top Section */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        {/* Title & Status Badge */}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${isCancelled ? "text-slate-300" : "text-white"}`}>
                            {m.title}
                          </h3>
                          {isCancelled ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">Cancelled</span>
                          ) : isCompleted ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 shrink-0">Completed</span>
                          ) : (
                            <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 shrink-0">Scheduled</span>
                          )}
                        </div>

                        {/* Date & Time */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {new Date(m.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            {new Date(m.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {new Date(m.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        {/* User & Mentor Flow */}
                        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#1D1D2E] border border-white/[0.08] flex items-center justify-center text-[9px] font-bold text-slate-300 shrink-0">
                              {getInitials(m.user?.name || "U")}
                            </div>
                            <span className="text-[11px] text-slate-300 truncate font-medium">{m.user?.name || "User"}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#1D1D2E] border border-white/[0.08] flex items-center justify-center text-[9px] font-bold text-slate-300 shrink-0">
                              {getInitials(m.mentor?.name || "M")}
                            </div>
                            <span className="text-[11px] text-slate-300 truncate font-medium">{m.mentor?.name || "Mentor"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer Bar */}
                      <div className="bg-[#12121C] px-5 py-3 border-t border-white/[0.06] flex items-center justify-between group-hover:bg-white/[0.02] transition-colors">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {m.callType ? m.callType.replace(/_/g, " ") : "Mentoring"}
                        </span>
                        {m.meetLink && !isCancelled ? (
                          <a
                            href={m.meetLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1C28] hover:bg-[#252538] text-white text-[10px] font-bold rounded-xl border border-white/15 hover:border-white/25 transition shadow-sm"
                          >
                            <Video className="w-3 h-3" /> Join Meet
                          </a>
                        ) : m.user ? (
                          <button
                            onClick={() => openUserModal(m.user)}
                            className="px-3 py-1.5 bg-[#1C1C28] hover:bg-[#252538] text-white text-[10px] font-bold rounded-xl transition border border-white/15 hover:border-white/25 flex items-center gap-1"
                          >
                            {isCancelled ? "Reschedule" : "View User"} <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── MENTORS VIEW ─── */}
          {activeSection === "Mentors" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {mentors.map(m => (
                <UserCard
                  key={m.id}
                  person={m}
                  isMentor={true}
                  badgeText="Mentor"
                />
              ))}
            </div>
          )}

          {/* ─── USERS VIEW ─── */}
          {activeSection === "Users" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {users.map(u => (
                <UserCard
                  key={u.id}
                  person={u}
                  onAction={openUserModal}
                  actionText="View Details"
                  badgeText={null}
                />
              ))}
            </div>
          )}

          {/* ─── AVAILABILITY VIEW ─── */}
          {activeSection === "Availability" && (
            <div className="bg-[#0E0E16] border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Team & User Schedules Matrix</h3>
                  <p className="text-xs text-slate-400 mt-0.5">View and manage full weekly calendars across all users and mentors</p>
                </div>
                <a href="/admin/schedules" className="px-4 py-2 bg-[#1C1C28] hover:bg-[#252538] text-white text-xs font-semibold rounded-xl transition border border-white/15 hover:border-white/25 shadow-md flex items-center gap-1.5">
                  Open Team Schedules Matrix →
                </a>
              </div>
            </div>
          )}

          {/* ─── REPORTS VIEW ─── */}
          {activeSection === "Reports" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0E0E16] border border-white/[0.06] rounded-xl p-5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Sessions Booked</div>
                <div className="text-3xl font-extrabold text-white">{meetings.length}</div>
                <div className="text-[10px] text-emerald-400 font-medium mt-1">Across all users</div>
              </div>
              <div className="bg-[#0E0E16] border border-white/[0.06] rounded-xl p-5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Completion Rate</div>
                <div className="text-3xl font-extrabold text-white">
                  {meetings.length > 0 ? Math.round((completedMeetings.length / meetings.length) * 100) : 0}%
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">{completedMeetings.length} completed sessions</div>
              </div>
              <div className="bg-[#0E0E16] border border-white/[0.06] rounded-xl p-5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Active Mentor Network</div>
                <div className="text-3xl font-extrabold text-white">{mentors.length}</div>
                <div className="text-[10px] text-[#C084FC] font-medium mt-1">Ready for matching</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ MODAL OVERLAY ═══════════ */}
      {modalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setModalOpen(false); setSelectedUser(null); setSelectedMentor(null); setSelectedSlot(null); }}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-[720px] mx-4 max-h-[85vh] bg-[#0C0C14] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden">

            {/* ─── DETAILS VIEW ─── */}
            {modalView === "details" && (
              <>
                {/* Modal Header */}
                <div className="shrink-0 p-6 pb-5 border-b border-white/[0.06]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-lg font-bold text-white">
                        {getInitials(selectedUser.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <h2 className="text-lg font-bold text-white">{selectedUser.name}</h2>
                          <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-white/10 text-white border border-white/15 uppercase tracking-wide">
                            {selectedUser.requirementType?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{selectedUser.email}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.tags?.map(t => (
                            <span key={t} className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-[#161622] text-slate-300 border border-white/[0.06]">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setModalOpen(false); setSelectedUser(null); }}
                      className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Description */}
                  {selectedUser.description && (
                    <div className="bg-[#111118] border border-white/[0.05] rounded-xl p-4">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">About</div>
                      <p className="text-xs text-slate-300 leading-relaxed">{selectedUser.description}</p>
                    </div>
                  )}

                  {/* Requirement */}
                  <div className="bg-[#111118] border border-white/[0.05] rounded-xl p-4">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Requirement</div>
                    <div className="text-sm font-semibold text-white mb-1">{selectedUser.requirementType?.replace(/_/g, " ") || "Not specified"}</div>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedUser.requirementDesc || "No specific description provided."}</p>
                  </div>

                  {/* User Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#111118] border border-white/[0.05] rounded-xl p-4">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Timezone</div>
                      <div className="text-xs font-medium text-slate-200">{selectedUser.timezone || "Asia/Kolkata (IST)"}</div>
                    </div>
                    <div className="bg-[#111118] border border-white/[0.05] rounded-xl p-4">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Weekly Slots</div>
                      <div className="text-xs font-medium text-slate-200">{userAvail?.exceptionCount || 0} available</div>
                    </div>
                  </div>

                  {/* Availability Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Availability This Week</div>
                      <div className="flex bg-[#0A0A10] border border-white/10 rounded-lg p-0.5">
                        <button onClick={() => setDisplayTz("IST")} className={`px-2.5 py-1 text-[9px] font-semibold rounded transition ${displayTz === "IST" ? "bg-[#1C1C28] text-white border border-white/10" : "text-slate-400"}`}>IST</button>
                        <button onClick={() => setDisplayTz("UTC")} className={`px-2.5 py-1 text-[9px] font-semibold rounded transition ${displayTz === "UTC" ? "bg-[#1C1C28] text-white border border-white/10" : "text-slate-400"}`}>UTC</button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {/* Current & Future Availability */}
                      <div className="space-y-2">
                        {userAvail?.dates?.filter(d => categorizedUserAvail.future[d]).map(date => {
                          const slots = categorizedUserAvail.future[date];
                          const dateObj = new Date(date);
                          const isToday = date === new Date().toISOString().slice(0, 10);
                          return (
                            <div key={date} className="bg-[#111118] border border-emerald-500/10 rounded-xl p-3.5">
                              <div className="text-[10px] font-bold text-emerald-500/70 mb-2">
                                {isToday ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short' })} · {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {slots.map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A0A10] border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                    <span className="text-[10px] font-semibold text-white">
                                      {formatTime(s.startTime, displayTz)} - {formatTime(s.endTime, displayTz)} {displayTz}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(categorizedUserAvail.future).length === 0 && (
                          <div className="text-center py-4 text-xs text-slate-600 border border-dashed border-white/10 rounded-xl">No upcoming availability this week.</div>
                        )}
                      </div>

                      {/* Past Availability */}
                      {Object.keys(categorizedUserAvail.past).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Past Availability</div>
                          {userAvail?.dates?.filter(d => categorizedUserAvail.past[d]).map(date => {
                            const slots = categorizedUserAvail.past[date];
                            const dateObj = new Date(date);
                            const isToday = date === new Date().toISOString().slice(0, 10);
                            return (
                              <div key={date} className="bg-[#111118]/50 border border-white/[0.02] rounded-xl p-3.5">
                                <div className="text-[10px] font-bold text-slate-500 mb-2">
                                  {isToday ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short' })} · {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {slots.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A0A10] border border-white/[0.05] opacity-60">
                                      <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                                      <span className="text-[10px] font-semibold text-slate-400">
                                        {formatTime(s.startTime, displayTz)} - {formatTime(s.endTime, displayTz)} {displayTz}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* History */}
                  {selectedUser.meetingsAsUser && selectedUser.meetingsAsUser.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-3">Meeting History</div>
                      <div className="space-y-2">
                        {selectedUser.meetingsAsUser.map((m, i) => {
                          const isCancelled = m.status === "CANCELLED";
                          const isPast = new Date(m.endTime) < new Date();
                          const statusLabel = isCancelled ? "Cancelled" : isPast ? "Completed" : "Scheduled";
                          const statusClass = isCancelled ? "bg-red-500/15 text-red-400" : isPast ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400";
                          return (
                            <div key={i} className={`p-3.5 rounded-xl bg-[#111118] border border-white/[0.05] flex items-center justify-between ${isCancelled ? "opacity-60" : ""}`}>
                              <div>
                                <div className={`text-xs font-semibold ${isCancelled ? "text-slate-400 line-through" : "text-white"}`}>Session with {m.mentor?.name || "Mentor"}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{new Date(m.startTime).toLocaleString()}</div>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${statusClass}`}>{statusLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer — Schedule CTA */}
                <div className="shrink-0 p-5 border-t border-white/[0.06] bg-[#0A0A10]">
                  <button
                    onClick={openScheduleView}
                    className="w-full bg-[#1C1C28] hover:bg-[#252538] text-white font-bold py-3 rounded-xl border border-white/15 hover:border-white/25 shadow-md transition flex items-center justify-center gap-2 text-sm"
                  >
                    Schedule Meeting
                  </button>
                </div>
              </>
            )}

            {/* ─── SCHEDULE VIEW ─── */}
            {modalView === "schedule" && (
              <>
                {/* Schedule Header */}
                <div className="shrink-0 p-6 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setModalView("details"); setSelectedMentor(null); setSelectedSlot(null); }} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition">
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </button>
                      <div>
                        <h2 className="text-base font-bold text-white">Schedule Meeting</h2>
                        <p className="text-[11px] text-slate-400">Match {selectedUser.name} with a mentor</p>
                      </div>
                    </div>
                    <button onClick={() => { setModalOpen(false); setSelectedUser(null); setSelectedMentor(null); setSelectedSlot(null); }} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition">
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Schedule Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Step 1: Mentor Selection */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedMentor ? "bg-emerald-500 text-white" : "bg-white/10 text-white border border-white/15"}`}>
                        {selectedMentor ? <Check className="w-3 h-3" /> : "1"}
                      </div>
                      <h3 className="text-sm font-semibold text-white">Select Mentor</h3>
                    </div>

                    {selectedMentor ? (
                      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-300">
                            {getInitials(selectedMentor.name)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-white">{selectedMentor.name}</h4>
                            <p className="text-[10px] text-slate-400">{selectedMentor.tags?.slice(0, 3).join(" · ")}</p>
                          </div>
                        </div>
                        <button onClick={() => { setSelectedMentor(null); setSelectedSlot(null); }} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition text-slate-300">
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">

                        {/* Part A: AI Recommendations */}
                        <div>
                          <h4 className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-2.5">AI Recommended Mentors</h4>
                          {aiLoadingState > 0 ? (
                            <div className="p-5 bg-[#111118] rounded-xl border border-white/[0.05] flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin shrink-0"></div>
                              <div>
                                <div className="text-sm font-medium text-white">AI is finding the best match...</div>
                                <div className="text-[11px] text-slate-400">Analyzing skills & expertise for {selectedUser.name}</div>
                              </div>
                            </div>
                          ) : aiRecommendations.length > 0 ? (
                            <div className="space-y-2.5">
                              {aiRecommendations.map((rec, idx) => {
                                const m = aiFallbackMentors.find(x => x.id === rec.mentorId) || mentors.find(x => x.id === rec.mentorId);
                                if (!m) return null;
                                const hasOverlap = mentorOverlaps[rec.mentorId]?.startsWith("✅");
                                return (
                                  <div key={rec.mentorId} onClick={() => setSelectedMentor(m)} className={`p-4 rounded-xl border cursor-pointer transition relative overflow-hidden ${hasOverlap ? "border-emerald-500/20 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                                    <div className="absolute top-0 right-0 bg-white/10 text-white border border-white/15 text-[9px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
                                      <span>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                                      <span>{rec.score}% Match</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-sm font-bold text-white">
                                        {getInitials(m.name)}
                                      </div>
                                      <div>
                                        <h4 className="font-semibold text-sm text-white">{m.name}</h4>
                                        <p className="text-[10px] text-slate-400">{m.tags?.slice(0, 3).join(" · ")}</p>
                                        {mentorOverlaps[rec.mentorId] ? (
                                          <div className={`text-[10px] font-medium mt-0.5 ${hasOverlap ? "text-emerald-400" : "text-rose-400"}`}>
                                            {mentorOverlaps[rec.mentorId]}
                                          </div>
                                        ) : (
                                          <div className="text-[10px] text-slate-500 mt-0.5">Checking availability...</div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="bg-[#0A0A10]/60 rounded-lg p-3 border border-white/[0.04]">
                                      <div className="text-[9px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Why this mentor?</div>
                                      <ul className="text-[11px] text-slate-300 space-y-1">
                                        {rec.reason.map((r, i) => (
                                          <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-emerald-400 shrink-0">✓</span>
                                            <span className="leading-tight">{r}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-[11px] text-slate-500 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                              No AI recommendations available.
                            </div>
                          )}
                        </div>

                        {/* Part B: Available Mentors (with overlap) */}
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Available Mentors (With Overlap)</h4>
                          {Object.keys(mentorOverlaps).length === 0 ? (
                            <div className="p-4 bg-[#111118] rounded-xl border border-white/[0.05] flex items-center gap-3">
                              <div className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin shrink-0"></div>
                              <span className="text-[11px] text-slate-400">Checking mentor availability...</span>
                            </div>
                          ) : availableMentors.length > 0 ? (
                            <div className="space-y-1.5">
                              {availableMentors.map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => setSelectedMentor(m)}
                                  className="p-3.5 rounded-xl border border-white/[0.05] bg-[#111118] hover:border-emerald-500/20 hover:bg-emerald-500/[0.04] cursor-pointer transition flex items-center justify-between group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-300">
                                      {getInitials(m.name)}
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-xs text-slate-200 group-hover:text-white transition">{m.name}</h4>
                                      <p className="text-[9px] text-slate-500">{m.tags?.slice(0, 2).join(", ")}</p>
                                      <div className="text-[9px] font-medium text-emerald-400">
                                        {mentorOverlaps[m.id]}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-[9px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-white border border-white/15 opacity-0 group-hover:opacity-100 transition">
                                    Select
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-[11px] text-slate-500 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                              No mentors have overlapping availability this week.
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Step 2: Time Slot */}
                  <div className={`transition-opacity ${selectedMentor ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedSlot ? "bg-emerald-500 text-white" : "bg-white/10 text-white border border-white/15"}`}>
                        {selectedSlot ? <Check className="w-3 h-3" /> : "2"}
                      </div>
                      <h3 className="text-sm font-semibold text-white">Select Overlapping Time Slot</h3>
                    </div>

                    {selectedMentor && (
                      <div className="bg-[#111118] rounded-xl border border-white/[0.05] p-4 space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">Common Free Times</h4>
                          <p className="text-[10px] text-slate-500">Intersection of user & mentor availability</p>
                        </div>

                        {Object.keys(groupedOverlaps).length > 0 ? (
                          <div className="space-y-3">
                            {Object.entries(groupedOverlaps).map(([date, slots]) => {
                              const dateObj = new Date(date);
                              const isToday = date === new Date().toISOString().slice(0, 10);
                              return (
                                <div key={date}>
                                  <div className="text-[10px] font-semibold text-slate-300 mb-1.5 border-b border-white/[0.04] pb-1">
                                    {isToday ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short' })}, {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </div>
                                  <div className="space-y-1.5">
                                    {slots.map((s, i) => {
                                      const isSelected = selectedSlot?.startTime === s.startTime;
                                      return (
                                        <label key={i} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${isSelected ? "bg-white/[0.08] border-white/30" : "bg-[#0A0A10] border-white/[0.05] hover:border-white/[0.15]"}`}>
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-1 h-7 rounded-full bg-white"></div>
                                            <div>
                                              <div className="text-[11px] font-semibold text-white">
                                                {formatTime(s.startTime, displayTz)} - {formatTime(s.endTime, displayTz)} {displayTz}
                                              </div>
                                              <div className="text-[9px] text-slate-500">
                                                {formatTime(s.startTime, displayTz === "IST" ? "UTC" : "IST")} - {formatTime(s.endTime, displayTz === "IST" ? "UTC" : "IST")} {displayTz === "IST" ? "GMT" : "IST"}
                                              </div>
                                            </div>
                                          </div>
                                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-white bg-white text-black" : "border-slate-600"}`}>
                                            {isSelected && <Check className="w-2.5 h-2.5 text-black" />}
                                          </div>
                                          <input type="radio" name="slot" className="sr-only" onChange={() => setSelectedSlot(s)} checked={isSelected} />
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-slate-500">
                            {mentorAvail ? "No overlapping slots found." : "Loading mentor availability..."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Footer — Book */}
                <div className="shrink-0 p-5 border-t border-white/[0.06] bg-[#0A0A10]">
                  <button
                    onClick={handleBookMeeting}
                    disabled={bookingLoading || !selectedSlot || !selectedMentor}
                    className="w-full bg-[#1C1C28] hover:bg-[#252538] text-white font-bold py-3 rounded-xl border border-white/15 hover:border-white/25 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    {bookingLoading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Booking...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Confirm & Book Meeting</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
