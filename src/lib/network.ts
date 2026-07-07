export interface DeliveryMetadata {
  senderIp?: string;
  senderCity?: string;
  senderRegion?: string;
  senderCountry?: string;
  senderLat?: number;
  senderLon?: number;
  senderIsp?: string;
  senderNetworkType?: string;
  senderDownlink?: number;
  senderRtt?: number;
  highPrecision?: boolean;
  userAgent?: string;
}

let cachedMetadata: DeliveryMetadata | null = null;

export async function fetchNetworkAndLocation(): Promise<DeliveryMetadata> {
  if (cachedMetadata) {
    // If we have a cached version, we can return it or quickly refresh
    return cachedMetadata;
  }

  const metadata: DeliveryMetadata = {
    userAgent: navigator.userAgent,
  };

  // Get browser network information
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      metadata.senderNetworkType = conn.effectiveType || conn.type || 'unknown';
      metadata.senderDownlink = conn.downlink || 0;
      metadata.senderRtt = conn.rtt || 0;
    }
  }

  try {
    // Fetch IP and Geo details via a free CORS-enabled service
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      metadata.senderIp = data.ip;
      metadata.senderCity = data.city;
      metadata.senderRegion = data.region;
      metadata.senderCountry = data.country_name;
      metadata.senderLat = data.latitude;
      metadata.senderLon = data.longitude;
      metadata.senderIsp = data.org || data.asn;
    }
  } catch (error) {
    console.warn('IP Geo lookup failed, falling back to local info:', error);
  }

  // Optionally try high-precision GPS if permission already granted or requested
  try {
    const geoPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (geoPermission.state === 'granted') {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000
        });
      });
      metadata.senderLat = position.coords.latitude;
      metadata.senderLon = position.coords.longitude;
      metadata.highPrecision = true;
    }
  } catch (err) {
    // Ignore, fallback to IP geo
  }

  cachedMetadata = metadata;
  return metadata;
}

export async function requestHighPrecisionLocation(): Promise<DeliveryMetadata> {
  const metadata = await fetchNetworkAndLocation();
  
  return new Promise<DeliveryMetadata>((resolve) => {
    if (!navigator.geolocation) {
      resolve(metadata);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        metadata.senderLat = position.coords.latitude;
        metadata.senderLon = position.coords.longitude;
        metadata.highPrecision = true;
        cachedMetadata = metadata;
        resolve(metadata);
      },
      () => {
        // Fallback to existing
        resolve(metadata);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}
