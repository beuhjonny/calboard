export interface DashboardConfig {
  googleClientId: string;
  weatherLocation: string; // e.g., "New York, US" or coords
  showTodos: boolean;
  photoRefreshMinutes: number;
  weatherForecastDays: 1 | 3;
  googlePhotosSharedLink: string;
  glassOpacity: number;
  bgOverlayOpacity: number;
  photoFitMode: 'bestfit' | 'ambient' | 'cover';
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  colorId?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
  notes?: string;
  completed?: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  tempMin: number;
  tempMax: number;
  description: string;
  forecast: Array<{
    date: string;
    temp: number;
    tempMin: number;
    tempMax: number;
    condition: string;
    icon: string;
  }>;
}
