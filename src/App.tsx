import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudLightning, 
  CloudDrizzle,
  Settings, 
  LogIn, 
  LogOut, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  FolderHeart,
  Info,
  Maximize,
  RefreshCw
} from 'lucide-react';
import type { DashboardConfig, GoogleCalendarEvent, GoogleTask, WeatherData } from './types';
import { 
  loginWithGoogle, 
  isTokenValid, 
  fetchCalendarEvents, 
  fetchTasks, 
  createGoogleTask, 
  updateGoogleTask, 
  deleteGoogleTask, 
  fetchSharedAlbumPhotos
} from './utils/googleApi';
import type { TokenResponse } from './utils/googleApi';
import { fetchLiveWeatherKeyless } from './utils/weatherApi';
import { subscribeCurrentDisplayPhotos, saveDisplayPhotosBatch } from './utils/firebase';
import { selectAndFormatDisplayPhotos } from './utils/photoScraper';

// Default mock configuration
const DEFAULT_CONFIG: DashboardConfig = {
  googleClientId: '840133101705-7nvs9fkicf7f8h82qp33hnblkt036n32.apps.googleusercontent.com',
  weatherLocation: 'Montreal, CA',
  showTodos: true,
  photoRefreshMinutes: 5,
  weatherForecastDays: 3,
  googlePhotosSharedLink: '',
  glassOpacity: 45,
  bgOverlayOpacity: 50,
  photoFitMode: 'bestfit',
  autoSyncIntervalHours: 12,
};

// Curated stunning high-res photos for background if Google Photos isn't linked
const DEFAULT_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1974&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?q=80&w=2070&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472214222541-d510753a4707?q=80&w=2070&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop',
];

// Mock Calendar Events
const MOCK_EVENTS: GoogleCalendarEvent[] = [
  {
    id: 'e1',
    summary: 'Morning Workout (LiftLogic) 🏋️‍♂️',
    start: { dateTime: new Date(new Date().setHours(8, 0, 0)).toISOString() },
    end: { dateTime: new Date(new Date().setHours(9, 30, 0)).toISOString() },
    location: 'Local Gym',
    colorId: '2' // Greenish
  },
  {
    id: 'e2',
    summary: 'Coffee with Dave ☕',
    start: { dateTime: new Date(new Date().setHours(10, 30, 0)).toISOString() },
    end: { dateTime: new Date(new Date().setHours(11, 15, 0)).toISOString() },
    location: 'Milano Espresso Bar'
  },
  {
    id: 'e3',
    summary: 'Design Review: Calboard',
    start: { dateTime: new Date(new Date().setHours(13, 0, 0)).toISOString() },
    end: { dateTime: new Date(new Date().setHours(14, 0, 0)).toISOString() },
    location: 'Virtual Zoom'
  },
  {
    id: 'e4',
    summary: 'Grocery Shopping 🛒',
    start: { dateTime: new Date(new Date().setHours(16, 30, 0)).toISOString() },
    end: { dateTime: new Date(new Date().setHours(17, 30, 0)).toISOString() },
    location: 'Metro Supermarket'
  },
  {
    id: 'e5',
    summary: 'Family Dinner Night 🍽️',
    start: { dateTime: new Date(new Date().setHours(19, 0, 0)).toISOString() },
    end: { dateTime: new Date(new Date().setHours(21, 30, 0)).toISOString() },
    location: 'Parents House'
  }
];

// Mock Tasks
const MOCK_TASKS: GoogleTask[] = [
  { id: 't1', title: 'Plan weekly lifting split on LiftLogic', status: 'needsAction' },
  { id: 't2', title: 'Renew domain for calboard.app', status: 'needsAction' },
  { id: 't3', title: 'Water balcony ferns & flowers', status: 'completed' },
  { id: 't4', title: 'Reply to Sarah about weekend camping trip', status: 'needsAction' },
  { id: 't5', title: 'Clean coffee grinder', status: 'needsAction' }
];

// Mock Weather
const MOCK_WEATHER: WeatherData = {
  temp: 22,
  condition: 'Partly Cloudy',
  icon: '03d',
  tempMin: 17,
  tempMax: 26,
  description: 'scattered clouds with a light breeze',
  forecast: [
    { date: 'Mon', temp: 24, tempMin: 18, tempMax: 27, condition: 'Sunny', icon: '01d' },
    { date: 'Tue', temp: 20, tempMin: 15, tempMax: 23, condition: 'Rainy', icon: '10d' },
    { date: 'Wed', temp: 21, tempMin: 16, tempMax: 24, condition: 'Partly Cloudy', icon: '02d' }
  ]
};

