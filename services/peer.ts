
import { Message, UserProfile } from '../types';
import Peer from 'peerjs';

export interface PeerData {
  type: 'message' | 'profile' | 'reaction' | 'request-profile';
  content?: Message;
  profile?: UserProfile;
  reaction?: { messageId: string, emoji: string };
}

export class PeerService {
  private peer: any;
  private connections: Map<string, any> = new Map();
  public id: string = '';

  private normalizeId(value: string) {
    return value.trim().replace(/^@+/, '').toLowerCase();
  }

  constructor(
    customId: string,
    onId: (id: string) => void, 
    onData: (remoteId: string, data: PeerData) => void, 
    onConnect: (remoteId: string) => void, 
    onDisconnect: (remoteId: string) => void,
    onError: (err: any) => void
  ) {
    const cleanId = this.normalizeId(customId);
    this.peer = new Peer(cleanId);

    this.peer.on('open', (id: string) => {
      this.id = id;
      onId(id);
    });

    this.peer.on('connection', (conn: any) => {
      this.setupConnection(conn, onData, onConnect, onDisconnect);
    });

    this.peer.on('error', (err: any) => {
      onError(err);
    });
  }

  public connect(partnerId: string, onData: (remoteId: string, data: PeerData) => void, onConnect: (remoteId: string) => void, onDisconnect: (remoteId: string) => void) {
    const cleanPartnerId = this.normalizeId(partnerId);
    const existingConn = this.connections.get(cleanPartnerId);
    if (existingConn?.open) return;

    const conn = this.peer.connect(cleanPartnerId);
    this.setupConnection(conn, onData, onConnect, onDisconnect);
  }

  private setupConnection(conn: any, onData: (remoteId: string, data: PeerData) => void, onConnect: (remoteId: string) => void, onDisconnect: (remoteId: string) => void) {
    conn.on('open', () => {
      const cleanPeerId = this.normalizeId(conn.peer);
      const previous = this.connections.get(cleanPeerId);
      if (previous && previous !== conn && previous.open) {
        previous.close();
      }
      this.connections.set(cleanPeerId, conn);
      onConnect(cleanPeerId);
    });

    conn.on('data', (data: PeerData) => {
      onData(this.normalizeId(conn.peer), data);
    });

    conn.on('close', () => {
      const cleanPeerId = this.normalizeId(conn.peer);
      this.connections.delete(cleanPeerId);
      onDisconnect(cleanPeerId);
    });

    conn.on('error', (err: any) => {
      console.error("Connection error with peer:", conn.peer, err);
      const cleanPeerId = this.normalizeId(conn.peer);
      this.connections.delete(cleanPeerId);
      onDisconnect(cleanPeerId);
    });
  }

  public send(remoteId: string, data: PeerData) {
    const cleanRemoteId = this.normalizeId(remoteId);
    const conn = this.connections.get(cleanRemoteId);
    if (conn && conn.open) {
      conn.send(data);
    }
  }

  public broadcast(data: PeerData) {
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }

  public disconnectAll() {
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
    }
  }

  public disconnect(remoteId: string) {
    const cleanRemoteId = this.normalizeId(remoteId);
    const conn = this.connections.get(cleanRemoteId);
    if (conn) {
      conn.close();
      this.connections.delete(cleanRemoteId);
    }
  }
}
