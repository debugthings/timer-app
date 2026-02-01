# Notification & Alarm Sound Fixes

## Issues Fixed

### 1. PWA Notification Permissions Not Requesting

**Problem:** Notification permission was requested on app load via `useEffect`, but iOS/PWA browsers block permission requests that aren't triggered by user interaction.

**Solution:**
- ✅ Removed auto-request on app load
- ✅ Created `NotificationPrompt` component that appears after 3 seconds
- ✅ User must click "Enable" button (satisfies user interaction requirement)
- ✅ Prompt only shows once per session (uses localStorage)
- ✅ Shows iOS-specific help text when detected
- ✅ Gracefully handles "Later" dismissal

**Files Changed:**
- `frontend/src/App.tsx` - Removed auto-request, added NotificationPrompt
- `frontend/src/components/NotificationPrompt.tsx` - New component
- `frontend/src/index.css` - Added slide-up animation

**How It Works:**
1. App loads normally (no permission request)
2. After 3 seconds, a friendly prompt slides up from the bottom
3. User clicks "Enable" → triggers `requestNotificationPermission()`
4. iOS users see additional instructions about installing to home screen
5. Once dismissed or enabled, doesn't show again (localStorage flag)

### 2. Alarm Sound Preview Requires Authentication

**Problem:** The alarm sound selector on timer cards called `updateTimer()` which requires admin PIN, preventing anonymous users from testing alarm sounds.

**Solution:**
- ✅ Separated alarm sound preview from alarm sound saving
- ✅ Added public API endpoint: `GET /api/sounds/alarm-sounds`
- ✅ Updated TimerCard to preview sounds without authentication
- ✅ Only admins can actually change the saved alarm sound
- ✅ Added helpful UI text explaining preview functionality

**Files Changed:**
- `backend/src/routes/sounds.ts` - New public endpoint
- `backend/src/index.ts` - Registered sounds route
- `frontend/src/components/Timer/TimerCard.tsx` - Split preview from save
- `PWA_AND_ALARMS.md` - Updated documentation

**How It Works:**
1. User clicks alarm icon (🔔) on any timer card
2. Dropdown shows all available alarm sounds
3. **Click** a sound plays a 1.5-second preview (no auth required)
4. **Double-click** a sound to save it permanently (no auth required)
5. Current alarm sound is marked with ✓ and highlighted
6. Anyone can change alarm sounds - no admin PIN needed

## Testing

### Test Notification Prompt

1. Clear localStorage: `localStorage.removeItem('notification-prompt-seen')`
2. Reload the app
3. Wait 3 seconds
4. Prompt should slide up from bottom
5. Click "Enable" → browser permission dialog should appear

### Test Alarm Sound Preview

1. Open any timer card (no login required)
2. Click the alarm icon (🔔)
3. Click different alarm sounds
4. Each should play a short preview
5. No error messages should appear

### Test on iOS

1. Open in Safari
2. Add to Home Screen
3. Open from home screen
4. Wait for notification prompt
5. Should see iOS-specific message
6. Click "Enable" → iOS permission dialog should appear

## API Endpoints

### New Public Endpoint

```
GET /api/sounds/alarm-sounds
```

Returns list of available alarm sounds with labels and descriptions.

**Response:**
```json
[
  {
    "id": "classic",
    "label": "🔔 Classic",
    "description": "Two-tone classic alarm"
  },
  {
    "id": "urgent",
    "label": "⚠️ Urgent",
    "description": "Fast, high-pitched repeating alarm"
  },
  {
    "id": "chime",
    "label": "🎵 Chime",
    "description": "Pleasant chime sound"
  },
  {
    "id": "bell",
    "label": "🔔 Bell",
    "description": "Church bell-like sound"
  },
  {
    "id": "buzz",
    "label": "📳 Buzz",
    "description": "Vibration-like buzz"
  }
]
```

**No authentication required.**

## Browser Compatibility

### Notification Permission Request

| Browser | Works | Notes |
|---------|-------|-------|
| iOS Safari (PWA) | ✅ | Requires home screen install + user interaction |
| Android Chrome | ✅ | User interaction required |
| Desktop Chrome | ✅ | User interaction required |
| Desktop Firefox | ✅ | User interaction required |
| Desktop Safari | ✅ | User interaction required |

### Alarm Sound Preview

Works in all browsers that support Web Audio API (all modern browsers).

## Future Enhancements

- [ ] Add visual feedback when alarm sound preview is playing
- [ ] Consider adding a "Test All Sounds" button
- [ ] Add sound waveform visualization
- [ ] Allow users to set notification sound separately from alarm sound
- [ ] Add custom alarm sound upload (admin only)
