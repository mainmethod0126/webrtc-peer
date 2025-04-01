import { useState } from "react";
import "./App.css";
import { SignalingChannel } from "./SignalingChannel";
import { WebRTCSignalMessageType } from "./enums/WebRTCSignalMessageType";

function App() {
  const config: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  const [peerConnections, setPeerConnections] = useState<RTCPeerConnection[]>(
    []
  );

  const [signalingChannel, setSignalingChannel] = useState<SignalingChannel>();

  const [inputUserId, setInputUserId] = useState<string>();
  const [inputRoomId, setInputRoomId] = useState<string>();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  async function sendOffer(
    peerConnection: RTCPeerConnection,
    channel: SignalingChannel,
    roomId: string
  ) {
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

  function shareDisplay(channel: SignalingChannel, roomId: string) {
    const peerConnection = createPeerConnection(channel, roomId);
    if (!peerConnection) return;
    setPeerConnections([...peerConnections, peerConnection]);

    const dataChannel = peerConnection.createDataChannel("chatting");

    dataChannel.onopen = () => {
      console.log("데이터 채널이 열렸습니다!");
    };

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
        sendOffer(peerConnection, channel, roomId);
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

    peerConnection.addEventListener("datachannel", (event) => {
      const receivedChannel = event.channel;
      receivedChannel.onopen = () => console.log("데이터 채널 연결됨!");
      receivedChannel.onmessage = (e) => console.log("메시지 수신:", e.data);
    });

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
        setPeerConnections([...peerConnections, answerPeerConnection]);

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
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 py-4 px-6 flex justify-between items-center shadow-md">
        <h1 className="text-2xl font-bold">WebRTC 화상 채팅</h1>
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="roomId" className="text-sm">
              방 ID:
            </label>
            <input
              className="bg-gray-700 text-white px-3 py-1 rounded"
              id="roomId"
              type="text"
              value={inputRoomId}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setInputRoomId(event.target.value);
              }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="userId" className="text-sm">
              사용자 ID:
            </label>
            <input
              className="bg-gray-700 text-white px-3 py-1 rounded"
              id="userId"
              type="text"
              value={inputUserId}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setInputUserId(event.target.value);
              }}
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-4">
        {/* 비디오 영역 */}
        <div className="flex-1 flex flex-col mr-4">
          <div className="relative flex-1 bg-black rounded-lg overflow-hidden">
            <video
              id="remoteVideo"
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            {/* 로컬 비디오 미리보기 (나중에 필요할 때 사용) */}
            <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded shadow-md hidden">
              {/* 로컬 비디오가 필요하면 여기에 추가 */}
            </div>
          </div>

          {/* 컨트롤 버튼 */}
          <div className="flex justify-center space-x-4 mt-4">
            <button
              className={`px-4 py-2 rounded-full font-medium ${
                isConnected
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              } transition-colors`}
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
              {isConnected ? "연결 해제" : "연결하기"}
            </button>
            <button
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full font-medium transition-colors"
              onClick={() => {
                if (signalingChannel && inputRoomId) {
                  shareDisplay(signalingChannel, inputRoomId);
                }
              }}
            >
              화면 공유
            </button>
          </div>
        </div>

        {/* 채팅 영역 */}
        <div className="w-80 flex flex-col bg-gray-800 rounded-lg overflow-hidden">
          <div className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-2">{/* 채팅 메시지들은 여기에 표시 */}</ul>
          </div>
          <div className="p-4 border-t border-gray-700">
            <textarea
              id="message"
              className="w-full bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="메시지를 입력하세요..."
              rows={3}
            ></textarea>
            <button className="mt-2 w-full bg-blue-500 hover:bg-blue-600 py-2 rounded font-medium transition-colors">
              전송
            </button>
          </div>
        </div>
      </main>

      {/* 연결 상태 표시 */}
      <footer className="bg-gray-800 py-2 px-6 text-center text-sm text-gray-400">
        {isConnected
          ? `연결됨: ${inputUserId} (방 ID: ${inputRoomId})`
          : "연결 대기 중..."}
      </footer>
    </div>
  );
}

export default App;
