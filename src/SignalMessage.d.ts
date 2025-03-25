enum WebRTCSignalMessageType {
  OFFER,
  ANWSER,
}

interface SignalMessage {
  type: WebRTCSignalMessageType;
  roomId: string;
  sdp: string;
}
