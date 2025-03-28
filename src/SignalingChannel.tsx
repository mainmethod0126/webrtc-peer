import { SignalMessage } from "./SignalMessage";

export class SignalingChannel {
  private ws: WebSocket;

  constructor(userId: string, roomId: string) {
    this.ws = new WebSocket(
      `ws://localhost:8080/signal?roomId=${roomId}&userId=${userId}`
    );
  }

  isConnected(): boolean {
    return this.ws.readyState === 1;
  }

  disconnect(): void {
    this.ws.close();
  }

  send = (signalMessage: SignalMessage) => {
    this.ws.send(JSON.stringify(signalMessage));
  };

  addEventListener<K extends keyof WebSocketEventMap>(
    this: SignalingChannel,
    type: K,
    listener: (signalMessage: SignalMessage) => void
  ): void {
    this.ws.addEventListener(type, (event) => {
      if (type === "message") {
        const messageEvent = event as MessageEvent;
        // message -> SignalMessage
        listener(JSON.parse(messageEvent.data));
      }
    });
  }
}
