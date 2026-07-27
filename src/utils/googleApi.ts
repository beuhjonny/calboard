import type { GoogleCalendarEvent, GoogleTask } from '../types';

// Declare Google Identity Services globally since it's loaded via script tag
declare const google: any;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  issued_at: number;
}

/**
 * Initializes and triggers the Google OAuth2 flow using Google Identity Services.
 */
export function loginWithGoogle(
  clientId: string,
  onSuccess: (tokenResp: TokenResponse) => void,
  onError: (err: any) => void
): void {
  try {
    if (typeof google === 'undefined') {
      throw new Error('Google Identity Services SDK not loaded yet. Please wait a moment and try again.');
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks',
      callback: (response: any) => {
        if (response.error) {
          onError(response);
        } else {
          onSuccess({
            access_token: response.access_token,
            expires_in: parseInt(response.expires_in) || 3600,
            issued_at: Date.now(),
          });
        }
      },
    });

    client.requestAccessToken();
  } catch (error) {
    onError(error);
  }
}

/**
 * Checks if a cached token is still valid.
 */
export function isTokenValid(token: TokenResponse | null): boolean {
  if (!token || !token.access_token) return false;
  const lifespan = token.expires_in * 1000;
  const elapsed = Date.now() - token.issued_at;
  // Consider token expired 5 minutes early to prevent failures mid-operation
  const buffer = 5 * 60 * 1000;
  return elapsed < lifespan - buffer;
}

/**
 * Fetch upcoming Google Calendar events from 'primary' calendar.
 */
export async function fetchCalendarEvents(accessToken: string): Promise<GoogleCalendarEvent[]> {
  const timeMin = new Date().toISOString();
  // Fetch up to 15 events starting from now, ordered by start time
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=15`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Calendar API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch Google Tasks from default list.
 */
export async function fetchTasks(accessToken: string): Promise<GoogleTask[]> {
  // Use '@default' alias to pull from the user's primary task list
  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=50`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tasks API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Add a task to the default Google Task list.
 */
export async function createGoogleTask(accessToken: string, title: string): Promise<GoogleTask> {
  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, status: 'needsAction' }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Create Task Error (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Toggle task status (completed / needsAction) on Google Tasks.
 */
export async function updateGoogleTask(
  accessToken: string, 
  taskId: string, 
  status: 'needsAction' | 'completed'
): Promise<GoogleTask> {
  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`;
  
  const body: any = { id: taskId, status };
  if (status === 'completed') {
    body.completed = new Date().toISOString();
  } else {
    body.completed = null;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Update Task Error (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Delete a task from Google Tasks.
 */
export async function deleteGoogleTask(accessToken: string, taskId: string): Promise<void> {
  const url = `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Delete Task Error (${response.status}): ${errText}`);
  }
}

/**
 * Scrapes direct image URLs from a public Google Photos shared album link.
 * Tries the local dev server proxy first, then falls back to public CORS proxies.
 */
export async function fetchSharedAlbumPhotos(albumUrl: string): Promise<string[]> {
  if (!albumUrl) return [];

  const proxies = [
    (url: string) => `/api/google-photos-proxy?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  ];

  for (let i = 0; i < proxies.length; i++) {
    const proxyUrl = proxies[i](albumUrl);
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;

      let html = '';
      if (proxyUrl.includes('allorigins')) {
        const data = await response.json();
        html = data.contents || '';
      } else {
        html = await response.text();
      }

      // Extract direct shared photo URLs starting with pw/ or lr/ subdirectories
      const regex = /https:\/\/lh[3-6]\.googleusercontent\.com\/(?:pw|lr)\/[a-zA-Z0-9\-_]{50,}/g;
      const matches = html.match(regex) || [];

      if (matches.length > 0) {
        const cleanUrls = matches.map((url: string) => url.split('=')[0]);
        const uniqueUrls: string[] = Array.from(new Set(cleanUrls));
        // Use =w1920-no suffix to instruct Google Photos CDN to serve clean photos/posters without play button overlays
        return uniqueUrls.map((url: string) => `${url}=w1920-no`);
      }
    } catch (err) {
      console.warn(`[PhotosScraper] Proxy option ${i + 1} failed:`, err);
    }
  }

  return [];
}
