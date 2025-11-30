'use client';

import { useEffect, useState } from 'react';
import { 
  SignalIcon, 
  SignalSlashIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { 
  getConnectionStats, 
  getConnectionQuality, 
  formatBitrate,
  type ConnectionStats 
} from '@/utils/connectionDiagnostics';

interface ConnectionStatusProps {
  peerConnection: RTCPeerConnection | null;
  showDetails?: boolean;
}

export default function ConnectionStatus({ 
  peerConnection, 
  showDetails = false 
}: ConnectionStatusProps) {
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!peerConnection) return;

    const updateStats = async () => {
      const connectionStats = await getConnectionStats(peerConnection);
      if (connectionStats) {
        setStats(connectionStats);
      }
    };

    // Initial check
    updateStats();

    // Update every 5 seconds
    const intervalId = setInterval(updateStats, 5000);

    return () => clearInterval(intervalId);
  }, [peerConnection]);

  if (!stats) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <SignalSlashIcon className="w-4 h-4" />
        <span>Connecting...</span>
      </div>
    );
  }

  const quality = getConnectionQuality(stats);

  const getIcon = () => {
    switch (quality.quality) {
      case 'excellent':
      case 'good':
        return <SignalIcon className="w-4 h-4" />;
      case 'fair':
        return <SignalIcon className="w-4 h-4" />;
      case 'poor':
        return <ExclamationTriangleIcon className="w-4 h-4" />;
    }
  };

  const getColorClass = () => {
    switch (quality.color) {
      case 'green':
        return 'text-green-600 bg-green-50';
      case 'blue':
        return 'text-blue-600 bg-blue-50';
      case 'yellow':
        return 'text-yellow-600 bg-yellow-50';
      case 'red':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getConnectionTypeLabel = () => {
    switch (stats.connectionType) {
      case 'direct':
        return 'Direct P2P';
      case 'stun':
        return 'Via STUN';
      case 'turn':
        return 'Via TURN Relay';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="inline-block">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${getColorClass()}`}
      >
        {getIcon()}
        <span className="text-sm font-medium">
          {showDetails ? quality.message : getConnectionTypeLabel()}
        </span>
      </button>

      {isExpanded && (
        <div className="absolute mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[300px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-semibold text-gray-900">Connection Details</h3>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{getConnectionTypeLabel()}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Quality:</span>
                <span className={`font-medium ${quality.color === 'green' ? 'text-green-600' : quality.color === 'blue' ? 'text-blue-600' : quality.color === 'yellow' ? 'text-yellow-600' : 'text-red-600'}`}>
                  {quality.quality.toUpperCase()}
                </span>
              </div>

              {stats.roundTripTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Latency:</span>
                  <span className="font-medium">
                    {(stats.roundTripTime * 1000).toFixed(0)}ms
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Packet Loss:</span>
                <span className="font-medium">
                  {stats.packetsLost} / {stats.packetsReceived + stats.packetsLost}
                  {' '}
                  ({stats.packetsReceived > 0 
                    ? ((stats.packetsLost / (stats.packetsReceived + stats.packetsLost)) * 100).toFixed(2)
                    : '0'}%)
                </span>
              </div>

              {stats.availableIncomingBitrate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Incoming:</span>
                  <span className="font-medium">
                    {formatBitrate(stats.availableIncomingBitrate)}
                  </span>
                </div>
              )}

              <div className="pt-2 mt-2 border-t text-xs text-gray-500">
                <div>Local: {stats.localCandidateType}</div>
                <div>Remote: {stats.remoteCandidateType}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
