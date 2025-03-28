import { useState } from "react";
import "./App.css";
import { SignalingChannel } from "./SignalingChannel";
import { WebRTCSignalMessageType } from "./enums/WebRTCSignalMessageType";

function App() {
  const config: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  const [offerPeerConnection, setOfferPeerConnection] =
    useState<RTCPeerConnection>();

  const [answerPeerConnection, setAnswerPeerConnection] =
    useState<RTCPeerConnection>();

  const [signalingChannel, setSignalingChannel] = useState<SignalingChannel>();

  const [inputUserId, setInputUserId] = useState<string>();
  const [inputRoomId, setInputRoomId] = useState<string>();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  async function sendOffer(
    newSignalingChannel: SignalingChannel,
    roomId: string
  ) {
    const offerPeerConnection = createPeerConnection(
      newSignalingChannel,
      roomId
    );
    if (!offerPeerConnection) return; // null일 경우 빠른 종료
    setOfferPeerConnection(offerPeerConnection);

    newSignalingChannel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.ANSWER) {
        const remoteDesc = new RTCSessionDescription({
          sdp: signalMessage.sdp,
          type: "answer",
        });

        await offerPeerConnection.setRemoteDescription(remoteDesc);

        console.log("received answer : " + signalMessage.type);
      }
    });

    if (!roomId || roomId === "") {
      console.error("roomId는 비어있을 수 없습니다.");
      return;
    }
    const offer = await offerPeerConnection.createOffer();
    await offerPeerConnection.setLocalDescription(offer);
    newSignalingChannel?.send({
      type: WebRTCSignalMessageType.OFFER,
      roomId: roomId,
      sdp: offer.sdp,
    });
    console.log("sent offer");
  }

  function createPeerConnection(
    newSignalingChannel: SignalingChannel,
    roomId: string
  ) {
    if (!roomId || roomId === "") {
      console.error("roomId는 비어있을 수 없습니다.");
      return null;
    }

    const peerConnection = new RTCPeerConnection(config);
    peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        signalingChannel?.send({
          type: WebRTCSignalMessageType.ICECANDIDATE,
          roomId: roomId,
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
    if (!roomId || roomId === "") {
      console.error("roomId는 비어있을 수 없습니다.");
      return;
    }

    const newSignalingChannel = new SignalingChannel(userId, roomId);

    newSignalingChannel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.OFFER) {
        const answerPeerConnection = createPeerConnection(
          newSignalingChannel,
          roomId
        );
        if (!answerPeerConnection) return; // null일 경우 빠른 종료
        setAnswerPeerConnection(answerPeerConnection);

        console.log("received offer from userId: " + signalMessage.from);
        answerPeerConnection.setRemoteDescription(
          new RTCSessionDescription({
            sdp: signalMessage.sdp,
            type: "offer",
          })
        );

        const answer = await answerPeerConnection.createAnswer();
        await answerPeerConnection.setLocalDescription(answer);
        newSignalingChannel.send({
          type: WebRTCSignalMessageType.ANSWER,
          roomId: roomId,
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
          {isConnected ? "Disconnect Signal Channel" : "Connect Signal Channel"}
        </button>
        <button
          className={"bg-green-600 text-white p-2"}
          onClick={() => {
            if (signalingChannel && inputRoomId && inputRoomId !== "") {
              sendOffer(signalingChannel, inputRoomId);
            } else {
              console.error("signalingChannel 또는 유효한 roomId가 없습니다.");
            }
          }}
        >
          Send Offer
        </button>
      </div>
      <p className="read-the-docs"></p>
    </>
  );
}

export default App;
