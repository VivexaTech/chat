import type { LocationData } from '../types/chat.types';

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function getCurrentLocation(options?: PositionOptions): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error(
                'Location permission was denied. Allow location access in your browser settings to share your position.',
              ),
            );
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information is currently unavailable.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Timed out while retrieving your location. Please try again.'));
            break;
          default:
            reject(new Error('Unable to retrieve your current location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
        ...options,
      },
    );
  });
}
