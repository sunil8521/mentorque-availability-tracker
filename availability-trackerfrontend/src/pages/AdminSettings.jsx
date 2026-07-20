import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import * as authApi from "../api/auth";

export default function AdminSettings() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    const err = params.get("error");
    if (google === "connected") {
      setStatus("Google Calendar connected successfully.");
      refreshUser();
      window.history.replaceState({}, "", "/admin/settings");
    } else if (err) {
      setStatus(`Error: ${err}`);
      window.history.replaceState({}, "", "/admin/settings");
    }
  }, [refreshUser]);

  const handleConnectGoogle = async () => {
    setLoading(true);
    setStatus("");
    try {
      const url = await authApi.getGoogleAuthUrl();
      if (!url || typeof url !== "string") {
        setStatus("Invalid response from server");
        setLoading(false);
        return;
      }
      window.location.href = url;
    } catch (e) {
      const msg = e?.status === 401 ? "Please stay logged in as admin and try again." : (e?.message || "Failed to get Google auth URL");
      setStatus(msg);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setStatus("");
    try {
      await authApi.disconnectGoogle();
      setStatus("Google disconnected.");
      refreshUser();
    } catch (e) {
      setStatus(e.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold text-white">Admin Settings</h1>

      <div className="bg-navy-900 border border-navy-700 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-2">Google Calendar</h2>
        <p className="text-slate-400 text-sm mb-4">
          Connect your Google account to create calendar events and generate Meet links when scheduling meetings.
        </p>
        {status && (
          <p className="text-slate-300 text-sm mb-4 p-2 rounded bg-navy-800">{status}</p>
        )}
        {user?.hasGoogleConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-navy-700 text-slate-300 hover:bg-navy-600 disabled:opacity-50"
          >
            Disconnect Google
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnectGoogle}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-navy-950 font-medium disabled:opacity-50"
          >
            Connect Google Calendar
          </button>
        )}
      </div>
    </div>
  );
}
