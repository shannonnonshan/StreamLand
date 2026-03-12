// utils/ice.ts
// ICE servers configuration for WebRTC connections.
// In production, prefer a self-hosted TURN server configured via NEXT_PUBLIC_WEBRTC_* env vars.

const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:global.stun.twilio.com:3478',
];

const DEFAULT_TURN_URLS = [
  'turn:openrelay.metered.ca:80',
  'turn:openrelay.metered.ca:443',
  'turn:openrelay.metered.ca:443?transport=tcp',
];

const DEFAULT_TURN_USERNAME = 'openrelayproject';
const DEFAULT_TURN_CREDENTIAL = 'openrelayproject';

function parseUrlList(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  const urls = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return urls.length > 0 ? urls : fallback;
}

function buildIceServers(): RTCIceServer[] {
  const stunUrls = parseUrlList(
    process.env.NEXT_PUBLIC_WEBRTC_STUN_URLS,
    DEFAULT_STUN_URLS,
  );
  const turnUrls = parseUrlList(
    process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS,
    DEFAULT_TURN_URLS,
  );
  const turnUsername =
    process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME?.trim() ||
    DEFAULT_TURN_USERNAME;
  const turnCredential =
    process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL?.trim() ||
    DEFAULT_TURN_CREDENTIAL;

  const servers: RTCIceServer[] = stunUrls.map((url) => ({ urls: url }));

  if (turnUsername && turnCredential && turnUrls.length > 0) {
    servers.push(
      ...turnUrls.map((url) => ({
        urls: url,
        username: turnUsername,
        credential: turnCredential,
      })),
    );
  }

  return servers;
}

function resolveIceTransportPolicy(): RTCIceTransportPolicy {
  const policy = process.env.NEXT_PUBLIC_WEBRTC_ICE_TRANSPORT_POLICY;
  return policy === 'relay' ? 'relay' : 'all';
}

export const ICE_SERVERS: RTCIceServer[] = buildIceServers();

// - 'all': Try direct P2P first, fallback to TURN if needed.
// - 'relay': Force traffic through TURN, useful for validating a TURN deployment.
export const ICE_TRANSPORT_POLICY: RTCIceTransportPolicy =
  resolveIceTransportPolicy();
