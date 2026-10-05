const API_BASE = "/api";

async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = localStorage.getItem("lq_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) {
      const role = localStorage.getItem("lq_role");
      clearSession();
      const destination = role === "child" ? "child-login.html" : "parent.html";
      const err = new Error(data.error || "Your session expired. Please sign in again.");
      err.code = data.code || "SESSION_INVALID";
      setTimeout(() => { window.location.href = destination; }, 900);
      throw err;
    }
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.code = data.code || null;
    throw err;
  }
  return data;
}

const api = {
  parentSignup: (payload) => apiRequest("/auth/parent/signup", { method: "POST", body: payload, auth: false }),
  parentLogin: (payload) => apiRequest("/auth/parent/login", { method: "POST", body: payload, auth: false }),
  childCreate: (payload) => apiRequest("/auth/child/create", { method: "POST", body: payload }),
  childList: () => apiRequest("/auth/child/list"),
  childLogin: (payload) => apiRequest("/auth/child/login", { method: "POST", body: payload, auth: false }),

  childMe: () => apiRequest("/child/me"),
  childUpdate: (payload) => apiRequest("/child/me", { method: "PUT", body: payload }),

  questions: (subject, count = 3) => apiRequest(`/questions?subject=${encodeURIComponent(subject)}&count=${count}`),
  // Runner gates use adaptive selection: weak/unseen topics are prioritised
  // while recently answered questions are de-prioritised.
  runnerQuestions: (subject, count = 3) => apiRequest(`/questions?subject=${encodeURIComponent(subject)}&count=${count}&runner=1&adaptive=1`),

  gateAttempt: (payload) => apiRequest("/game/gate/attempt", { method: "POST", body: payload }),
  runnerStart: (payload) => apiRequest("/game/runner/start", { method: "POST", body: payload }),
  runnerAnswer: (payload) => apiRequest("/game/runner/answer", { method: "POST", body: payload }),
  runnerFocusStart: (payload) => apiRequest("/game/runner/focus/start", { method: "POST", body: payload }),
  runnerFocusCharge: (payload) => apiRequest("/game/runner/focus/charge", { method: "POST", body: payload }),
  runnerFocusEnd: (payload) => apiRequest("/game/runner/focus/end", { method: "POST", body: payload }),
  runnerEvent: (payload) => apiRequest("/game/runner/event", { method: "POST", body: payload }),
  runnerCrash: (payload) => apiRequest("/game/runner/crash", { method: "POST", body: payload }),
  runnerComplete: (payload) => apiRequest("/game/runner/complete", { method: "POST", body: payload }),
  missions: () => apiRequest("/missions"),
  missionStart: (id) => apiRequest(`/missions/${encodeURIComponent(id)}/start`, { method: "POST" }),
  missionAnswer: (id, payload) => apiRequest(`/missions/${encodeURIComponent(id)}/answer`, { method: "POST", body: payload }),
  missionProgress: () => apiRequest("/missions/progress/me"),

  rewards: () => apiRequest("/rewards"),
  rewardUnlock: (id) => apiRequest(`/rewards/${id}/unlock`, { method: "POST" }),
  rewardEquip: (id) => apiRequest(`/rewards/${id}/equip`, { method: "POST" }),

  parentDashboard: (childId) => apiRequest(`/parent/dashboard/${childId}`),
  parentAssignTask: (payload) => apiRequest("/parent/tasks", { method: "POST", body: payload }),
  parentTaskList: (childId) => apiRequest(`/parent/tasks/${childId}`),
  parentReviewTask: (id, decision) => apiRequest(`/parent/tasks/${id}/review`, { method: "POST", body: { decision } }),

  myTasks: () => apiRequest("/tasks/mine"),
  completeTask: (id) => apiRequest(`/tasks/${id}/complete`, { method: "POST" }),
};

function requireChildAuth() {
  if (!localStorage.getItem("lq_token") || localStorage.getItem("lq_role") !== "child") {
    window.location.href = "child-login.html";
  }
}

function requireParentAuth() {
  if (!localStorage.getItem("lq_token") || localStorage.getItem("lq_role") !== "parent") {
    window.location.href = "parent.html";
  }
}

function saveSession(token, role) {
  localStorage.setItem("lq_token", token);
  localStorage.setItem("lq_role", role);
}

function clearSession() {
  localStorage.removeItem("lq_token");
  localStorage.removeItem("lq_role");
}

function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
