import { io } from "socket.io-client";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

let socket;
let peerConnection;
let currentSenderSocketId;

function cleanupPeer() {
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
  }
  peerConnection = null;
  currentSenderSocketId = null;
}

export function createViewerClient({
  backendUrl,
  onConnected,
  onDisconnected,
  onDevices,
  onRemoteStream,
  onStatus,
  onDeviceOffline
}) {
  socket = io(backendUrl, {
    transports: ["websocket"],
    reconnection: true
  });

  socket.on("connect", () => {
    onConnected?.();
    onStatus?.("Connected");
    socket.emit("viewer:get-devices", {}, (response) => {
      if (response?.ok) onDevices?.(response.devices || []);
    });
  });

  socket.on("disconnect", () => {
    onDisconnected?.();
    onStatus?.("Disconnected. Reconnecting...");
    cleanupPeer();
  });

  socket.on("devices:list", (devices) => {
    onDevices?.(devices || []);
  });

  socket.on("viewer:device-offline", ({ deviceId }) => {
    onDeviceOffline?.(deviceId);
    onStatus?.("Selected device went offline");
    cleanupPeer();
  });

  socket.on("webrtc:offer", async ({ from, sdp }) => {
    if (!sdp) return;
    currentSenderSocketId = from;

    if (!peerConnection) {
      peerConnection = new RTCPeerConnection(rtcConfig);

      peerConnection.ontrack = (event) => {
        const stream = event.streams?.[0];
        if (stream) onRemoteStream?.(stream);
      };

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !currentSenderSocketId) return;
        socket.emit("webrtc:ice-candidate", {
          to: currentSenderSocketId,
          candidate: event.candidate
        });
      };

      peerConnection.onconnectionstatechange = () => {
        onStatus?.(`Peer: ${peerConnection.connectionState}`);
      };
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("webrtc:answer", { to: from, sdp: answer });
  });

  socket.on("webrtc:ice-candidate", async ({ candidate }) => {
    if (!peerConnection || !candidate) return;
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {
      // Ignore stale candidates.
    }
  });

  return {
    watchDevice: (deviceId) =>
      new Promise((resolve) => {
        cleanupPeer();
        socket.emit("viewer:watch-device", { deviceId }, (response) => {
          if (!response?.ok) {
            onStatus?.(response?.error || "Failed to watch device");
          } else {
            onStatus?.("Waiting for stream...");
          }
          resolve(response);
        });
      }),
    disconnect: () => {
      cleanupPeer();
      socket?.close();
    }
  };
}
