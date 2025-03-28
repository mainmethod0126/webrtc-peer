import { WebRTCSignalMessageType } from "./enums/WebRTCSignalMessageType";

// 기본 속성만 가진 타입
type SignalMessage = {
  type: WebRTCSignalMessageType;
  roomId: string;
  sdp?: string;
  from?: string;
  to?: string;
};
