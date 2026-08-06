const BASE = '/api/v1';

export interface DominoMeResponse {
  phone: string;
  email: string | null;
  timezone: string;
  digest_time: string;
  digest_opted_out?: boolean;
  has_password?: boolean;
  invite_code?: string | null;
  invite_url?: string | null;
  discover_opt_in?: boolean;
  display_name?: string | null;
}

export interface DominoMeUpdate {
  email?: string | null;
  timezone?: string;
  digest_time?: string;
  digest_opted_out?: boolean;
  discover_opt_in?: boolean;
  display_name?: string | null;
}

export interface DominoAuthTokens {
  access_token: string;
  phone: string;
  has_password: boolean;
}

export type DominoInputType = 'link' | 'pdf' | 'image' | 'note';

export interface DominoItem {
  id: string;
  raw_input: string;
  input_type: DominoInputType;
  extracted_text: string | null;
  summary: string | null;
  topic: string | null;
  /** Ranked labels; [0] is the main topic. Falls back to [topic] when absent. */
  topics?: string[];
  key_ideas: string[];
  created_at: string | null;
  digest_sent: boolean;
  is_pinned: boolean;
  is_favorited: boolean;
}

export interface ChatResponse {
  answer: string;
  sources: { id: string; summary: string; created_at: string | null }[];
}

export interface DiscoverTrendItem {
  url: string;
  title: string;
  save_count: number;
  topic?: string | null;
}

export interface DiscoverSimilarResponse {
  items: DiscoverTrendItem[];
  cohort_label: string;
  opt_in_required?: boolean;
}

export interface DiscoverFriendsResponse {
  items: DiscoverTrendItem[];
  friend_count: number;
  opt_in_required?: boolean;
}

export interface DiscoverStatusResponse {
  opt_in: boolean;
  taste_ready: boolean;
  item_count: number;
  friend_count: number;
  has_data: boolean;
}

export interface DominoFriend {
  id: string;
  display_name: string;
  friendship_id: string;
}

export interface DominoFriendRequest {
  request_id: string;
  user: { id: string; display_name: string };
  created_at: string | null;
}

export interface DominoFriendsPendingResponse {
  incoming: DominoFriendRequest[];
  outgoing: DominoFriendRequest[];
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throwApiError(body, res.status);
  }
  return res.json() as Promise<T>;
}

export class DominoApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DominoApiError';
    this.code = code;
  }
}

function parseErrorDetail(body: unknown): { message: string; code?: string } {
  const d = body as { detail?: unknown };
  if (typeof d.detail === 'string') return { message: d.detail };
  if (d.detail && typeof d.detail === 'object' && !Array.isArray(d.detail)) {
    const obj = d.detail as { message?: string; code?: string; detail?: string };
    const message = obj.message || obj.detail || 'Request failed';
    return { message, code: obj.code };
  }
  if (Array.isArray(d.detail)) {
    return {
      message: d.detail
        .map((e: unknown) =>
          typeof e === 'object' && e !== null && 'msg' in e
            ? String((e as { msg: string }).msg)
            : String(e),
        )
        .join(', '),
    };
  }
  return { message: 'Request failed' };
}

function throwApiError(body: unknown, status: number): never {
  const { message, code } = parseErrorDetail(body);
  throw new DominoApiError(message || `Request failed: ${status}`, code);
}

export interface DominoSignupStatus {
  full: boolean;
  limit: number;
  count: number;
}

export const dominoApi = {
  async getSignupStatus(): Promise<DominoSignupStatus> {
    const res = await fetch(`${BASE}/auth/signup-status`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(body, res.status);
    }
    return res.json() as Promise<DominoSignupStatus>;
  },

  async requestOtp(phone: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(body, res.status);
    }
    return res.json() as Promise<{ ok: boolean }>;
  },

  async verifyOtp(phone: string, code: string, ref?: string | null): Promise<DominoAuthTokens> {
    const res = await fetch(`${BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, ...(ref ? { ref } : {}) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(body, res.status);
    }
    return res.json() as Promise<DominoAuthTokens>;
  },

  async loginWithPassword(phone: string, password: string): Promise<DominoAuthTokens> {
    const res = await fetch(`${BASE}/auth/password/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(body, res.status);
    }
    return res.json() as Promise<DominoAuthTokens>;
  },

  async setPassword(token: string, password: string, passwordConfirm: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/auth/password/set`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ password, password_confirm: passwordConfirm }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(body, res.status);
    }
    return res.json() as Promise<{ ok: boolean }>;
  },

  async joinWaitlist(email: string, ref?: string | null): Promise<{ ok: boolean; already_registered: boolean }> {
    const res = await fetch(`${BASE}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...(ref ? { ref } : {}) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throwApiError(body, res.status);
    }
    return res.json() as Promise<{ ok: boolean; already_registered: boolean }>;
  },

  async getMe(token: string): Promise<DominoMeResponse> {
    const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async updateMe(token: string, patch: DominoMeUpdate): Promise<DominoMeResponse> {
    const res = await fetch(`${BASE}/auth/me`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    });
    return handleResponse(res);
  },

  async logout(token: string): Promise<void> {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  async exportAccount(token: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${BASE}/auth/me/export`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async deleteAccount(token: string, password?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE}/auth/me/delete`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ confirm: 'delete', ...(password ? { password } : {}) }),
    });
    return handleResponse(res);
  },

  async getItems(token: string, limit = 100, offset = 0): Promise<DominoItem[]> {
    const res = await fetch(`${BASE}/items?limit=${limit}&offset=${offset}`, {
      headers: authHeaders(token),
    });
    return handleResponse(res);
  },

  async createItem(token: string, raw_input: string): Promise<DominoItem> {
    const res = await fetch(`${BASE}/items`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ raw_input }),
    });
    return handleResponse(res);
  },

  async patchItem(token: string, id: string, patch: { is_pinned?: boolean; is_favorited?: boolean }): Promise<DominoItem> {
    const res = await fetch(`${BASE}/items/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(patch),
    });
    return handleResponse(res);
  },

  async deleteItem(token: string, id: string): Promise<void> {
    const res = await fetch(`${BASE}/items/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return handleResponse(res);
  },

  async chat(token: string, message: string): Promise<ChatResponse> {
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ message }),
    });
    return handleResponse(res);
  },

  async getDiscoverStatus(token: string): Promise<DiscoverStatusResponse> {
    const res = await fetch(`${BASE}/discover/status`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async getSimilarTasteTrending(token: string): Promise<DiscoverSimilarResponse> {
    const res = await fetch(`${BASE}/discover/similar-taste`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async getFriendsTrending(token: string): Promise<DiscoverFriendsResponse> {
    const res = await fetch(`${BASE}/discover/friends-trending`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async getFriends(token: string): Promise<{ friends: DominoFriend[] }> {
    const res = await fetch(`${BASE}/friends`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async getFriendsPending(token: string): Promise<DominoFriendsPendingResponse> {
    const res = await fetch(`${BASE}/friends/pending`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async sendFriendRequest(token: string, body: { phone?: string; invite_code?: string }): Promise<{ request_id: string; status: string }> {
    const res = await fetch(`${BASE}/friends/request`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async acceptFriendRequest(token: string, requestId: string): Promise<{ request_id: string; status: string }> {
    const res = await fetch(`${BASE}/friends/accept`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ request_id: requestId }),
    });
    return handleResponse(res);
  },

  async declineFriendRequest(token: string, requestId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE}/friends/decline`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ request_id: requestId }),
    });
    return handleResponse(res);
  },

  async removeFriend(token: string, friendshipId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE}/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return handleResponse(res);
  },
};
