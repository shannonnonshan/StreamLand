// utils/ice.ts
// ICE servers configuration for WebRTC connections
// STUN servers help discover public IP addresses
// TURN servers relay traffic when direct P2P connection fails (firewall/NAT)

export const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers (free, public, very reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // Metered TURN servers (Free tier: 50GB/month)
  // IMPORTANT: Verify these credentials are still valid at https://www.metered.ca/tools/openrelay/
  // If connection fails, generate new free credentials from the link above
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'e0c7c28f8a0976f14ae68a6d',
    credential: 'CZMjkRQQh+FIEeZ/',
  },
  {
    urls: 'turn:a.relay.metered.ca:80?transport=udp',
    username: 'e0c7c28f8a0976f14ae68a6d',
    credential: 'CZMjkRQQh+FIEeZ/',
  },
  {
    urls: 'turn:a.relay.metered.ca:80?transport=tcp',
    username: 'e0c7c28f8a0976f14ae68a6d',
    credential: 'CZMjkRQQh+FIEeZ/',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'e0c7c28f8a0976f14ae68a6d',
    credential: 'CZMjkRQQh+FIEeZ/',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'e0c7c28f8a0976f14ae68a6d',
    credential: 'CZMjkRQQh+FIEeZ/',
  },
  
  // Backup Twilio STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
];
