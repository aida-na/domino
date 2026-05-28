const BASE = '/api/v1';

export interface DominoMeResponse {
  phone: string;
  timezone: string;
  digest_time: string;
  has_password?: boolean;
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

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function parseErrorDetail(body: unknown): string {
  const d = body as { detail?: unknown };
  if (typeof d.detail === 'string') return d.detail;
  if (Array.isArray(d.detail)) {
    return d.detail
      .map((e: unknown) =>
        typeof e === 'object' && e !== null && 'msg' in e
          ? String((e as { msg: string }).msg)
          : String(e),
      )
      .join(', ');
  }
  return 'Request failed';
}

export const dominoApi = {
  async requestOtp(phone: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(parseErrorDetail(body));
    }
    return res.json() as Promise<{ ok: boolean }>;
  },

  async verifyOtp(phone: string, code: string): Promise<DominoAuthTokens> {
    const res = await fetch(`${BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(parseErrorDetail(body));
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
      throw new Error(parseErrorDetail(body));
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
      throw new Error(parseErrorDetail(body));
    }
    return res.json() as Promise<{ ok: boolean }>;
  },

  async requestMagicLink(phone: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${BASE}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(parseErrorDetail(body));
    }
    return res.json() as Promise<{ ok: boolean }>;
  },

  async getMe(token: string): Promise<DominoMeResponse> {
    const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders(token) });
    return handleResponse(res);
  },

  async logout(token: string): Promise<void> {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(token),
    });
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
};
