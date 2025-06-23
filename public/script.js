const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream, peer;

async function start() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  socket.emit('findPartner', { userId: getUserId(), gender: null });
}

function getUserId() {
  let id = localStorage.getItem('userId');
  if (!id) {
    id = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', id);
  }
  return id;
}

socket.on('partnerFound', async (partnerId) => {
  peer = createPeer(partnerId);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
});

socket.on('signal', async ({ from, signal }) => {
  if (!peer) {
    peer = createPeer(from, false);
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  }
  await peer.setRemoteDescription(new RTCSessionDescription(signal));
  if (signal.type === 'offer') {
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit('signal', { to: from, signal: peer.localDescription });
  }
});

function createPeer(partnerId, initiator = true) {
  const pc = new RTCPeerConnection();
  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', { to: partnerId, signal: e.candidate });
    }
  };
  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };
  if (initiator) {
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: partnerId, signal: pc.localDescription });
    };
  }
  return pc;
}

document.getElementById('nextBtn').onclick = () => {
  if (peer) peer.close();
  start();
};

document.getElementById('disconnectBtn').onclick = () => {
  if (peer) peer.close();
  localVideo.srcObject.getTracks().forEach(track => track.stop());
  remoteVideo.srcObject = null;
};
start();