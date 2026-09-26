export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  }
  return baseUrl.replace(/\/$/, '');
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
