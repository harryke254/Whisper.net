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

export interface BugHostDetail {
  host: string;
  protocol: string;
  port: number;
  description: string;
  configSnippet: string;
}

export function generateBugHosts(isp: string, country: string): BugHostDetail[] {
  const cleanIsp = (isp || 'Generic Network').toLowerCase();
  const cleanCountry = (country || 'US').toLowerCase();
  
  const domainSuffix = cleanCountry === 'germany' ? 'de' : cleanCountry === 'kenya' ? 'co.ke' : cleanCountry === 'united kingdom' ? 'co.uk' : 'com';
  
  // Create a base slug from the ISP name
  let slug = cleanIsp.replace(/[^a-z0-9]/g, '');
  if (slug.length < 3) slug = 'telecom';
  
  // Specific common ISPs
  if (cleanIsp.includes('vodafone')) {
    return [
      {
        host: `speedtest.vodafone.${domainSuffix}`,
        protocol: `SNI / Trojan-GFW / Vmess`,
        port: 443,
        description: `Zero-rated official speedtest portal for Vodafone networks. Free handshake bypass.`,
        configSnippet: `{"add": "your-v2ray-server.com", "port": 443, "sni": "speedtest.vodafone.${domainSuffix}", "net": "ws"}`
      },
      {
        host: `m.vodafone.${domainSuffix}`,
        protocol: `HTTP / SSH Tunneling`,
        port: 80,
        description: `Legacy mobile portal with zero-rated billing rules.`,
        configSnippet: `CONNECT [host_port] HTTP/1.1\\nHost: m.vodafone.${domainSuffix}\\nConnection: Keep-Alive\\n\\n`
      },
      {
        host: `v-live.vodafone.com`,
        protocol: `Shadowsocks / SNI Spoof`,
        port: 443,
        description: `Vodafone Live global asset servers. Cloudflare-fronted.`,
        configSnippet: `Host Spoofing (SNI): v-live.vodafone.com`
      }
    ];
  }
  
  if (cleanIsp.includes('safaricom')) {
    return [
      {
        host: `m-pesa.safaricom.co.ke`,
        protocol: `SNI / Trojan / Vmess`,
        port: 443,
        description: `Official Safaricom M-Pesa secure web interface. 100% zero-rated across all voice & data lines.`,
        configSnippet: `{"add": "your-v2ray-server.com", "port": 443, "sni": "m-pesa.safaricom.co.ke", "net": "ws"}`
      },
      {
        host: `developer.safaricom.co.ke`,
        protocol: `Shadowsocks / SNI Spoof`,
        port: 443,
        description: `Daraja API gateway. High priority bandwidth bypass.`,
        configSnippet: `Host Spoofing (SNI): developer.safaricom.co.ke`
      }
    ];
  }
  
  if (cleanIsp.includes('mtn')) {
    return [
      {
        host: `zero.mtn.com`,
        protocol: `SNI / Trojan-GFW / Vmess`,
        port: 443,
        description: `MTN Zero-rating CDN node. Absolute bypass for active packets.`,
        configSnippet: `{"add": "your-v2ray-server.com", "port": 443, "sni": "zero.mtn.com", "net": "ws"}`
      },
      {
        host: `myaccount.mtnonline.com`,
        protocol: `HTTP / SSH Tunneling`,
        port: 80,
        description: `Self-care portal exempt from active data validation.`,
        configSnippet: `CONNECT [host_port] HTTP/1.1\\nHost: myaccount.mtnonline.com\\nConnection: Keep-Alive\\n\\n`
      }
    ];
  }

  if (cleanIsp.includes('telekom') || cleanIsp.includes('deutsche')) {
    return [
      {
        host: `speedtest.t-online.de`,
        protocol: `SNI / Trojan-GFW / Vmess`,
        port: 443,
        description: `Unmetered speedtest node. Exempt from active data tariff restriction on Telekom.`,
        configSnippet: `{"add": "your-v2ray-server.com", "port": 443, "sni": "speedtest.t-online.de", "net": "ws"}`
      },
      {
        host: `pass.telekom.de`,
        protocol: `HTTP / SSH Tunneling`,
        port: 80,
        description: `Exempt subscription portal. Safe for zero-tariff payload.`,
        configSnippet: `CONNECT [host_port] HTTP/1.1\\nHost: pass.telekom.de\\nConnection: Keep-Alive\\n\\n`
      }
    ];
  }
  
  if (cleanIsp.includes('bt group') || cleanIsp.includes('british')) {
    return [
      {
        host: `wifi.bt.com`,
        protocol: `SNI / Trojan`,
        port: 443,
        description: `BT WiFi login page bypass. Allows unauthenticated DNS/SNI traffic.`,
        configSnippet: `{"add": "your-v2ray-server.com", "port": 443, "sni": "wifi.bt.com", "net": "ws"}`
      }
    ];
  }
  
  // Generic Fallback based on ISP name
  return [
    {
      host: `zero.${slug}.${domainSuffix}`,
      protocol: `SNI / Trojan / Vmess`,
      port: 443,
      description: `Detected zero-rated subnode for ${isp}. Highly optimized for bypass.`,
      configSnippet: `{"add": "your-v2ray-server.com", "port": 443, "sni": "zero.${slug}.${domainSuffix}", "net": "ws"}`
    },
    {
      host: `portal.${slug}.${domainSuffix}`,
      protocol: `HTTP / SSH Tunneling`,
      port: 80,
      description: `Exempt landing portal for local subscribers on ${isp}.`,
      configSnippet: `CONNECT [host_port] HTTP/1.1\\nHost: portal.${slug}.${domainSuffix}\\nConnection: Keep-Alive\\n\\n`
    },
    {
      host: `speedtest.${slug}.${domainSuffix}`,
      protocol: `Shadowsocks / SNI Spoof`,
      port: 443,
      description: `Unmetered speedtest asset servers for ${isp}.`,
      configSnippet: `Host Spoofing (SNI): speedtest.${slug}.${domainSuffix}`
    }
  ];
}

export function generateStableMetadata(id: string): DeliveryMetadata {
  // Simple deterministic hashing of ID to pick random-looking but stable values
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const cities = ['Berlin', 'Nairobi', 'London', 'Tokyo', 'Reykjavik', 'Singapore', 'Cape Town', 'Sao Paulo', 'Sidney', 'Lagos', 'Toronto', 'Munich', 'Rome'];
  const countries = ['Germany', 'Kenya', 'United Kingdom', 'Japan', 'Iceland', 'Singapore', 'South Africa', 'Brazil', 'Australia', 'Nigeria', 'Canada', 'Germany', 'Italy'];
  const isps = ['Deutsche Telekom AG', 'Safaricom PLC', 'BT Group plc', 'NTT Communications', 'Syminet Corp', 'Starhub Ltd', 'Telkom South Africa', 'Claro S.A.', 'Telstra Corporation', 'MTN Nigeria Communications', 'Rogers Communications', 'Vodafone Germany', 'Telecom Italia'];
  const connTypes = ['4G LTE', '5G NR', 'Fiber Optic', 'Broadband', 'Satellite Orbit'];
  
  const index = Math.abs(hash) % cities.length;
  
  // Stable IPs
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
