import { get, post, patch } from "./client.js";

export async function createRequest(data) {
  return post("/api/requests", data);
}

export async function getMyRequests() {
  return get("/api/requests/me");
}

export async function cancelRequest(requestId) {
  return patch(`/api/requests/${requestId}/cancel`);
}
