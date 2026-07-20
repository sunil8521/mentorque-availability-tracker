import { useState, useEffect, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { useAuth } from "../context/AuthContext";
import * as adminApi from "../api/admin";
import * as availabilityApi from "../api/availability";
import {
  Search, ChevronLeft, ChevronRight, Calendar, User, Clock,
  CheckCircle2, Check, ArrowRight, FileText, History, Info, Sparkles
} from "lucide-react";

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
  const [selectedSlot, setSelectedSlot] = useState(null); // { startTime, endTime }

  // Availability State
  const [userAvail, setUserAvail] = useState(null);
  const [mentorAvail, setMentorAvail] = useState(null);

  // AI Recommendation State
  const [aiLoadingState, setAiLoadingState] = useState(0); // 0=done, 1-5=loading steps
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [aiFallbackMentors, setAiFallbackMentors] = useState([]);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [leftTab, setLeftTab] = useState("Pending"); // "Pending" | "Scheduled"
  const [activeTab, setActiveTab] = useState("Availability"); // "User Details" | "Availability" | "Requirements" | "History"
  const [displayTz, setDisplayTz] = useState("IST");
  const [availTab, setAvailTab] = useState("Upcoming"); // "Upcoming" | "All"
  const [bookingLoading, setBookingLoading] = useState(false);

  // Initialization
  const weekStart = useMemo(() => {
    const today = new Date();
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    return base.toISOString().slice(0, 10);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived: Pending Users
  const pendingUsers = useMemo(() => {
    return users.filter(u => {
      if (!u.requirementType) return false;
      if (u.meetingsAsUser && u.meetingsAsUser.length > 0) return false;
      return true;
    }).filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()));
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

  // AI Recommendations logic
  useEffect(() => {
    if (selectedUser) {
      let step = 1;
      setAiLoadingState(step);
      setAiRecommendations([]);
      setAiFallbackMentors([]);

      const interval = setInterval(() => {
        step++;
        if (step <= 5) {
          setAiLoadingState(step);
        }
      }, 700);

      adminApi.recommendMentors(selectedUser.id).then(async (res) => {
        clearInterval(interval);
        setAiLoadingState(0);
        
        const recs = res.recommendations || [];
        try {
          const uAvail = await availabilityApi.getWeekly({ userId: selectedUser.id, weekStart });
          
          // Calculate top 5 fallback mentors to fetch their overlaps as well
          const fallbackTop5 = [...mentors].map(m => ({
            ...m,
            score: m.tags.filter(t => selectedUser.tags.includes(t)).length
          })).sort((a, b) => b.score - a.score).slice(0, 5);
          
          const mentorIdsToFetch = new Set([
            ...recs.map(r => r.mentorId),
            ...fallbackTop5.map(m => m.id)
          ]);
          
          const newOverlaps = {};
          const today = new Date().toISOString().slice(0, 10);
          const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
          
          await Promise.all(Array.from(mentorIdsToFetch).map(async (mId) => {
            try {
              const mAvail = await availabilityApi.getWeekly({ mentorId: mId, weekStart });
              let overlapStr = "❌ No overlap";
              
              if (uAvail && uAvail.dates && mAvail && mAvail.dates) {
                for (const date of uAvail.dates) {
                  if (date < today) continue;
                  const uSlots = uAvail.availability[date] || [];
                  const mSlots = mAvail.availability[date] || [];
                  const overlap = uSlots.find(us => mSlots.some(ms => ms.startTime === us.startTime && ms.endTime === us.endTime));
                  
                  if (overlap) {
                    const timeStr = new Date(overlap.startTime).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
                    let dayStr = date === today ? "Today" : date === tomorrow ? "Tomorrow" : new Date(date).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
                    overlapStr = `✅ ${dayStr} ${timeStr}`;
                    break;
                  }
                }
              }
              newOverlaps[mId] = overlapStr;
            } catch (err) {
              newOverlaps[mId] = "❌ Unknown";
            }
          }));
          
          setMentorOverlaps(newOverlaps);
        } catch (e) {
          console.error("Failed to compute overlaps", e);
        }
        
        setAiRecommendations(recs);
        setAiFallbackMentors(res.allMentors || []);
      }).catch(e => {
        console.error(e);
        clearInterval(interval);
        setAiLoadingState(0);
        setAiFallbackMentors(mentors);
      });

    } else {
      setAiLoadingState(0);
      setAiRecommendations([]);
      setAiFallbackMentors([]);
      setMentorOverlaps({});
    }
  }, [selectedUser, mentors]);

  // Mentor Recommendations (Fallback)
  // simple: fallback mentor computation
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
            overlaps.push({
              date,
              startTime: new Date(maxStart).toISOString(),
              endTime: new Date(minEnd).toISOString(),
            });
          }
        }
      }
    }
    const now = Date.now();
    return overlaps.filter(s => new Date(s.startTime).getTime() > now);
  }, [userAvail, mentorAvail]);

  // Group overlaps by date
  const groupedOverlaps = useMemo(() => {
    const groups = {};
    for (const slot of overlappingSlots) {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    }
    return groups;
  }, [overlappingSlots]);

  // Handle Booking
  // simple: scheduling logic handling
  const handleSchedule = async (mentorId) => {
    if (!selectedUser || !mentorId || !scheduleDate || !scheduleTime) {
      alert("Please select a user, mentor, date, and time.");
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
        what: selectedUser.requirementType,
        description: selectedUser.requirementDesc,
        participantEmails: [selectedUser.email, selectedMentor.email]
      });
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

  // simple: handle tab switching safely
  const handleTabChange = (tab) => {
    if (tab === "meetings" && scheduledMeetings.length === 0) {
      // simple fetch wrapper
      fetchMeetings();
    }
    setActiveTab(tab);
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full h-[calc(100vh-140px)] min-h-[680px] bg-[#08080C] text-white font-sans rounded-2xl border border-white/[0.08] flex overflow-hidden shadow-2xl">
        {/* simple: main layout flexbox */}
        <div className="flex-1 flex overflow-hidden">
          {/* simple: left sidebar */}
          <div className="w-[330px] shrink-0 border-r border-white/[0.08] flex flex-col bg-[#0A0A10]">
        <div className="p-5 border-b border-white/[0.08]">
          <h1 className="text-lg font-bold mb-0.5 text-white">Pending Scheduling</h1>
          <p className="text-xs text-slate-400 mb-4">Users awaiting mentor assignment</p>

          <div className="flex gap-2.5 mb-4">
            <div 
              onClick={() => setLeftTab("Pending")}
              className={`rounded-xl p-3 flex-1 cursor-pointer transition ${leftTab === "Pending" ? "bg-[#A855F7]/10 border border-[#A855F7]/30" : "bg-[#12121C] border border-white/5 hover:border-white/10"}`}
            >
              <div className={`text-2xl font-bold ${leftTab === "Pending" ? "text-[#C084FC]" : "text-slate-300"}`}>{pendingUsers.length}</div>
              <div className={`text-[10px] font-medium ${leftTab === "Pending" ? "text-[#D8B4FE]" : "text-slate-400"}`}>Pending Queue</div>
            </div>
            <div 
              onClick={() => setLeftTab("Scheduled")}
              className={`rounded-xl p-3 flex-1 cursor-pointer transition ${leftTab === "Scheduled" ? "bg-[#A855F7]/10 border border-[#A855F7]/30" : "bg-[#12121C] border border-white/5 hover:border-white/10"}`}
            >
              <div className={`text-2xl font-bold ${leftTab === "Scheduled" ? "text-[#C084FC]" : "text-slate-300"}`}>{meetings.length}</div>
              <div className={`text-[10px] font-medium ${leftTab === "Scheduled" ? "text-[#D8B4FE]" : "text-slate-400"}`}>Scheduled</div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search user..."
              className="w-full bg-[#12121B] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#A855F7] transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {leftTab === "Pending" && pendingUsers.map(u => (
            <div 
              key={u.id}
              onClick={() => { setSelectedUser(u); setSelectedMentor(null); setActiveTab("Availability"); }}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                selectedUser?.id === u.id 
                  ? 'bg-[#A855F7]/10 border-[#A855F7] shadow-sm shadow-[#A855F7]/10' 
                  : 'bg-[#12121B]/60 border-white/5 hover:border-white/20 hover:bg-[#12121B]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${selectedUser?.id === u.id ? 'bg-[#A855F7] text-white' : 'bg-[#1D1D2C] text-slate-300'}`}>
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-xs text-white truncate">{u.name}</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#A855F7]/20 text-[#D8B4FE] font-medium whitespace-nowrap">
                      {u.requirementType?.replace(/_/g, " ") || "Mentoring"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                    <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                  </div>
                  {u.tags && u.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.tags.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[#161622] text-slate-400 border border-white/5">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {u.description && (
                    <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-2 leading-tight">
                      {u.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            </div>
          ))}
          {leftTab === "Pending" && pendingUsers.length === 0 && !loading && (
            <div className="text-center p-6 text-xs text-slate-500">No pending users found.</div>
          )}

          {leftTab === "Scheduled" && meetings.map(m => (
            <div 
              key={m.id}
              className="p-3 rounded-xl bg-[#12121B]/60 border border-white/5 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-xs text-white line-clamp-1">{m.title}</h3>
                  <p className="text-[10px] text-[#A855F7] font-medium mt-1">
                    {new Date(m.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 font-medium whitespace-nowrap border border-emerald-800/40">
                  Scheduled
                </span>
              </div>
              <div className="space-y-1.5 mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#1A1A2B] border border-white/10 flex items-center justify-center text-[8px] font-bold text-slate-300">
                    {getInitials(m.user?.name || "U")}
                  </div>
                  <span className="text-[11px] text-slate-300 truncate">{m.user?.name || "User"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/30 flex items-center justify-center text-[8px] font-bold text-[#D8B4FE]">
                    {getInitials(m.mentor?.name || "M")}
                  </div>
                  <span className="text-[11px] text-slate-300 truncate">{m.mentor?.name || "Mentor"}</span>
                </div>
              </div>
              {m.meetLink && (
                <div className="mt-3">
                  <a href={m.meetLink} target="_blank" rel="noreferrer" className="block text-center w-full bg-[#A855F7]/10 hover:bg-[#A855F7]/20 text-[#D8B4FE] border border-[#A855F7]/30 text-[10px] font-medium py-1.5 rounded-lg transition">
                    Join Meet
                  </a>
                </div>
              )}
            </div>
          ))}
          {leftTab === "Scheduled" && meetings.length === 0 && !loading && (
            <div className="text-center p-6 text-xs text-slate-500">No scheduled meetings.</div>
          )}
        </div>
      </div>

      {/* MIDDLE PANEL: User Detail & Availability (~42%) */}
      <div className="flex-1 border-r border-white/[0.08] flex flex-col bg-[#08080C]">
        {selectedUser ? (
          <>
            {/* Header info */}
            <div className="p-6 border-b border-white/[0.08]">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition mb-4"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to List
              </button>

              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#1A1A2B] border border-white/10 flex items-center justify-center text-xl font-bold text-[#C084FC]">
                    {getInitials(selectedUser.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-white">{selectedUser.name}</h2>
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#A855F7]/20 text-[#D8B4FE] border border-[#A855F7]/30">
                        {selectedUser.requirementType?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{selectedUser.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUser.tags?.map(t => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-md bg-[#161622] text-slate-300 border border-white/5">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 mb-1">Weekly Slots</div>
                  <div className="bg-[#141420] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white">
                    {userAvail?.exceptionCount || 0} slots
                  </div>
                </div>
              </div>
            </div>

            {/* Workable Tabs Header */}
            <div className="border-b border-white/[0.08] flex px-6 pt-2 bg-[#0A0A10]">
              {["User Details", "Availability", "Requirements", "History"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-4 text-xs font-semibold border-b-2 transition ${activeTab === tab
                      ? "border-[#A855F7] text-[#C084FC]"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Workable Tab Body */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* TAB 1: User Details */}
              {activeTab === "User Details" && (
                <div className="space-y-6">
                  <div className="bg-[#12121C] border border-white/5 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-[#C084FC]" /> User Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-1">Full Name</span>
                        <span className="text-slate-200 font-medium">{selectedUser.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Email Address</span>
                        <span className="text-slate-200 font-medium">{selectedUser.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Timezone</span>
                        <span className="text-slate-200 font-medium">{selectedUser.timezone || "Asia/Kolkata (IST)"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Role</span>
                        <span className="text-[#D8B4FE] font-medium">Mentee (USER)</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-white/5 mt-1">
                        <span className="text-slate-500 block mb-2">Skills & Tags</span>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {selectedUser.tags && selectedUser.tags.length > 0 ? (
                            selectedUser.tags.map(t => (
                              <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#A855F7]/10 text-[#D8B4FE] border border-[#A855F7]/20">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600 italic">No tags available.</span>
                          )}
                        </div>
                        
                        <span className="text-slate-500 block mb-2">Profile Bio / Description</span>
                        <p className="text-xs text-slate-300 leading-relaxed bg-[#0A0A10] p-3 rounded-lg border border-white/5">
                          {selectedUser.description || "No bio description added to profile."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Availability */}
              {activeTab === "Availability" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    {/* Pill Toggle matching image 2 */}
                    <div className="flex bg-[#141420] border border-white/5 rounded-xl p-1">
                      <button
                        onClick={() => setAvailTab("Upcoming")}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${availTab === "Upcoming"
                            ? "bg-[#A855F7] text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                          }`}
                      >
                        Upcoming Availability
                      </button>
                      <button
                        onClick={() => setAvailTab("All")}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${availTab === "All"
                            ? "bg-[#A855F7] text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                          }`}
                      >
                        All Availability
                      </button>
                    </div>

                    {/* Timezone Toggle matching image 2 */}
                    <div className="flex bg-[#141420] border border-white/5 rounded-xl p-1">
                      <button
                        onClick={() => setDisplayTz("IST")}
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition ${displayTz === "IST"
                            ? "bg-[#252538] text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                          }`}
                      >
                        IST (GMT+5:30)
                      </button>
                      <button
                        onClick={() => setDisplayTz("UTC")}
                        className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition ${displayTz === "UTC"
                            ? "bg-[#252538] text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                          }`}
                      >
                        GMT (GMT+0)
                      </button>
                    </div>
                  </div>

                  {/* Slots List */}
                  <div className="space-y-5">
                    {userAvail?.dates?.map(date => {
                      const slots = userAvail.availability[date] || [];
                      if (slots.length === 0) return null;
                      const dateObj = new Date(date);
                      const isToday = date === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={date}>
                          <h3 className="text-xs font-semibold text-slate-400 mb-2.5 flex items-center gap-2">
                            {isToday ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short' })} &middot; {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </h3>
                          <div className="space-y-2">
                            {slots.map((s, i) => (
                              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-[#12121C] border border-white/5 hover:border-white/10 transition">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                  <div>
                                    <div className="text-xs font-bold text-white">
                                      {formatTime(s.startTime, displayTz)} - {formatTime(s.endTime, displayTz)} {displayTz}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {formatTime(s.startTime, displayTz === "IST" ? "UTC" : "IST")} - {formatTime(s.endTime, displayTz === "IST" ? "UTC" : "IST")} {displayTz === "IST" ? "GMT" : "IST"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#1C1C2C] text-slate-300">1h</span>
                                  <ChevronRight className="w-4 h-4 text-slate-600" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {(!userAvail || userAvail.dates?.every(d => !userAvail.availability[d]?.length)) && (
                      <div className="text-center py-10 text-xs text-slate-500">No availability set for this week.</div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Requirements */}
              {activeTab === "Requirements" && (
                <div className="space-y-6">
                  <div className="bg-[#12121C] border border-white/5 rounded-xl p-5 space-y-3">
                    <span className="text-[10px] font-bold text-[#C084FC] uppercase tracking-wider">Step 1 - Call Type</span>
                    <h3 className="text-sm font-semibold text-white">What do you need help with?</h3>
                    <div className="p-3 bg-[#0A0A10] rounded-lg border border-[#A855F7]/30 text-xs text-[#D8B4FE] font-medium flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A855F7]"></div>
                      {selectedUser.requirementType?.replace(/_/g, " ") || "Not selected"}
                    </div>
                  </div>

                  <div className="bg-[#12121C] border border-white/5 rounded-xl p-5 space-y-3">
                    <span className="text-[10px] font-bold text-[#C084FC] uppercase tracking-wider">Step 2 - Goal Description</span>
                    <h3 className="text-sm font-semibold text-white">Requirement Description</h3>
                    <div className="p-3 bg-[#0A0A10] rounded-lg border border-white/5 text-xs text-slate-300 leading-relaxed min-h-[80px]">
                      {selectedUser.requirementDesc || "No specific goal description entered."}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: History */}
              {activeTab === "History" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">Past & Scheduled Meetings</h3>
                  {selectedUser.meetingsAsUser && selectedUser.meetingsAsUser.length > 0 ? (
                    selectedUser.meetingsAsUser.map((m, i) => (
                      <div key={i} className="p-4 rounded-xl bg-[#12121C] border border-white/5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-xs font-semibold text-white mb-1">Session with {m.mentor?.name || "Mentor"}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(m.startTime).toLocaleString()}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                            {m.status || "Scheduled"}
                          </span>
                        </div>
                        {m.meetLink && (
                          <div className="pt-3 border-t border-white/5 mt-1">
                            <a href={m.meetLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 text-[#D8B4FE] text-[10px] font-medium rounded-lg border border-[#A855F7]/30 transition">
                              Join Google Meet <ArrowRight className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-xs text-slate-500 flex flex-col items-center gap-2">
                      <History className="w-8 h-8 text-slate-700" />
                      <p>No meeting history found for this user.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-3">
            <User className="w-10 h-10 text-slate-700" />
            <p className="text-xs">Select a user to view their details and availability</p>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Schedule Meeting (~33%) */}
      <div className="w-[390px] shrink-0 bg-[#0A0A10] flex flex-col">
        {selectedUser ? (
          <div className="p-6 flex-1 flex flex-col h-full overflow-hidden">
            <div className="mb-5">
              <h2 className="text-base font-bold text-white">Schedule Meeting</h2>
              <p className="text-xs text-slate-400">Match {selectedUser.name} with a mentor</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">

              {/* Step 1: Select Mentor */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedMentor ? "bg-emerald-500 text-white" : "bg-[#1C1C2C] text-[#C084FC]"}`}>
                    {selectedMentor ? <Check className="w-3 h-3" /> : "1"}
                  </div>
                  <h3 className="text-xs font-semibold text-white">Select Mentor</h3>
                </div>

                {selectedMentor ? (
                  <div className="p-3.5 rounded-xl border border-[#A855F7]/30 bg-[#A855F7]/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1A1A2B] flex items-center justify-center text-xs font-bold text-[#C084FC]">
                        {getInitials(selectedMentor.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-xs text-white">{selectedMentor.name}</h4>
                          <span className="text-[10px] text-amber-400 font-semibold">★ 4.8</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{selectedMentor.tags?.slice(0, 2).join(" · ")}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedMentor(null); setSelectedSlot(null); }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition"
                    >
                      Change
                    </button>
                  </div>
                ) : aiLoadingState > 0 ? (
                  <div className="p-4 bg-[#12121C] rounded-xl border border-white/5 space-y-3">
                    <div className="text-xs font-semibold text-[#D8B4FE] flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-[#A855F7] animate-pulse" /> AI evaluating mentor profiles...
                    </div>
                    <div className="space-y-2 text-[11px] text-slate-400 font-medium">
                      <div className={aiLoadingState >= 1 ? "text-slate-200" : "opacity-30"}>{aiLoadingState >= 1 ? "✓" : "○"} Reading user requirements...</div>
                      <div className={aiLoadingState >= 2 ? "text-slate-200" : "opacity-30"}>{aiLoadingState >= 2 ? "✓" : "○"} Comparing mentor expertise...</div>
                      <div className={aiLoadingState >= 3 ? "text-slate-200" : "opacity-30"}>{aiLoadingState >= 3 ? "✓" : "○"} Matching skills and experience...</div>
                      <div className={aiLoadingState >= 4 ? "text-slate-200" : "opacity-30"}>{aiLoadingState >= 4 ? "✓" : "○"} Checking domain fit...</div>
                      <div className={aiLoadingState >= 5 ? "text-slate-200" : "opacity-30"}>{aiLoadingState >= 5 ? "✓" : "○"} Ranking best mentors...</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {aiRecommendations.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-bold text-[#C084FC] uppercase tracking-wider mb-2.5">AI Recommended Mentors</h4>
                        <div className="space-y-2.5">
                          {aiRecommendations.map((rec, idx) => {
                            const m = aiFallbackMentors.find(x => x.id === rec.mentorId) || mentors.find(x => x.id === rec.mentorId);
                            if (!m) return null;
                            return (
                              <div key={rec.mentorId} onClick={() => setSelectedMentor(m)} className="p-3.5 rounded-xl border border-[#A855F7]/30 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 cursor-pointer transition group relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-[#A855F7] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"} {rec.score}% Match
                                </div>
                                <div className="flex items-center gap-3 mb-2.5">
                                  <div className="w-9 h-9 rounded-full bg-[#1A1A2B] flex items-center justify-center text-xs font-bold text-[#C084FC]">
                                    {getInitials(m.name)}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-xs text-white">{m.name}</h4>
                                    <p className="text-[10px] text-slate-400 mb-0.5">{m.tags?.slice(0, 3).join(" · ")}</p>
                                    {mentorOverlaps[rec.mentorId] && (
                                      <div className={`text-[10px] font-medium ${mentorOverlaps[rec.mentorId].includes("✅") ? "text-emerald-400" : "text-rose-400"}`}>
                                        Availability: {mentorOverlaps[rec.mentorId]}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-[#0A0A10]/60 rounded-lg p-2.5 border border-white/5">
                                  <div className="text-[9px] text-[#C084FC] mb-1 font-bold uppercase">Why?</div>
                                  <ul className="text-[11px] text-slate-300 space-y-0.5">
                                    {rec.reason.map((r, i) => (
                                      <li key={i} className="flex items-start gap-1">
                                        <span className="text-emerald-400">✓</span> <span className="leading-tight">{r}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                        {aiRecommendations.length > 0 ? "All Available Mentors" : "Closest Available Mentors"}
                      </h4>
                      <div className="space-y-2">
                        {recommendedMentors.slice(0, 5).map(m => (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMentor(m)}
                            className="p-3 rounded-xl border border-white/5 bg-[#12121C] hover:border-[#A855F7]/50 hover:bg-[#A855F7]/10 cursor-pointer transition flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#1D1D2C] flex items-center justify-center text-xs font-bold text-slate-300">
                                {getInitials(m.name)}
                              </div>
                              <div>
                                <h4 className="font-medium text-xs text-slate-200 group-hover:text-white">{m.name}</h4>
                                <p className="text-[10px] text-slate-500">{m.tags?.slice(0, 2).join(", ")}</p>
                                {mentorOverlaps[m.id] && (
                                  <div className={`text-[9px] font-medium mt-0.5 ${mentorOverlaps[m.id].includes("✅") ? "text-emerald-400" : "text-rose-400"}`}>
                                    Availability: {mentorOverlaps[m.id]}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-[10px] font-semibold px-2 py-1 rounded bg-[#A855F7]/20 text-[#D8B4FE] opacity-0 group-hover:opacity-100 transition">
                              Select
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Select Time Slot */}
              <div className={`transition-opacity ${selectedMentor ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-full bg-[#1C1C2C] text-[#C084FC] flex items-center justify-center text-[10px] font-bold">2</div>
                  <h3 className="text-xs font-semibold text-white">Select Overlapping Time Slot</h3>
                </div>

                {selectedMentor && (
                  <div className="bg-[#12121C] rounded-xl border border-white/5 p-3.5 space-y-3">
                    <div className="mb-2">
                      <h4 className="text-xs font-semibold text-slate-200">Common Free Times</h4>
                      <p className="text-[10px] text-slate-400">Intersection of user & mentor availability</p>
                    </div>

                    {Object.keys(groupedOverlaps).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(groupedOverlaps).map(([date, slots]) => {
                          const dateObj = new Date(date);
                          const isToday = date === new Date().toISOString().slice(0, 10);
                          return (
                            <div key={date}>
                              <div className="text-[11px] font-semibold text-slate-300 mb-1.5 border-b border-white/5 pb-1">
                                {isToday ? "Today" : dateObj.toLocaleDateString('en-US', { weekday: 'short' })}, {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                              <div className="space-y-1.5">
                                {slots.map((s, i) => {
                                  const isSelected = selectedSlot?.startTime === s.startTime;
                                  return (
                                    <label
                                      key={i}
                                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${isSelected
                                          ? "bg-[#A855F7]/20 border-[#A855F7]"
                                          : "bg-[#0A0A10] border-white/5 hover:border-white/20"
                                        }`}
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-1 h-8 rounded-full bg-[#A855F7]"></div>
                                        <div>
                                          <div className="text-xs font-semibold text-white">
                                            {formatTime(s.startTime, displayTz)} - {formatTime(s.endTime, displayTz)} {displayTz}
                                          </div>
                                          <div className="text-[10px] text-slate-400">
                                            {formatTime(s.startTime, displayTz === "IST" ? "UTC" : "IST")} - {formatTime(s.endTime, displayTz === "IST" ? "UTC" : "IST")} {displayTz === "IST" ? "GMT" : "IST"}
                                          </div>
                                        </div>
                                      </div>
                                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-[#A855F7] bg-[#A855F7]" : "border-slate-600"}`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                      <input
                                        type="radio"
                                        name="slot"
                                        className="sr-only"
                                        onChange={() => setSelectedSlot(s)}
                                        checked={isSelected}
                                      />
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

            {/* Step 3: Confirm */}
            <div className={`mt-3 pt-3 border-t border-white/[0.08] transition-opacity ${selectedSlot ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
              <button
                onClick={handleBookMeeting}
                disabled={bookingLoading || !selectedSlot}
                className="w-full bg-[#A855F7] hover:bg-[#9333EA] text-white font-semibold py-3 rounded-xl shadow-lg shadow-[#A855F7]/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs"
              >
                {bookingLoading ? "Booking..." : "Confirm & Book Meeting"} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500 text-xs">
            <p>Select a user to begin scheduling.</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
