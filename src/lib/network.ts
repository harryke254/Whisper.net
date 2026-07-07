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
    return cachedMetadata;
  }

  const metadata: DeliveryMetadata = {
    userAgent: navigator.userAgent,
  };

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      metadata.senderNetworkType = conn.effectiveType || conn.type || 'unknown';
      metadata.senderDownlink = conn.downlink || 0;
      metadata.senderRtt = conn.rtt || 0;
    }
  }

  try {
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
    // Ignore fallback
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
        resolve(metadata);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export function generateStableMetadata(id: string): DeliveryMetadata {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const cities = ['Berlin', 'Nairobi', 'London', 'Tokyo', 'Reykjavik', 'Singapore', 'Cape Town', 'Sao Paulo', 'Sydney', 'Lagos', 'Toronto', 'Munich', 'Rome'];
  const countries = ['Germany', 'Kenya', 'United Kingdom', 'Japan', 'Iceland', 'Singapore', 'South Africa', 'Brazil', 'Australia', 'Nigeria', 'Canada', 'Germany', 'Italy'];
  const isps = ['Deutsche Telekom AG', 'Safaricom PLC', 'BT Group plc', 'NTT Communications', 'Syminet Corp', 'Starhub Ltd', 'Telkom South Africa', 'Claro S.A.', 'Telstra Corporation', 'MTN Nigeria Communications', 'Rogers Communications', 'Vodafone Germany', 'Telecom Italia'];
  const connTypes = ['4G LTE', '5G NR', 'Fiber Optic', 'Broadband', 'Satellite Orbit'];
  
  const index = Math.abs(hash) % cities.length;
  
  const ipPart1 = (Math.abs(hash) % 223) + 1;
  const ipPart2 = (Math.abs(hash >> 2) % 255);
  const ipPart3 = (Math.abs(hash >> 4) % 255);
  const ipPart4 = (Math.abs(hash >> 6) % 254) + 1;
  const stableIp = `${ipPart1}.${ipPart2}.${ipPart3}.${ipPart4}`;
  
  const lat = 50 + (hash % 10) + ((hash % 100) / 100);
  const lon = 10 + ((hash >> 3) % 20) + (((hash >> 2) % 100) / 100);
  
  return {
    senderIp: stableIp,
    senderCity: cities[index],
    senderCountry: countries[index],
    senderIsp: isps[index],
    senderNetworkType: connTypes[Math.abs(hash >> 3) % connTypes.length],
    senderDownlink: (Math.abs(hash >> 2) % 150) + 10,
    senderRtt: (Math.abs(hash >> 1) % 120) + 5,
    senderLat: lat,
    senderLon: lon,
    highPrecision: false,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  };
}
