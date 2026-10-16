const BASE = '/api';

function token() { return localStorage.getItem('token'); }

async function request<T = any>(method: string, path: string, body?: any, isForm = false): Promise<T> {
  const headers: Record<string, string> = {};
  const t = token();
  if (t) headers.authorization = `Bearer ${t}`;
  if (body && !isForm) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth')) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>('GET', p),
  post: <T = any>(p: string, b?: any) => request<T>('POST', p, b),
  patch: <T = any>(p: string, b?: any) => request<T>('PATCH', p, b),
  upload: <T = any>(p: string, form: FormData) => request<T>('POST', p, form, true),
  downloadUrl: (p: string) => `${BASE}${p}`,
  async download(p: string, filename: string) {
    const res = await fetch(`${BASE}${p}`, { headers: { authorization: `Bearer ${token()}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};
