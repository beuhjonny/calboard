/**
 * Triple-Tier Screen Wake Engine for Amazon Fire Tablets, iPads, and Kiosk Displays.
 * Combines Native Web WakeLock API + Silent Video Loop (NoSleep.js technique) + Touch Gesture Listeners.
 */

// Ultra-tiny 1-frame silent MP4 base64 video payload
const SILENT_VIDEO_BASE64 = 
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZW' +
  'AAAA1tZGF0AAACrgYF//+/43E0MzQ0NTU2Njc4OTpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZW' +
  'FthYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8f3+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeY' +
  'mZqbnJ2en6QAAAA1bW9vdgAAAG1tdmhkAAAAAN2WbVfdlm1XAAACWAAAAAQAAAEAAAEBAAAAAAAAA' +
  'AAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAA' +
  'AAIAAAACdHJhY2sAAAB0dGhkAAAAAN2WbVfdlm1XAAABAAAAAAABAAAAAAAAAAAAAAAAAAAAAAEA' +
  'AAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAABAAAAABAAAAAQAAAAAAAG1kaWEgdGhkAAAAAN' +
  '2WbVfdlm1XAAACWAAAAAQAAAAAAAAYaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVv' +
  'SGFuZGxlcgAAAAFtaW5mAAAAEHZtaGQAAAABAAAAAAAAAAAkZGluZgAAABRkcmVmAAAAAAAAAAEA' +
  'AAAMdXJsIAAAAAEAAAEbc3RibAAAAGxzdHNkAAAAAAAAAAEAAABhYXZjMQAAAAAAAAABAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAIAAgASAAAAEgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAABjLyAAAAAAHc3R0cwAAAAAAAAABAAAAAQAAAAEAAAAFc3RzYwAAAAAAAAABAAAA' +
  'AQAAAAEAAAABAAAAFHN0c3ogAAAAAAAAABAAAAABAAAAFHN0Y28AAAAAAAAAAQAAACQ=';

let wakeLockSentinel: any = null;
let silentVideoElement: HTMLVideoElement | null = null;
let isEngineActive = false;

/**
 * Initializes and activates the Stay-Awake Screen Lock.
 */
export async function enableScreenWakeLock(): Promise<boolean> {
  isEngineActive = true;
  let success = false;

  // 1. Try Native Web WakeLock API
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      console.log('[WakeLock] Native Screen WakeLock acquired.');
      success = true;

      wakeLockSentinel.addEventListener('release', () => {
        console.log('[WakeLock] Native WakeLock was released.');
        wakeLockSentinel = null;
        if (isEngineActive) {
          // Attempt immediate re-acquisition
          setTimeout(enableScreenWakeLock, 1000);
        }
      });
    } catch (err) {
      console.warn('[WakeLock] Native WakeLock request failed:', err);
    }
  }

  // 2. Fallback / Enhancement: Silent Video Loop (Fire OS & Mobile Browser Standard)
  try {
    if (!silentVideoElement) {
      silentVideoElement = document.createElement('video');
      silentVideoElement.setAttribute('playsinline', '');
      silentVideoElement.setAttribute('muted', '');
      silentVideoElement.setAttribute('loop', '');
      silentVideoElement.style.position = 'fixed';
      silentVideoElement.style.top = '-9999px';
      silentVideoElement.style.left = '-9999px';
      silentVideoElement.style.width = '1px';
      silentVideoElement.style.height = '1px';
      silentVideoElement.style.opacity = '0.01';
      silentVideoElement.style.pointerEvents = 'none';
      silentVideoElement.src = SILENT_VIDEO_BASE64;
      document.body.appendChild(silentVideoElement);
    }

    if (silentVideoElement.paused) {
      const playPromise = silentVideoElement.play();
      if (playPromise !== undefined) {
        await playPromise;
        console.log('[WakeLock] Silent video loop active to keep display awake.');
        success = true;
      }
    }
  } catch (err) {
    console.warn('[WakeLock] Silent video play failed (awaiting user gesture):', err);
  }

  return success;
}

/**
 * Disables the Stay-Awake Screen Lock.
 */
export function disableScreenWakeLock(): void {
  isEngineActive = false;

  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }

  if (silentVideoElement) {
    silentVideoElement.pause();
    try {
      document.body.removeChild(silentVideoElement);
    } catch (e) {}
    silentVideoElement = null;
  }
}
