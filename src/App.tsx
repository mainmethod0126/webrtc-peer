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

  async function sendOffer(channel: SignalingChannel, roomId: string) {
    const peerConnection = createPeerConnection(channel, roomId);
    if (!peerConnection) return;
    setOfferPeerConnection(peerConnection);

    channel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.ANSWER) {
        const remoteDesc = new RTCSessionDescription({
          sdp: signalMessage.sdp,
          type: "answer",
        });

        await peerConnection.setRemoteDescription(remoteDesc);

        console.log("received answer : " + signalMessage.type);
      }
    });

    if (!roomId || roomId === "") {
      console.error("roomId는 비어있을 수 없습니다.");
      return;
    }
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    channel?.send({
      type: WebRTCSignalMessageType.OFFER,
      roomId: roomId,
      sdp: offer.sdp,
    });
    console.log("sent offer");
  }

  function shareDisplay(peerConnection: RTCPeerConnection) {
    navigator.mediaDevices
      .getDisplayMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        stream.getTracks().forEach((track) => {
          console.log("stream : " + stream);
          peerConnection.addTrack(track, stream);
        });
      })
      .catch((error) => {
        console.error("stream error" + error);
      });
  }

  function createPeerConnection(channel: SignalingChannel, roomId: string) {
    if (!roomId || roomId === "") {
      console.error("roomId는 비어있을 수 없습니다.");
      return null;
    }

    const peerConnection = new RTCPeerConnection(config);

    const remoteVideo = document.querySelector(
      "#remoteVideo"
    ) as HTMLVideoElement;

    peerConnection.addEventListener("track", async (event) => {
      console.log("트랙 추가 수신");

      const [remoteStream] = event.streams;
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
      } else {
        console.error("Video element #remoteVideo not found");
      }
    });

    // peerConnection.addEventListener("negotiationneeded", async () => {
    //   console.log("재협상 이벤트 수신");
    //   const offer = await peerConnection.createOffer();
    //   await peerConnection.setLocalDescription(offer);
    //   newSignalingChannel.send({
    //     type: WebRTCSignalMessageType.OFFER,
    //     roomId: roomId,
    //     sdp: offer.sdp,
    //   });
    // });

    // const dataChannel = peerConnection.createDataChannel("dataChannel");

    // dataChannel.onopen = () => {
    //   console.log("데이터 채널이 열렸습니다!");
    // };

    // peerConnection.ondatachannel = (event) => {
    //   const receivedChannel = event.channel;
    //   receivedChannel.onopen = () => console.log("데이터 채널 연결됨!");
    //   receivedChannel.onmessage = (e) => console.log("메시지 수신:", e.data);
    // };

    peerConnection.addEventListener("icecandidate", (event) => {
      console.log("on icecandidate");

      if (event.candidate) {
        channel?.send({
          type: WebRTCSignalMessageType.ICECANDIDATE,
          roomId: roomId,
          sdp: JSON.stringify(event.candidate.toJSON()),
        });
      }
    });

    channel?.addEventListener("message", async (signalMessage) => {
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

    const channel = new SignalingChannel(userId, roomId);

    channel?.addEventListener("message", async (signalMessage) => {
      if (signalMessage.type === WebRTCSignalMessageType.OFFER) {
        const answerPeerConnection = createPeerConnection(channel, roomId);
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
        channel.send({
          type: WebRTCSignalMessageType.ANSWER,
          roomId: roomId,
          sdp: answer.sdp,
          to: signalMessage.from,
        });
        console.log("sent answer to userId : " + signalMessage.from);
      }
    });

    setSignalingChannel(channel);
    setIsConnected(true);
  }

  function disconnect() {
    signalingChannel?.disconnect();
    setIsConnected(false);
  }

  return (
    <>
      <h1>learn webrtc</h1>
      <video
        id="remoteVideo"
        autoPlay
        playsInline
        className="h-[720px] w-[1280px]"
      />
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
        <button
          className={"bg-green-600 text-white p-2"}
          onClick={() => {
            shareDisplay(offerPeerConnection);
          }}
        >
          내 화면 공유하기
        </button>
      </div>
      <p className="read-the-docs"></p>
    </>
  );
}

export default App;
