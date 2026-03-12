// testTurnConnectivity.ts
// Utility to test if TURN servers are working correctly
// Run this in browser console to debug cross-network connection issues

import { ICE_SERVERS } from './ice';

export async function testTurnConnectivity(): Promise<void> {
  console.log('🔍 Testing TURN Server Connectivity...');
  console.log('This will help diagnose cross-network connection issues.\n');

  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceTransportPolicy: 'relay', // Force TURN only
  });

  const candidateTypes = {
    host: 0,
    srflx: 0,
    relay: 0,
  };

  return new Promise((resolve) => {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type as 'host' | 'srflx' | 'relay';
        candidateTypes[type]++;
        
        console.log(`✓ Found ${type} candidate:`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
        });
      } else {
        // ICE gathering complete
        console.log('\n📊 Test Results:');
        console.log(`   Host candidates (local): ${candidateTypes.host}`);
        console.log(`   Srflx candidates (STUN): ${candidateTypes.srflx}`);
        console.log(`   Relay candidates (TURN): ${candidateTypes.relay}`);
        
        if (candidateTypes.relay > 0) {
          console.log('\n✅ SUCCESS: TURN servers are working!');
          console.log('   Your cross-network livestreaming should work.');
        } else {
          console.log('\n❌ FAILURE: No TURN relay candidates found!');
          console.log('   Cross-network connections may fail.');
          console.log('   Possible issues:');
          console.log('   1. TURN credentials expired');
          console.log('   2. TURN servers are down');
          console.log('   3. Network/firewall blocking TURN ports');
        }
        
        pc.close();
        resolve();
      }
    };

    // Create a data channel to trigger ICE gathering
    pc.createDataChannel('test');
    
    // Create offer to start ICE gathering
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch((error) => {
        console.error('❌ Error creating offer:', error);
        pc.close();
        resolve();
      });
  });
}

// For easy testing in browser console:
if (typeof window !== 'undefined') {
  (window as any).testTurnConnectivity = testTurnConnectivity;
}
