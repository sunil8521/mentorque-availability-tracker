import { useState, useEffect, useMemo } from "react";
import * as adminApi from "../api/admin";
import AvailabilityDashboard from "../components/AvailabilityDashboard";
import MqSelect from "../components/MqSelect";

function personLabel(person) {
  const email = person.email?.trim() || "";
  const name = person.name?.trim() || "";
  if (!name || name.includes("@") || name.toLowerCase() === email.toLowerCase()) {
    return email || name || "Unknown";
  }
  return name;
}

export default function AdminSchedules() {
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedMentorId, setSelectedMentorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [u, m] = await Promise.all([adminApi.listUsers(), adminApi.listMentors()]);
        if (!cancelled) {
          setUsers(u);
          setMentors(m);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load people");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const viewAs = useMemo(() => {
    if (selectedUserId) {
      const person = users.find((u) => u.id === selectedUserId);
      if (!person) return null;
      return {
        userId: person.id,
        name: person.name,
        email: person.email,
        timezone: person.timezone,
        role: "USER",
      };
    }
    if (selectedMentorId) {
      const person = mentors.find((m) => m.id === selectedMentorId);
      if (!person) return null;
      return {
        mentorId: person.id,
        name: person.name,
        email: person.email,
        timezone: person.timezone,
        role: "MENTOR",
      };
    }
    return null;
  }, [selectedUserId, selectedMentorId, users, mentors]);

  const onUserChange = (id) => {
    setSelectedUserId(id);
    if (id) setSelectedMentorId("");
  };

  const onMentorChange = (id) => {
    setSelectedMentorId(id);
    if (id) setSelectedUserId("");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-50">Team availability</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            View and edit weekly schedules for any user or mentor.
          </p>
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:shrink-0">
          <MqSelect
            id="team-user"
            label="User"
            value={selectedUserId}
            onChange={onUserChange}
            disabled={loading}
            placeholder="Select user…"
            options={users.map((u) => ({
              value: u.id,
              label: personLabel(u),
              title: u.email,
            }))}
          />
          <MqSelect
            id="team-mentor"
            label="Mentor"
            value={selectedMentorId}
            onChange={onMentorChange}
            disabled={loading}
            placeholder="Select mentor…"
            options={mentors.map((m) => ({
              value: m.id,
              label: personLabel(m),
              title: m.email,
            }))}
            menuAlign="right"
          />
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mq-card p-16 text-center text-sm text-ink-500">Loading…</div>
      ) : !viewAs ? (
        <div className="mq-card p-16 text-center text-sm text-ink-500">
          Select a user or mentor to view and edit their availability calendar.
        </div>
      ) : (
        <AvailabilityDashboard role={viewAs.role} viewAs={viewAs} embedded />
      )}
    </div>
  );
}
