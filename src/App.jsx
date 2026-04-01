import { useEffect, useMemo, useRef, useState } from "react";
import { createViewerClient } from "./services/viewerClient";

function App() {
  const backendUrl = useMemo(
    () => import.meta.env.VITE_BACKEND_URL || "http://localhost:4000",
    []
  );

  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const selectedDeviceIdRef = useRef("");

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  useEffect(() => {
    clientRef.current = createViewerClient({
      backendUrl,
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onDevices: setDevices,
      onStatus: setStatus,
      onRemoteStream: (stream) => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
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

  const handleSelectDevice = async (deviceId) => {
    setSelectedDeviceId(deviceId);
    const response = await clientRef.current?.watchDevice(deviceId);
    if (!response?.ok) {
      setSelectedDeviceId("");
    }
  };

  return (
    <div className="page">
      <header className="header">
        <h1>Live Devices</h1>
        <p>{connected ? "Online" : "Offline"}</p>
        <p className="status">{status}</p>
        <p className="backend">Backend: {backendUrl}</p>
      </header>

      <section className="device-list">
        {devices.length === 0 ? (
          <div className="empty">No devices available</div>
        ) : (
          devices.map((device) => (
            <button
              key={device.deviceId}
              className={selectedDeviceId === device.deviceId ? "device active" : "device"}
              onClick={() => handleSelectDevice(device.deviceId)}
              type="button"
            >
              <span>{device.hostname}</span>
              <span className={device.isStreaming ? "pill on" : "pill off"}>
                {device.isStreaming ? "streaming" : "idle"}
              </span>
              <span className="meta">viewers: {device.viewerCount ?? 0}</span>
            </button>
          ))
        )}
      </section>

      <section className="viewer">
        <video ref={videoRef} autoPlay playsInline controls={false} muted />
      </section>
    </div>
  );
}

export default App;
