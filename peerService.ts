
import { Peer, DataConnection } from 'peerjs';

// Helper to ensure we get the Peer class regardless of import style
const PeerClass = Peer;

export interface PeerMessage {
  type: 'MOVE' | 'RESET' | 'CHAT';
  payload: any;
}

export class PeerService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onDataReceived: ((data: PeerMessage) => void) | null = null;

  constructor() {}

  // Initialize Peer with a random ID (Host)
  init(onOpen: (id: string) => void): string {
    // Clean up old peer if exists
    if (this.peer) this.peer.destroy();

    this.peer = new PeerClass({
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
        ]
      }
    } as any);
    
    this.peer.on('open', (id) => {
      console.log('My Peer ID is: ' + id);
      onOpen(id);
    });

    this.peer.on('connection', (conn) => {
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error', err);
    });

    this.peer.on('disconnected', () => {
      try {
        this.peer?.reconnect();
      } catch {}
    });

    return ""; // Async ID return via callback
  }

  // Connect to a specific ID (Guest)
  connect(remoteId: string, onOpen: () => void) {
    if (this.peer) this.peer.destroy();
    this.peer = new PeerClass({
      host: '0.peerjs.com',
      port: 443,
      secure: true,
      path: '/',
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
        ]
      }
    } as any); // Create a fresh peer to connect with
    
    this.peer.on('open', () => {
      if (!this.peer) return;
      const conn = this.peer.connect(remoteId, { reliable: true });
      this.setupConnection(conn);
      // Wait for connection to be open
      conn.on('open', () => {
        onOpen();
      });
    });

     this.peer.on('error', (err) => {
      console.error('PeerJS connect error', err);
      alert("Could not connect. Check the ID.");
    });
  }

  private setupConnection(conn: DataConnection) {
    this.conn = conn;
    
    conn.on('data', (data) => {
      if (this.onDataReceived) {
        this.onDataReceived(data as PeerMessage);
      }
    });

    conn.on('close', () => {
      console.log("Connection closed");
      alert("Opponent disconnected.");
      this.conn = null;
    });

    conn.on('error', (err: any) => {
      console.error('Connection error', err);
      alert('Connection error. Please try re-sharing the invite link.');
    });
  }

  sendMessage(msg: PeerMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    } else {
      console.warn("Connection not open, cannot send message");
    }
  }

  onMessage(callback: (data: PeerMessage) => void) {
    this.onDataReceived = callback;
  }

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}

export const peerService = new PeerService();
