const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let peer;
let currentPartner = null;

async function init() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket.emit('findPartner', { userId: getUserId(), gender: null });
}

function getUserId() {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = 'user-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('userId', id);
  }
  return id;
}

socket.on('partnerFound', async (partnerId) => {
  currentPartner = partnerId;
  createPeerConnection(partnerId, true);
});

socket.on('signal', async ({ from, signal }) => {
  if (!peer) {
    currentPartner = from;
    createPeerConnection(from, false);
  }

  if (signal.type) {
    await peer.setRemoteDescription(new RTCSessionDescription(signal));
    if (signal.type === 'offer') {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('signal', { to: from, signal: peer.localDescription });
    }
  } else {
    try {
      await peer.addIceCandidate(new RTCIceCandidate(signal));
    } catch (err) {
      console.warn('Error adding ICE candidate', err);
    }
  }
});

socket.on('userDisconnected', (id) => {
  if (id === currentPartner) {
    console.log('Partner disconnected');
    cleanup();
  }
});

function createPeerConnection(partnerId, isInitiator) {
  peer = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('signal', { to: partnerId, signal: e.candidate });
    }
  };

  peer.ontrack = (e) => {
    console.log('Remote stream added');
    remoteVideo.srcObject = e.streams[1];
  };

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  if (isInitiator) {
    peer.onnegotiationneeded = async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('signal', { to: partnerId, signal: peer.localDescription });
      } catch (err) {
        console.error('Negotiation error:', err);
      }
    };
  }
}

function cleanup() {
  if (peer) {
    peer.close();
    peer = null;
  }
  remoteVideo.srcObject = null;
}

document.getElementById('nextBtn').onclick = () => {
  cleanup();
  socket.emit('findPartner', { userId: getUserId(), gender: null });
};

document.getElementById('disconnectBtn').onclick = () => {
  cleanup();
  localVideo.srcObject.getTracks().forEach(track => track.stop());
  remoteVideo.srcObject = null;
};
init();