// Mock Google Photos Albums (No longer used, replaced by active albums query)

export default function App() {
  // Config & State
  const [config, setConfig] = useState<DashboardConfig>(() => {
    const saved = localStorage.getItem('calboard_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.googleClientId || parsed.googleClientId !== DEFAULT_CONFIG.googleClientId) {
        parsed.googleClientId = DEFAULT_CONFIG.googleClientId;
      }
      if (!parsed.googlePhotosSharedLink) {
        parsed.googlePhotosSharedLink = DEFAULT_CONFIG.googlePhotosSharedLink;
      }
      localStorage.setItem('calboard_config', JSON.stringify(parsed));
      return parsed;
    }
    return DEFAULT_CONFIG;
  });

  const [time, setTime] = useState<Date>(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  // Custom Background lists
  const [backgrounds, setBackgrounds] = useState<string[]>(DEFAULT_BACKGROUNDS);
  const [bgIndex, setBgIndex] = useState(0);

  // Force cache invalidation for PWA webviews on new builds
  useEffect(() => {
    const CURRENT_VERSION = 'v2.1.0-lowres-pwa';
    const lastVersion = localStorage.getItem('calboard_pwa_version');
    if (lastVersion !== CURRENT_VERSION) {
      localStorage.setItem('calboard_pwa_version', CURRENT_VERSION);
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      if (!window.location.search.includes('v=')) {
        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
      }
    }
  }, []);

  // Cached Google OAuth Token
  const [token, setToken] = useState<TokenResponse | null>(() => {
    const saved = localStorage.getItem('google_access_token');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isTokenValid(parsed)) {
        return parsed;
      }
    }
    return null;
  });

  // Track if we are currently fetching live data from Google
  const [isDataLoading, setIsDataLoading] = useState<boolean>(token !== null);

  // Dashboard Data State (always start empty to prevent mock data flash)
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);

  const [weather, setWeather] = useState<WeatherData>(MOCK_WEATHER);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Save config changes
  useEffect(() => {
    localStorage.setItem('calboard_config', JSON.stringify(config));
  }, [config]);

  // Save token changes
  useEffect(() => {
    if (token) {
      localStorage.setItem('google_access_token', JSON.stringify(token));
    } else {
      localStorage.removeItem('google_access_token');
    }
  }, [token]);

  // Fetch live weather from Open-Meteo keylessly
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await fetchLiveWeatherKeyless(config.weatherLocation);
        setWeather(data);
      } catch (err) {
        console.error('Error fetching live weather data:', err);
      }
    };

    fetchWeather();
    
    // Poll weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config.weatherLocation]);

  // Real-time listener for Firestore Current_Display_Photos collection
  const [firestorePhotosCount, setFirestorePhotosCount] = useState<number>(0);
  const [isSyncingPhotos, setIsSyncingPhotos] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeCurrentDisplayPhotos((photos) => {
      if (photos && photos.length > 0) {
        const urls = photos.map(p => p.url);
        setBackgrounds(urls);
        setFirestorePhotosCount(urls.length);
        setBgIndex((prev) => prev % urls.length);
      } else {
        setBackgrounds(DEFAULT_BACKGROUNDS);
        setFirestorePhotosCount(0);
      }
    });

    return () => unsubscribe();
  }, []);

  const triggerAlbumSyncToFirestore = async () => {
    const albumUrl = config.googlePhotosSharedLink || 'https://photos.app.goo.gl/rPu6ZCJtajQt4kYu6';
    setIsSyncingPhotos(true);
    try {
      const urls = await fetchSharedAlbumPhotos(albumUrl);
      if (urls.length > 0) {
        const displayPhotos = selectAndFormatDisplayPhotos(urls, 24);
        await saveDisplayPhotosBatch(displayPhotos);
      }
    } catch (err) {
      console.error('Error syncing photos to Firestore:', err);
    } finally {
      setIsSyncingPhotos(false);
    }
  };

  // Scheduled Background Auto-Sync Timer (12h or 24h)
  useEffect(() => {
    const intervalHours = config.autoSyncIntervalHours ?? 12;
    if (intervalHours === 0) return;

    const intervalMs = intervalHours * 60 * 60 * 1000;
    const timer = setInterval(() => {
      console.log(`[AutoSync] Triggering scheduled ${intervalHours}h photo batch sync to Firestore...`);
      triggerAlbumSyncToFirestore();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [config.autoSyncIntervalHours, config.googlePhotosSharedLink]);

  // Fetch Calendar and Tasks on a loop
  useEffect(() => {
    if (!token || !isTokenValid(token)) {
      setEvents([]);
      setTasks([]);
      setIsDataLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsDataLoading(true);
      try {
        const eventsData = await fetchCalendarEvents(token.access_token);
        setEvents(eventsData);
      } catch (err) {
        console.error('Error fetching Calendar events:', err);
      }

      if (config.showTodos) {
        try {
          const tasksData = await fetchTasks(token.access_token);
          setTasks(tasksData);
        } catch (err) {
          console.error('Error fetching Google Tasks:', err);
        }
      }
      setIsDataLoading(false);
    };

    fetchData();

    // Poll every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, config.showTodos]);

  // Live Digital Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Background Image Rotator (Random Selection)
  useEffect(() => {
    const duration = config.photoRefreshMinutes * 60 * 1000;
    const bgRotator = setInterval(() => {
      setBgIndex((prevIndex) => {
        if (backgrounds.length <= 1) return 0;
        let nextIndex = Math.floor(Math.random() * backgrounds.length);
        while (nextIndex === prevIndex) {
          nextIndex = Math.floor(Math.random() * backgrounds.length);
        }
        return nextIndex;
      });
    }, duration);
    return () => clearInterval(bgRotator);
  }, [backgrounds, config.photoRefreshMinutes]);

  // Get Greeting message based on hours
  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Weather Icon Renderer Helper
  const renderWeatherIcon = (iconCode: string, size: number = 24) => {
    switch (iconCode) {
      case '01d': case '01n':
        return <Sun size={size} className="text-amber-400" style={{ color: 'var(--color-accent-amber)' }} />;
      case '02d': case '02n': case '03d': case '03n': case '04d': case '04n':
        return <Cloud size={size} className="text-slate-300" />;
      case '09d': case '09n':
        return <CloudDrizzle size={size} className="text-blue-300" style={{ color: 'var(--color-accent-blue)' }} />;
      case '10d': case '10n':
        return <CloudRain size={size} className="text-blue-400" style={{ color: 'var(--color-accent-blue)' }} />;
      case '11d': case '11n':
        return <CloudLightning size={size} className="text-violet-400" style={{ color: 'var(--color-accent-violet)' }} />;
      case '13d': case '13n':
        return <CloudSnow size={size} className="text-blue-100" />;
      default:
        return <Sun size={size} className="text-amber-400" style={{ color: 'var(--color-accent-amber)' }} />;
    }
  };

  // Google Login Handlers
  const handleConnectGoogle = () => {
    if (!config.googleClientId) {
      alert('Please configure your Google OAuth Client ID in settings first!');
      return;
    }

    loginWithGoogle(
      config.googleClientId,
      (tokenResp) => {
        setToken(tokenResp);
      },
      (err) => {
        console.error('OAuth connection error:', err);
        alert(`Failed to authenticate with Google: ${err.error_description || err.error || 'Unknown error'}`);
      }
    );
  };

  const handleDisconnectGoogle = () => {
    setToken(null);
    setConfig({
      ...config,
      googlePhotosSharedLink: '',
    });
    setBackgrounds(DEFAULT_BACKGROUNDS);
    setEvents(MOCK_EVENTS);
    setTasks(MOCK_TASKS);
  };

  // Handle task check/uncheck
  const toggleTaskStatus = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'needsAction' ? 'completed' : 'needsAction';

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    if (token && isTokenValid(token) && !taskId.startsWith('t_')) {
      try {
        await updateGoogleTask(token.access_token, taskId, newStatus);
      } catch (err) {
        console.error('Error updating Google Task status:', err);
        // Rollback
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
        );
      }
    }
  };

  // Add new task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (token && isTokenValid(token)) {
      try {
        const newTask = await createGoogleTask(token.access_token, newTaskTitle.trim());
        setTasks((prev) => [newTask, ...prev]);
        setNewTaskTitle('');
      } catch (err) {
        console.error('Error creating Google Task:', err);
        alert('Failed to add task to Google Tasks.');
      }
    } else {
      // Mock mode fallback
      const newTask: GoogleTask = {
        id: `t_${Date.now()}`,
        title: newTaskTitle.trim(),
        status: 'needsAction',
      };
      setTasks((prev) => [newTask, ...prev]);
      setNewTaskTitle('');
    }
  };

  // Remove task
  const handleRemoveTask = async (taskId: string) => {
    const originalTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (token && isTokenValid(token) && !taskId.startsWith('t_')) {
      try {
        await deleteGoogleTask(token.access_token, taskId);
      } catch (err) {
        console.error('Error deleting Google Task:', err);
        setTasks(originalTasks);
      }
    }
  };

  // Helper to parse Google Calendar start/end dates correctly without UTC timezone shifts
  const parseEventDate = (dateObj?: { dateTime?: string; date?: string }, isEnd: boolean = false): Date | null => {
    if (!dateObj) return null;
    if (dateObj.dateTime) {
      return new Date(dateObj.dateTime);
    }
    if (dateObj.date) {
      const [year, month, day] = dateObj.date.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      if (isEnd) {
        // Google Calendar exclusive end date for all-day events -> subtract 1 day for inclusive range
        d.setDate(d.getDate() - 1);
      }
      return d;
    }
    return null;
  };

  // Helper to group events by start/range dates across multi-day events
  const getGroupedEvents = (eventsList: GoogleCalendarEvent[]) => {
    const groups: { [key: string]: GoogleCalendarEvent[] } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    eventsList.forEach(event => {
      const start = parseEventDate(event.start, false);
      let end = parseEventDate(event.end, true) || start;

      if (!start) return;

      if (end && end.getTime() < start.getTime()) {
        end = start;
      }

      const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endLimit = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : current;

      while (current.getTime() <= endLimit.getTime()) {
        if (current.getTime() >= today.getTime()) {
          const dateKey = current.toDateString();
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(event);
        }
        current.setDate(current.getDate() + 1);
      }
    });

    return Object.entries(groups).sort((a, b) => {
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    });
  };

  // Helper to format date headers
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Resizing split width state for middle divider between panels
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('calboard_left_width');
    return saved ? parseFloat(saved) : 50;
  });

  const handleDividerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (_) {}
    
    const container = handle.parentElement;
    if (!container) return;
    
    const containerWidth = container.getBoundingClientRect().width;
    const containerLeft = container.getBoundingClientRect().left;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const relativeX = moveEvent.clientX - containerLeft;
      const percent = (relativeX / containerWidth) * 100;
      const newWidth = Math.max(25, Math.min(75, percent));
      setLeftWidth(newWidth);
      localStorage.setItem('calboard_left_width', newWidth.toString());
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      try {
        handle.releasePointerCapture(upEvent.pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  useEffect(() => {
    localStorage.setItem('calboard_left_width', leftWidth.toString());
  }, [leftWidth]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden font-body"
      style={{
        '--glass-opacity': config.glassOpacity !== undefined ? config.glassOpacity / 100 : 0.45,
        '--bg-overlay-opacity': config.bgOverlayOpacity !== undefined ? config.bgOverlayOpacity / 100 : 0.50
      } as React.CSSProperties}
    >
      {/* Dynamic Ken Burns background photos with Smart Ambient backdrop option */}
      <div className={`bg-container fit-${config.photoFitMode || 'ambient'}`}>
        {backgrounds.map((bgUrl, index) => (
          <div key={bgUrl} className={`bg-slide ${index === bgIndex ? 'active' : ''}`}>
            <img src={bgUrl} alt="" className="bg-image-blur" />
            <img src={bgUrl} alt="background wallpaper" className="bg-image-main" />
          </div>
        ))}
        <div className="bg-overlay"></div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="dashboard-container fade-in-up">
        
        {/* Top Row: Clock and Weather Widget */}
        <div className="top-row">
          <div className="clock-section">
            <span className="clock-greeting">{getGreeting()}</span>
            <h1 className="clock-time">
              <span className="time-digits">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).split(' ')[0]}
              </span>
              <span className="time-ampm">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).split(' ')[1] || ''}
              </span>
            </h1>
            <p className="clock-date">
              {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="weather-card glass-panel">
            <div className="weather-main">
              <div className="weather-icon-wrapper">
                {renderWeatherIcon(weather.icon, 38)}
              </div>
              <div className="weather-details">
                <div className="weather-temp">{weather.temp}°C</div>
                <div className="weather-location">{config.weatherLocation}</div>
                <div className="weather-condition">{weather.condition}</div>
                <div className="weather-highlow">
                  H: {weather.tempMax}° L: {weather.tempMin}°
                </div>
              </div>
            </div>

            {/* Weather Forecast Row */}
            <div className="weather-forecast-row">
              {weather.forecast.slice(0, config.weatherForecastDays).map((f, i) => (
                <div key={i} className="weather-forecast-item">
                  <span className="weather-forecast-day">{config.weatherForecastDays === 1 ? 'Tomorrow' : f.date}</span>
                  <div style={{ margin: '0.15rem 0', display: 'flex', alignItems: 'center' }}>
                    {renderWeatherIcon(f.icon, 16)}
                  </div>
                  <span className="weather-forecast-temp">{f.temp}°</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row: Panels Resizable Flex Layout */}
        <div className={`panels-container ${config.showTodos ? 'has-todos' : 'no-todos'}`}>
          {/* Calendar Agenda Panel */}
          <section 
            className="panel glass-panel relative"
            style={config.showTodos ? { flex: `0 0 ${leftWidth}%`, width: `${leftWidth}%` } : undefined}
          >
            <div className="panel-header">
              <div className="panel-title-wrapper">
                <CalendarIcon size={18} style={{ color: 'var(--color-accent-blue)' }} />
                <h2 className="panel-title">Calendar</h2>
              </div>
              <span className="panel-badge">
                {events.filter(event => {
                  const start = parseEventDate(event.start, false);
                  let end = parseEventDate(event.end, true) || start;
                  if (!start) return false;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
                  const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : startDay;
                  return today.getTime() >= startDay.getTime() && today.getTime() <= endDay.getTime();
                }).length} Today
              </span>
            </div>

            <div className="list-content hide-scrollbar">
              {!token ? (
                <div className="empty-state" style={{ height: '100%', minHeight: '220px' }}>
                  <CalendarIcon size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>Calendar not connected</p>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="settings-btn settings-btn-primary"
                    style={{ width: 'auto', padding: '0.55rem 1rem', fontSize: '0.8rem' }}
                  >
                    Connect Google Account
                  </button>
                </div>
              ) : isDataLoading && events.length === 0 ? (
                <div className="empty-state">
                  <div className="skeleton-loader-spinner" />
                  <p>Syncing calendar...</p>
                </div>
              ) : getGroupedEvents(events).length > 0 ? (
                getGroupedEvents(events).map(([dateKey, groupEvents]) => (
                  <div key={dateKey} className="agenda-group">
                    <div className="agenda-group-header">
                      {formatDateHeader(dateKey)}
                    </div>
                    <div className="agenda-group-list">
                      {groupEvents.map((event) => {
                        const start = parseEventDate(event.start, false) || new Date();
                        const end = parseEventDate(event.end, true) || start;
                        const isAllDay = !event.start.dateTime;

                        return (
                          <div key={`${event.id}-${dateKey}`} className="event-card">
                            <div 
                              className="event-bar"
                              style={{ 
                                backgroundColor: event.colorId === '2' ? 'var(--color-accent-emerald)' : 'var(--color-accent-blue)' 
                              }}
                            />
                            <div className="event-details">
                              <h3 className="event-title">{event.summary}</h3>
                              <p className="event-time">
                                {isAllDay 
                                  ? (start.toDateString() !== end.toDateString() 
                                      ? `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric' })} (All Day)`
                                      : 'All Day')
                                  : `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                }
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p>No upcoming events</p>
                </div>
              )}
            </div>
          </section>

          {/* Central Resizable Divider Handle between Calendar and Todo */}
          {config.showTodos && (
            <div 
              className="panel-divider-handle"
              onPointerDown={handleDividerPointerDown}
              title="Drag left or right to resize panels"
            >
              <div className="panel-grip-line" />
              <div className="panel-grip-line" />
              <div className="panel-grip-line" />
            </div>
          )}

          {/* Todo List Panel */}
          {config.showTodos && (
            <section 
              className="panel glass-panel relative"
              style={{ flex: 1 }}
            >
              <div className="panel-header">
                <div className="panel-title-wrapper">
                  <CheckSquare size={18} style={{ color: 'var(--color-accent-emerald)' }} />
                  <h2 className="panel-title">TO DO</h2>
                </div>
              </div>

              {/* Tasks list */}
              <div className="list-content hide-scrollbar" style={{ flex: 1 }}>
                {!token ? (
                  <div className="empty-state" style={{ height: '100%', minHeight: '220px' }}>
                    <CheckSquare size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>Tasks not connected</p>
                    <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="settings-btn settings-btn-primary"
                      style={{ width: 'auto', padding: '0.55rem 1rem', fontSize: '0.8' }}
                    >
                      Connect Google Account
                    </button>
                  </div>
                ) : isDataLoading && tasks.length === 0 ? (
                  <div className="empty-state">
                    <div className="skeleton-loader-spinner" />
                    <p>Syncing todos...</p>
                  </div>
                ) : tasks.length > 0 ? (
                  tasks.map((task) => (
                    <div 
                      key={task.id}
                      className={`todo-card ${task.status === 'completed' ? 'completed' : ''}`}
                    >
                      <label className="todo-checkbox-label">
                        <div className="custom-checkbox">
                          <input 
                            type="checkbox" 
                            checked={task.status === 'completed'} 
                            onChange={() => toggleTaskStatus(task.id)}
                          />
                          <div className="checkbox-box">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        </div>
                        <span className={`todo-title ${task.status === 'completed' ? 'completed' : ''}`}>
                          {task.title}
                        </span>
                      </label>

                      <button 
                        onClick={() => handleRemoveTask(task.id)}
                        className="todo-delete-btn"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <CheckSquare size={32} />
                    <p>No tasks remaining! Nice job.</p>
                  </div>
                )}
              </div>

              {/* Quick Add Task moved to bottom */}
              <form onSubmit={handleAddTask} className="todo-form" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add a new task..."
                  className="todo-input"
                />
                <button type="submit" className="todo-add-btn">
                  <Plus size={18} />
                </button>
              </form>
            </section>
          )}
        </div>
      </div>

      {/* Floating Gear Button for settings */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="floating-settings-btn"
        title="Settings"
      >
        <Settings size={22} />
      </button>

      {/* SETTINGS DRAWER OVERLAY */}
      <div 
        className={`settings-overlay ${isSettingsOpen ? 'open' : ''}`}
        onClick={() => setIsSettingsOpen(false)}
      />

      {/* SETTINGS DRAWER */}
      <div className={`settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <div className="settings-header-title">
            <Settings size={20} className="text-slate-300" />
            <h2>Calboard Settings</h2>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(false)}
            className="settings-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        <div className="settings-content">
          
          {/* GOOGLE INTEGRATION SECTION */}
          <div className="settings-section">
            <h3 className="settings-section-title">Google Integration</h3>
            
            {token !== null ? (
              <div className="settings-group">
                <div className="settings-status-box settings-status-success">
                  <span>Logged in with Google</span>
                  <FolderHeart size={16} />
                </div>
                <button 
                  onClick={handleDisconnectGoogle}
                  className="settings-btn settings-btn-danger"
                >
                  <LogOut size={16} />
                  Disconnect Account
                </button>
              </div>
            ) : (
              <div className="settings-group">
                <p className="settings-subtext" style={{ marginBottom: '0.75rem' }}>
                  Connect your Google account to fetch live Google Calendar events, Google Tasks, and select background photos from your Google Photos albums.
                </p>
                <button 
                  onClick={handleConnectGoogle}
                  className="settings-btn settings-btn-primary"
                >
                  <LogIn size={16} />
                  Connect Google Account
                </button>
              </div>
            )}
          </div>

          {/* DASHBOARD WIDGETS SECTION */}
          <div className="settings-section">
            <h3 className="settings-section-title">Dashboard Widgets</h3>
            
            {/* Toggle show todos */}
            <div className="settings-row">
              <div className="settings-group">
                <span className="settings-label">Todo List Widget</span>
                <p className="settings-subtext">Display task list next to calendar</p>
              </div>
              <label className="custom-checkbox">
                <input 
                  type="checkbox" 
                  checked={config.showTodos} 
                  onChange={(e) => setConfig({ ...config, showTodos: e.target.checked })}
                />
                <div className="checkbox-box">
                  <Check size={12} strokeWidth={3} />
                </div>
              </label>
            </div>

            {/* Weather Location input */}
            <div className="settings-group">
              <label className="settings-label">Weather Location</label>
              <input
                type="text"
                value={config.weatherLocation}
                onChange={(e) => setConfig({ ...config, weatherLocation: e.target.value })}
                placeholder="City Name, Country Code"
                className="settings-input"
              />
            </div>

            {/* Weather Days selection */}
            <div className="settings-group">
              <label className="settings-label">Weather Forecast Display</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, weatherForecastDays: 1 })}
                  className={`settings-btn ${config.weatherForecastDays === 1 ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  1-Day (Tomorrow)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, weatherForecastDays: 3 })}
                  className={`settings-btn ${config.weatherForecastDays === 3 ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  3-Day Forecast
                </button>
              </div>
            </div>

            {/* Opacity Sliders */}
            <div className="settings-group" style={{ marginTop: '0.85rem' }}>
              <label className="settings-label">Panel Opacity ({config.glassOpacity ?? 45}%)</label>
              <input
                type="range"
                min="10"
                max="90"
                value={config.glassOpacity ?? 45}
                onChange={(e) => setConfig({ ...config, glassOpacity: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--color-accent-blue)', marginTop: '0.35rem' }}
              />
            </div>

            <div className="settings-group" style={{ marginTop: '0.85rem' }}>
              <label className="settings-label">Background Dimming ({config.bgOverlayOpacity ?? 50}%)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.bgOverlayOpacity ?? 50}
                onChange={(e) => setConfig({ ...config, bgOverlayOpacity: parseInt(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--color-accent-blue)', marginTop: '0.35rem' }}
              />
            </div>

            {/* Photo Fit Mode selection */}
            <div className="settings-group" style={{ marginTop: '0.85rem' }}>
              <label className="settings-label">Photo Fit Mode</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, photoFitMode: 'bestfit' })}
                  className={`settings-btn ${(config.photoFitMode || 'bestfit') === 'bestfit' ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.78rem', textAlign: 'left' }}
                >
                  🌟 Smart Best Fit (Recommended)
                </button>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, photoFitMode: 'cover' })}
                    className={`settings-btn ${config.photoFitMode === 'cover' ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                  >
                    🖼 Crop & Fill Screen
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, photoFitMode: 'ambient' })}
                    className={`settings-btn ${config.photoFitMode === 'ambient' ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                  >
                    🔍 Full Photo Contain
                  </button>
                </div>
              </div>
            </div>

            {/* Immersive Fullscreen Toggle */}
            <div className="settings-group" style={{ marginTop: '0.85rem' }}>
              <label className="settings-label">Screen Display</label>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="settings-btn settings-btn-primary"
                style={{ width: '100%', padding: '0.6rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Maximize size={16} /> Enter Immersive Full Screen
              </button>
            </div>
          </div>

          {/* GOOGLE PHOTOS ALBUM WALLPAPER CONFIG */}
          <div className="settings-section">
            <h3 className="settings-section-title">Google Photos Wallpaper Settings</h3>
            
            {/* Photo Refresh Interval */}
            <div className="settings-group">
              <label className="settings-label">Photo Rotation Interval (Minutes)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={config.photoRefreshMinutes}
                onChange={(e) => setConfig({ ...config, photoRefreshMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
                className="settings-input"
              />
            </div>

            {/* Scheduled Background Auto-Sync Selection */}
            <div className="settings-group" style={{ marginTop: '0.85rem' }}>
              <label className="settings-label">Automated Scheduled Album Sync</label>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, autoSyncIntervalHours: 12 })}
                  className={`settings-btn ${(config.autoSyncIntervalHours ?? 12) === 12 ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  ⏰ Every 12 Hours
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, autoSyncIntervalHours: 24 })}
                  className={`settings-btn ${config.autoSyncIntervalHours === 24 ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  🌙 Every 24 Hours
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, autoSyncIntervalHours: 0 })}
                  className={`settings-btn ${config.autoSyncIntervalHours === 0 ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem' }}
                >
                  🚫 Manual Only
                </button>
              </div>
            </div>

            {/* Active Synced Libraries Card */}
            <div className="settings-group" style={{ marginTop: '0.85rem' }}>
              <label className="settings-label">Active Synced Libraries</label>
              <div className="synced-library-card">
                <div className="synced-library-header">
                  <div className="synced-library-title">
                    <FolderHeart size={16} style={{ color: 'var(--color-accent-emerald)' }} />
                    <span>Kids Shared Album</span>
                  </div>
                  <span className="synced-library-badge">Synced</span>
                </div>
                <div className="synced-library-meta">
                  <p><strong>Database Target:</strong> Firestore collection <code>Current_Display_Photos</code></p>
                  <p><strong>Active Pool:</strong> {firestorePhotosCount > 0 ? `${firestorePhotosCount} randomized 1080p wallpapers` : 'Initializing sync...'}</p>
                  <p className="synced-library-note">
                    💡 <em>Syncing a new 24-photo batch overwrites the 24 active display slots in Firestore with 24 freshly randomized photos sliced from your 302-photo album.</em>
                  </p>
                </div>
              </div>
            </div>

            {/* Public shared album link & Firestore Sync status */}
            <div className="settings-group">
              <label className="settings-label">Google Photos Album Share Link</label>
              <input
                type="text"
                value={config.googlePhotosSharedLink}
                onChange={(e) => setConfig({ ...config, googlePhotosSharedLink: e.target.value })}
                placeholder="https://photos.app.goo.gl/..."
                className="settings-input"
              />
              <div style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', marginTop: '0.45rem' }}>
                <span className="settings-label" style={{ fontSize: '0.78rem' }}>Firestore Database Sync Status:</span>
                <p className="settings-subtext" style={{ fontSize: '0.78rem', color: firestorePhotosCount > 0 ? 'var(--color-accent-emerald)' : 'var(--color-accent-amber)', fontWeight: 'bold', marginTop: '0.15rem' }}>
                  {firestorePhotosCount > 0
                    ? `✓ Firestore Database: ${firestorePhotosCount} active randomized 1080p wallpapers` 
                    : '⚠ Initializing Firestore database sync...'}
                </p>
                <button
                  type="button"
                  onClick={triggerAlbumSyncToFirestore}
                  disabled={isSyncingPhotos}
                  className="settings-btn settings-btn-primary"
                  style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <RefreshCw size={14} className={isSyncingPhotos ? 'animate-spin' : ''} />
                  {isSyncingPhotos ? 'Syncing Album to Firestore...' : 'Sync New 24-Photo Batch to Firestore'}
                </button>
              </div>
              <p className="settings-subtext" style={{ fontSize: '0.72rem', marginTop: '0.45rem', lineHeight: '1.4' }}>
                1. Open your album in Google Photos on your phone or web.<br/>
                2. Click <strong>Share</strong> and generate a public link.<br/>
                3. Copy and paste that link above.<br/>
                <em>Note: No API Keys or Google Client configuration is required for wallpapers using this method!</em>
              </p>
            </div>
          </div>

          {/* COLLAPSIBLE DEVELOPER SETTINGS */}
          <div className="settings-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="settings-reset-link"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              <span>{isAdvancedOpen ? '▼ Hide Developer Settings' : '▶ Show Developer Settings'}</span>
            </button>

            {isAdvancedOpen && (
              <div style={{ marginTop: '1rem' }}>
                <div className="settings-group">
                  <label className="settings-label">Google OAuth Client ID</label>
                  <input
                    type="text"
                    value={config.googleClientId}
                    onChange={(e) => setConfig({ ...config, googleClientId: e.target.value })}
                    placeholder="Google OAuth Client ID"
                    className="settings-input"
                  />
                  <p className="settings-subtext" style={{ marginTop: '0.35rem' }}>
                    Required to authorize your local browser to sync with Google Calendar and Tasks.
                  </p>
                </div>

                <div className="settings-group" style={{ marginTop: '0.85rem' }}>
                  <label className="settings-label">Live App Cache</label>
                  <button
                    type="button"
                    onClick={() => {
                      if ('caches' in window) {
                        caches.keys().then((names) => {
                          names.forEach((name) => caches.delete(name));
                        });
                      }
                      window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
                    }}
                    className="settings-btn settings-btn-secondary"
                    style={{ width: '100%', marginTop: '0.35rem', padding: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-accent-amber)' }}
                  >
                    <RefreshCw size={15} /> Force Hard Refresh Live App
                  </button>
                  <p className="settings-subtext" style={{ marginTop: '0.35rem' }}>
                    Clears web app cache and reloads the latest live code update from Firebase.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="settings-footer">
          <div className="settings-footer-info">
            <Info size={14} />
            <span>Settings stored locally.</span>
          </div>
          <button 
            onClick={() => {
              if (window.confirm('Reset settings to default?')) {
                setConfig(DEFAULT_CONFIG);
                handleDisconnectGoogle();
              }
            }}
            className="settings-reset-link"
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
