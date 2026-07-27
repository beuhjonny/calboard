# Tasks - Google Photos Shared Album Scraper & Keyless Weather

- [x] Pivot photo frame integration from Google Drive to public Google Photos Shared Album link scraper
- [x] Swap proxy fetch to stable AllOrigins JSON wrapper API to bypass raw CORS throttling blocks
- [x] Refine scraper regex to strictly target pw/ and lr/ subdirectories, preventing matching garbage assets
- [x] Fix todo input width styling with min-width: 0 to prevent the "+" button overflowing narrow panels
- [x] Add justify-content: space-between to panels-container to right-align the Todo list and split the panels apart
- [x] Replace shared center resizer with independent side-resizers on the inner edge of each panel
- [x] Persist both leftWidth and rightWidth variables independently in browser localStorage
- [x] Implement settings slider for Panel Opacity (10% to 90%)
- [x] Implement settings slider for Background Dimming (0% to 90%)
- [x] Restore smooth visual Ken Burns crossfade for scraped background images
- [x] Update Settings drawer UI to take Google Photos Share Link and display instructions
- [x] Tighten layout spacing in Calendar cards, groups, and list containers
- [x] Enlarge digital clock time display for across-the-room readability
- [x] Prevent mock data flash by starting lists empty and introducing skeleton loading states
- [x] Implement live keyless Open-Meteo API weather fetching and unit auto-detection
- [x] Remove Weather API Key and Google API Key fields from Settings drawer
- [x] Hide Google Client ID inside a collapsible Developer Settings accordion
- [x] Verify production build compiles warning-free
