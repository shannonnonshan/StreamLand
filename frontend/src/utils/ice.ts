// utils/ice.ts
// ICE servers configuration for WebRTC connections
// STUN servers help discover public IP addresses
// TURN servers relay traffic when direct P2P connection fails (firewall/NAT)

export const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers (free, public, very reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // Additional public STUN servers for redundancy
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  
  // Free TURN servers from Open Relay Project (Updated with current working credentials)
  // These provide relay functionality for clients behind restrictive NAT/firewalls
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  
  // Twilio STUN (additional reliability for enterprise-grade connection)
  { urls: 'stun:global.stun.twilio.com:3478' },
];
