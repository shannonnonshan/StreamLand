// utils/ice.ts
// ICE servers configuration for WebRTC connections
// STUN servers help discover public IP addresses
// TURN servers relay traffic when direct P2P connection fails (firewall/NAT)

export const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers (free, public)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // Additional public STUN servers for redundancy
  { urls: 'stun:stun.services.mozilla.com' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  
  // Twilio's STUN servers (additional reliability)
  { urls: 'stun:global.stun.twilio.com:3478' },
  
  // Free TURN servers from Open Relay Project
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
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  
  // Metered.ca TURN servers (more reliable alternative)
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'e46b9f03f6e4f0e9e6e6d6f9',
    credential: 'password123',
  },
  {
    urls: 'turn:a.relay.metered.ca:80?transport=tcp',
    username: 'e46b9f03f6e4f0e9e6e6d6f9',
    credential: 'password123',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'e46b9f03f6e4f0e9e6e6d6f9',
    credential: 'password123',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'e46b9f03f6e4f0e9e6e6d6f9',
    credential: 'password123',
  },
  
  // Xirsys fallback TURN (public test servers)
  {
    urls: 'turn:numb.viagenie.ca',
    username: 'webrtc@live.com',
    credential: 'muazkh',
  },
];
