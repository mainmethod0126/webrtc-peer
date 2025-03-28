import { useState } from "react";
import "./App.css";
import { SignalingChannel } from "./SignalingChannel";
import { WebRTCSignalMessageType } from "./enums/WebRTCSignalMessageType";

function App() {
  const config: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  const [peerConnections, setPeerConnections] = useState<
    Array<RTCPeerConnection>
  >([]);

  const [signalingChannel, setSignalingChannel] = useState<SignalingChannel>();

  const [inputUserId, setInputUserId] = useState<string>();
  const [inputRoomId, setInputRoomId] = useState<string>();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  async function makeCall(newSignalingChannel: SignalingChannel) {
    newSignalingChannel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.ANSWER) {
        const remoteDesc = new RTCSessionDescription({
          sdp: signalMessage.sdp,
          type: "answer",
        });

        await peerConnection.setRemoteDescription(remoteDesc);

        console.log("received answer : " + signalMessage.type);
      }
    });

    const peerConnection = createPeerConnection(newSignalingChannel);
    setPeerConnections([...peerConnections, peerConnection]);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    newSignalingChannel?.send({
      type: WebRTCSignalMessageType.OFFER,
      roomId: "123",
      sdp: offer.sdp,
    });
    console.log("sent offer");
  }

  function createPeerConnection(newSignalingChannel: SignalingChannel) {
    const peerConnection = new RTCPeerConnection(config);
    peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        signalingChannel?.send({
          type: WebRTCSignalMessageType.ICECANDIDATE,
          roomId: "123",
          sdp: JSON.stringify(event.candidate.toJSON()),
        });
      }
    });

    newSignalingChannel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.ICECANDIDATE) {
        const iceCandidate: RTCIceCandidateInit = JSON.parse(
          signalMessage.sdp ?? ""
        ) as RTCIceCandidateInit;
        try {
          await peerConnection.addIceCandidate(iceCandidate);
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    peerConnection.addEventListener("connectionstatechange", () => {
      if (peerConnection.connectionState === "connected") {
        console.log("connected!!!");
      }
    });

    return peerConnection;
  }

  function connect(userId: string, roomId: string) {
    const newSignalingChannel = new SignalingChannel(userId, roomId);

    makeCall(newSignalingChannel);

    newSignalingChannel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.OFFER) {
        const peerConnection = createPeerConnection(newSignalingChannel);
        setPeerConnections([...peerConnections, peerConnection]);

        console.log("received offer from userId: " + signalMessage.from);
        peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            sdp: signalMessage.sdp,
            type: "offer",
          })
        );

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        newSignalingChannel.send({
          type: WebRTCSignalMessageType.ANSWER,
          roomId: "123",
          sdp: answer.sdp,
          to: signalMessage.from,
        });
        console.log("sent answer to userId : " + signalMessage.from);
      }
    });

    setSignalingChannel(newSignalingChannel);
    setIsConnected(true);
  }

  function disconnect() {
    signalingChannel?.disconnect();
    setIsConnected(false);
  }

  return (
    <>
      <h1>learn webrtc</h1>
      <div className="meta-info space-x-6 space-y-4 flex">
        <div className="space-x-2">
          <label htmlFor="roomId">RoomId</label>
          <input
            className="bg-white text-black"
            id="roomId"
            type="text"
            value={inputRoomId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setInputRoomId(event.target.value);
            }}
          />
        </div>
        <div className="space-x-2">
          <label htmlFor="userId">UserId</label>
          <input
            className="bg-white text-black"
            id="userId"
            type="text"
            value={inputUserId}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setInputUserId(event.target.value);
            }}
          />
        </div>
        <button
          className={`${
            isConnected ? "bg-red-500" : "bg-blue-500"
          } text-white p-2`}
          onClick={() => {
            if (inputUserId && inputRoomId) {
              if (isConnected) {
                disconnect();
              } else {
                connect(inputUserId, inputRoomId);
              }
            }
          }}
        >
          {isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>
      <p className="read-the-docs"></p>
    </>
  );
}

export default App;
