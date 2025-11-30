// WebRTC Connection Diagnostics Utility
// Use this to monitor connection quality and TURN server usage

export interface ConnectionStats {
  connectionType: 'direct' | 'stun' | 'turn' | 'unknown';
  localCandidateType: string;
  remoteCandidateType: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsLost: number;
  roundTripTime?: number;
  availableIncomingBitrate?: number;
  availableOutgoingBitrate?: number;
}

export async function getConnectionStats(
  peerConnection: RTCPeerConnection
): Promise<ConnectionStats | null> {
  try {
    const stats = await peerConnection.getStats();
    let connectionStats: ConnectionStats | null = null;

    stats.forEach((report) => {
      // Find the active candidate pair
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        const localType = report.localCandidateType || 'unknown';
        const remoteType = report.remoteCandidateType || 'unknown';

        // Determine connection type
        let connectionType: ConnectionStats['connectionType'] = 'unknown';
        
        if (localType === 'host' && remoteType === 'host') {
          connectionType = 'direct'; // Best: Direct P2P
        } else if (localType === 'srflx' || remoteType === 'srflx') {
          connectionType = 'stun'; // Good: Through STUN
        } else if (localType === 'relay' || remoteType === 'relay') {
          connectionType = 'turn'; // Works: Through TURN relay
        }

        connectionStats = {
          connectionType,
          localCandidateType: localType,
          remoteCandidateType: remoteType,
          bytesReceived: report.bytesReceived || 0,
          bytesSent: report.bytesSent || 0,
          packetsReceived: report.packetsReceived || 0,
          packetsLost: report.packetsLost || 0,
          roundTripTime: report.currentRoundTripTime,
          availableIncomingBitrate: report.availableIncomingBitrate,
          availableOutgoingBitrate: report.availableOutgoingBitrate,
        };
      }
    });

    return connectionStats;
  } catch (error) {
    console.error('Error getting connection stats:', error);
    return null;
  }
}

export function formatBitrate(bitsPerSecond: number | undefined): string {
  if (!bitsPerSecond) return 'N/A';
  
  const kbps = bitsPerSecond / 1000;
  const mbps = kbps / 1000;
  
  if (mbps >= 1) {
    return `${mbps.toFixed(2)} Mbps`;
  }
  return `${kbps.toFixed(2)} Kbps`;
}

export function getConnectionQuality(stats: ConnectionStats): {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  message: string;
  color: string;
} {
  const { connectionType, roundTripTime, packetsLost, packetsReceived } = stats;
  
  // Calculate packet loss percentage
  const totalPackets = packetsReceived + packetsLost;
  const packetLossPercentage = totalPackets > 0 
    ? (packetsLost / totalPackets) * 100 
    : 0;

  // Excellent: Direct P2P with low latency
  if (
    connectionType === 'direct' && 
    roundTripTime && roundTripTime < 0.05 && 
    packetLossPercentage < 0.5
  ) {
    return {
      quality: 'excellent',
      message: 'Excellent connection (Direct P2P)',
      color: 'green',
    };
  }

  // Good: STUN or direct with acceptable latency
  if (
    (connectionType === 'direct' || connectionType === 'stun') && 
    roundTripTime && roundTripTime < 0.15 && 
    packetLossPercentage < 2
  ) {
    return {
      quality: 'good',
      message: 'Good connection',
      color: 'blue',
    };
  }

  // Fair: TURN relay or higher latency
  if (
    connectionType === 'turn' || 
    (roundTripTime && roundTripTime < 0.3 && packetLossPercentage < 5)
  ) {
    return {
      quality: 'fair',
      message: 'Fair connection (Using relay server)',
      color: 'yellow',
    };
  }

  // Poor: High latency or packet loss
  return {
    quality: 'poor',
    message: 'Poor connection quality',
    color: 'red',
  };
}

export function logConnectionInfo(stats: ConnectionStats): void {
  const quality = getConnectionQuality(stats);
  
  console.log('=== WebRTC Connection Info ===');
  console.log(`Connection Type: ${stats.connectionType.toUpperCase()}`);
  console.log(`Local Candidate: ${stats.localCandidateType}`);
  console.log(`Remote Candidate: ${stats.remoteCandidateType}`);
  console.log(`Quality: ${quality.quality.toUpperCase()} - ${quality.message}`);
  console.log(`Round Trip Time: ${stats.roundTripTime ? (stats.roundTripTime * 1000).toFixed(2) + 'ms' : 'N/A'}`);
  console.log(`Packets Lost: ${stats.packetsLost} / ${stats.packetsReceived + stats.packetsLost}`);
  console.log(`Incoming Bitrate: ${formatBitrate(stats.availableIncomingBitrate)}`);
  console.log(`Outgoing Bitrate: ${formatBitrate(stats.availableOutgoingBitrate)}`);
  console.log('==============================');
}

// Hook for monitoring connection stats in React components
export function useConnectionMonitor(
  peerConnection: RTCPeerConnection | null,
  interval: number = 5000
): ConnectionStats | null {
  const [stats, setStats] = React.useState<ConnectionStats | null>(null);

  React.useEffect(() => {
    if (!peerConnection) return;

    const updateStats = async () => {
      const connectionStats = await getConnectionStats(peerConnection);
      if (connectionStats) {
        setStats(connectionStats);
        // Optionally log to console in development
        if (process.env.NODE_ENV === 'development') {
          logConnectionInfo(connectionStats);
        }
      }
    };

    // Initial check
    updateStats();

    // Periodic updates
    const intervalId = setInterval(updateStats, interval);

    return () => clearInterval(intervalId);
  }, [peerConnection, interval]);

  return stats;
}

// React import (add this at the top of the file when using in a React component)
import * as React from 'react';
