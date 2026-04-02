import { useEffect, useMemo, useRef, useState } from "react";
import { createViewerClient } from "./services/viewerClient";

function App() {
  const backendUrl = useMemo(
    () => import.meta.env.VITE_BACKEND_URL || "http://localhost:4000",
    []
  );

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const clientRef = useRef(null);
  const selectedDeviceIdRef = useRef("");

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);

  // ================= KEEP SELECTED DEVICE =================
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  // ================= INIT CLIENT =================
  useEffect(() => {
    clientRef.current = createViewerClient({
      backendUrl,
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onDevices: setDevices,
      onStatus: setStatus,

      // 🔥 STREAM HANDLING
      onRemoteStream: (stream) => {
        console.log("✅ Stream received:", stream);

        if (!videoRef.current) return;

        const video = videoRef.current;

        video.srcObject = null;
        video.srcObject = stream;

        video
          .play()
          .then(() => console.log("🎥 Video playing"))
          .catch((err) => console.error("❌ Video play error:", err));
      },

      onDeviceOffline: (deviceId) => {
        if (selectedDeviceIdRef.current === deviceId) {
          setSelectedDeviceId("");
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      }
    });

    return () => {
      clientRef.current?.disconnect();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [backendUrl]);

  // ================= SELECT DEVICE =================
  const handleSelectDevice = async (deviceId) => {
    setSelectedDeviceId(deviceId);

    const response = await clientRef.current?.watchDevice(deviceId);

    if (!response?.ok) {
      setSelectedDeviceId("");
    }
  };

  // ================= FULLSCREEN =================
  const handleFullscreen = () => {
    const elem = containerRef.current;
    if (!elem) return;

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  };

  // ================= SCREENSHOT =================
  const handleScreenshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const link = document.createElement("a");
    link.download = `screenshot-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // ================= UI =================
  return (
    <div className="page">
      <header className="header">
        <h1>Live Devices</h1>
        <p>{connected ? "Online" : "Offline"}</p>
        <p className="status">{status}</p>
        <p className="backend">Backend: {backendUrl}</p>
      </header>

      {/* DEVICE LIST */}
      <section className="device-list">
        {devices.length === 0 ? (
          <div className="empty">No devices available</div>
        ) : (
          devices.map((device) => (
            <button
              key={device.deviceId}
              className={
                selectedDeviceId === device.deviceId
                  ? "device active"
                  : "device"
              }
              onClick={() => handleSelectDevice(device.deviceId)}
              type="button"
            >
              <span>{device.hostname}</span>

              <span className={device.isStreaming ? "pill on" : "pill off"}>
                {device.isStreaming ? "streaming" : "idle"}
              </span>

              <span className="meta">
                viewers: {device.viewerCount ?? 0}
              </span>
            </button>
          ))
        )}
      </section>

      {/* VIDEO VIEWER */}
      <section className="viewer" ref={containerRef}>
        {/* 🔥 CONTROLS */}
        <div style={{ marginBottom: 10 }}>
          <button onClick={handleFullscreen}>Fullscreen</button>

          <button
            onClick={handleScreenshot}
            style={{ marginLeft: 10 }}
          >
            Screenshot
          </button>
        </div>

        {/* VIDEO */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            background: "black",
            borderRadius: "8px"
          }}
        />
      </section>
    </div>
  );
}

export default App;