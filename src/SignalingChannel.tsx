export class SignalingChannel {
  private ws: WebSocket;

  constructor() {
    this.ws = new WebSocket("http://localhost:8080/signal");

    this.ws.onopen = () => {
      this.ws.send(
        JSON.stringify({
          type: "OFFER",
          roomId: "123",
          sdp: "onopen",
        })
      );
    };

    this.ws.addEventListener("message", (message) => {
      console.log("message.data : " + message.data);
    });

    this.ws.send();
  }
}
