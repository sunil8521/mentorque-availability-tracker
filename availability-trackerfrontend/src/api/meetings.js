import { get, del } from "./client.js";

export async function listMeetings(params = {}) {
  const q = new URLSearchParams(params).toString();
  return get(`/api/meetings${q ? `?${q}` : ""}`);
}

export async function deleteMeeting(meetingId) {
  return del(`/api/meetings/${meetingId}`);
}
