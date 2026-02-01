# PWA & Alarm Features

## Progressive Web App (PWA) Features

### Overview
The Timer App now supports PWA functionality with offline capabilities, push notifications, and native app-like experience.

### iOS Notification Support

**Important for iOS Users:**

iOS requires the app to be installed as a PWA to enable notifications. Follow these steps:

1. **Open in Safari** (required for iOS)
2. **Add to Home Screen**:
   - Tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Tap "Add" to confirm
3. **Open the app from your home screen**
4. **Enable notifications** when prompted (appears after a few seconds)
   - Click "Enable" to grant notification permissions
   - This prompt appears automatically with user interaction

**iOS Limitations:**
- Notifications ONLY work when the app is added to home screen
- Must use Safari to install (Chrome/Firefox won't work)
- Requires iOS 16.4 or later for full push notification support
- Notifications appear as system notifications with sound and vibration
- Permission request requires user interaction (button click, not auto-request)

### Desktop/Android Support

**Desktop** (Chrome, Edge, Firefox):
- Click the install button in the address bar
- Or use browser menu → "Install Timer App"
- A notification prompt will appear after 3 seconds - click "Enable"
- Notifications work immediately after granting permission

**Android** (Chrome, Samsung Internet):
- Tap "Add to Home Screen" prompt
- Or use browser menu → "Add to Home Screen"
- A notification prompt will appear - click "Enable" to grant permission
- Notifications work with full system integration

### Features

✅ **Offline Mode**: View timers and data when offline  
✅ **Install Prompt**: Add to home screen for native app experience  
✅ **Push Notifications**: Get alerts when timers complete or expire (with user interaction prompt)  
✅ **Background Sync**: Updates sync when connection returns  
✅ **App Icons**: Custom icons for home screen  
✅ **Smart Permission Prompt**: Notification prompt appears automatically after 3 seconds (requires user click)  

---

## Alarm Sound System

### Overview
Each timer can have its own alarm sound. **All users can preview alarm sounds without authentication** - just click on the alarm icon (🔔) on any timer card to hear different alarm options.

### Public Alarm Sound API

A public, unauthenticated endpoint is available for listing alarm sounds:

```
GET /api/sounds/alarm-sounds
```

Returns:
```json
[
  { "id": "classic", "label": "🔔 Classic", "description": "Two-tone classic alarm" },
  { "id": "urgent", "label": "⚠️ Urgent", "description": "Fast, high-pitched repeating alarm" },
  { "id": "chime", "label": "🎵 Chime", "description": "Pleasant chime sound" },
  { "id": "bell", "label": "🔔 Bell", "description": "Church bell-like sound" },
  { "id": "buzz", "label": "📳 Buzz", "description": "Vibration-like buzz" }
]
```

**Note:** Changing the saved alarm sound for a timer requires admin authentication. However, previewing sounds is available to everyone.

### Available Alarm Sounds

1. **🔔 Classic** - Traditional two-tone alarm (default)
   - Moderate urgency, pleasant tones
   - Repeats every 1.5 seconds

2. **⚠️ Urgent** - Fast, high-pitched repeating beeps
   - Maximum attention-grabbing
   - Repeats every 0.8 seconds

3. **🎵 Chime** - Pleasant melodic chime
   - Gentle, musical tones
   - Repeats every 2 seconds

4. **🔔 Bell** - Church bell-like sound
   - Deep, resonant tone
   - Repeats every 2.5 seconds

5. **📳 Buzz** - Vibration-like buzz pattern
   - Multiple short bursts
   - Repeats every 1.2 seconds

### How to Change Alarm Sound

**From Timer Card (Dashboard):**
1. Click the alarm icon (🔔) below the timer name
2. Select your preferred sound from the dropdown
3. Sound plays a preview automatically
4. No admin approval required!

**Preview Sounds:**
When you select a new alarm, it plays once so you can hear it before committing.

### Alarm Behavior

**When Timer Completes:**
- Continuous alarm plays using selected sound
- Full-screen acknowledgment modal appears
- Alarm continues until acknowledged
- Browser notification sent (if enabled)
- Vibration pattern triggered (on mobile)

**On Timer Card:**
- Alarm modal appears on dashboard card
- Shows timer name and person
- Big red "Acknowledge" button to stop alarm

**On Timer Detail Page:**
- Same acknowledgment system
- Includes additional timer information

### Technical Details

- **Audio Generation**: Web Audio API (no external files needed)
- **Customization**: Per-timer settings stored in database
- **User Control**: No admin approval required for sound changes
- **Performance**: Lightweight, browser-native sound generation

---

## Testing the Features

### Test PWA Installation

1. Build and deploy the app
2. Access via HTTPS (required for PWA)
3. Look for install prompt in browser
4. Install and test offline mode

### Test Alarm Sounds

1. Create a timer with short duration (e.g., 10 seconds)
2. Start a checkout
3. Change alarm sound while timer is running
4. Wait for timer to complete
5. Verify correct alarm sound plays
6. Test acknowledgment button

### Test iOS Notifications

1. Open app in Safari on iOS device
2. Add to Home Screen
3. Open from home screen (not Safari)
4. Grant notification permissions
5. Start a timer and let it complete
6. Verify notification appears in iOS notification center

---

## Database Schema

### Timer Model
```prisma
model Timer {
  // ... existing fields
  alarmSound String @default("classic") // Alarm sound type
  // Allowed values: classic, urgent, chime, bell, buzz
}
```

---

## API Updates

### Create Timer
```typescript
POST /api/timers
{
  "name": "Screen Time",
  "personId": "...",
  "defaultDailySeconds": 3600,
  "alarmSound": "chime"  // Optional, defaults to "classic"
}
```

### Update Timer
```typescript
PUT /api/timers/:id
{
  "alarmSound": "urgent"  // No admin pin required for this field
}
```

---

## Browser Compatibility

### PWA Support
| Browser | Installation | Notifications | Offline |
|---------|-------------|---------------|---------|
| Chrome Desktop | ✅ | ✅ | ✅ |
| Edge Desktop | ✅ | ✅ | ✅ |
| Firefox Desktop | ✅ | ✅ | ✅ |
| Safari Desktop | ✅ | ✅ | ✅ |
| Safari iOS | ✅* | ✅* | ✅ |
| Chrome Android | ✅ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | ✅ |

*iOS requires Add to Home Screen for full functionality

### Audio Support
All modern browsers support Web Audio API for alarm sounds.

---

## Troubleshooting

### iOS Notifications Not Working
1. ✅ Verify iOS 16.4 or later
2. ✅ Installed via Safari (not Chrome/Firefox)
3. ✅ Added to Home Screen
4. ✅ Opened from Home Screen icon (not Safari)
5. ✅ Granted notification permissions
6. ✅ Check Settings → Timer App → Notifications

### Alarm Not Playing
1. ✅ Check device volume
2. ✅ Disable silent/vibrate mode
3. ✅ Check browser's site permissions for audio
4. ✅ Try different alarm sound (some may be quieter)

### PWA Not Installing
1. ✅ Ensure HTTPS is enabled
2. ✅ Check manifest.json is accessible
3. ✅ Verify service worker is registered
4. ✅ Clear browser cache and try again

### Service Worker Issues
```bash
# Check service worker status in browser console
navigator.serviceWorker.getRegistrations()

# Manually register
navigator.serviceWorker.register('/sw.js')
```
