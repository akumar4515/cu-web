import { io } from "socket.io-client";

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

let socket;
let peerConnection;
let currentSender;

function cleanup() {
  peerConnection?.close();
  peerConnection = null;
  currentSender = null;
}

export function createViewerClient({
  backendUrl,
  onRemoteStream,
  onStatus,
  onDevices
}) {
  socket = io(backendUrl, { transports: ["websocket"] });

  socket.on("connect", () => {
    onStatus("Connected");
    socket.emit("viewer:get-devices", {}, (res) => {
      if (res?.ok) onDevices(res.devices);
    });
  });

  socket.on("devices:list", (devices) => {
    onDevices(devices);
  });

  socket.on("webrtc:offer", async ({ from, sdp }) => {
    currentSender = from;

    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = (event) => {
      const stream =
        event.streams?.[0] || new MediaStream([event.track]);
      onRemoteStream(stream);
    };

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc:ice-candidate", {
          to: from,
          candidate: e.candidate
        });
      }
    };

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(sdp)
    );

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("webrtc:answer", { to: from, sdp: answer });
  });

  socket.on("webrtc:ice-candidate", async ({ candidate }) => {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    }
  });

  return {
    watchDevice: (deviceId) => {
      cleanup();
      socket.emit("viewer:watch-device", { deviceId });
    },
    disconnect: () => {
      cleanup();
      socket.close();
    }
  };
}