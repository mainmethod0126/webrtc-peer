import "./App.css";
import { SignalingChannel } from "./SignalingChannel";

function App() {
  const signalingChannel = new SignalingChannel();

  return (
    <>
      <h1>learn webrtc</h1>
      <div className="card"></div>
      <p className="read-the-docs"></p>
    </>
  );
}

export default App;
