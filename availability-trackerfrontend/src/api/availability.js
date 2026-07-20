import { get, post } from "./client.js";

export async function getWeekly(params = {}) {
  const q = new URLSearchParams(params).toString();
  return get(`/api/availability/weekly${q ? `?${q}` : ""}`);
}

export async function saveBatch(body) {
  return post("/api/availability/batch", body);
}
