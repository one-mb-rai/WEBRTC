import { environment } from 'src/environments/environment';
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {
  private socket: Socket;
  public userId: string;
  private peerConnections: Map<string, RTCPeerConnection> = new Map(); // userId -> RTCPeerConnection
  private iceCandidateQueues: Map<string, RTCIceCandidateInit[]> = new Map(); // userId -> RTCIceCandidateInit[]
  public localStream$ = new BehaviorSubject<MediaStream | null>(null);
  public remoteStreams$ = new BehaviorSubject<Map<string, MediaStream>>(new Map()); // userId -> MediaStream
  public incomingCall$ = new BehaviorSubject<boolean>(false);
  public currentRoomId: string | null = null;

  constructor() {
    this.userId = ''; // Initialize as empty, will be set from HomePage
    this.socket = io(environment.socketEndpoint);
    this.socket.on('message', (message) => {
      this.handleMessage(message);
    });
  }

  private async createPeerConnection(remoteUserId: string, mode: 'video' | 'audio' | 'file'): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });

    this.peerConnections.set(remoteUserId, peerConnection);
    this.iceCandidateQueues.set(remoteUserId, []);

    if (!this.localStream$.getValue()) {
      let mediaConstraints: MediaStreamConstraints = { audio: true };
      if (mode === 'video') {
        mediaConstraints.video = true;
      }
      const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      this.localStream$.next(localStream);
    }

    this.localStream$.getValue()?.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.localStream$.getValue()!); // Add local stream to the new peer connection
    });

    const remoteStream = new MediaStream();
    const currentRemoteStreams = this.remoteStreams$.getValue();
    currentRemoteStreams.set(remoteUserId, remoteStream);
    this.remoteStreams$.next(currentRemoteStreams);

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: 'candidate',
        }, remoteUserId, event.candidate);
      }
    };

    return peerConnection;
  }

  private sendMessage(message: any, remoteUserId: string, candidate?: RTCIceCandidate) {
    this.socket.emit('message', { ...message, remoteUserId, candidate });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'candidate':
        this.handleCandidate(message);
        break;
      case 'disconnect':
        this.handleDisconnect();
        break;
      case 'user_joined':
        this.handleUserJoined(message);
        break;
      case 'user_left':
        this.handleUserLeft(message);
        break;
      case 'existing_users':
        this.handleExistingUsers(message);
        break;
    }
  }

  private async handleOffer(message: any) {
    const { offer, senderUserId } = message;
    this.incomingCall$.next(true);
    let peerConnection = this.peerConnections.get(senderUserId);
    if (!peerConnection) {
      // Assuming 'video' mode for incoming calls if not specified in offer
      peerConnection = await this.createPeerConnection(senderUserId, 'video');
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.processIceCandidateQueue(senderUserId);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    this.sendMessage({ type: 'answer', answer: answer }, senderUserId);
  }

  private async handleAnswer(message: any) {
    const { answer, senderUserId } = message;
    const peerConnection = this.peerConnections.get(senderUserId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      this.processIceCandidateQueue(senderUserId);
    }
  }

  private async handleCandidate(message: any) {
    const { candidate, senderUserId } = message;
    const iceCandidate = new RTCIceCandidate(candidate);
    const peerConnection = this.peerConnections.get(senderUserId);
    if (peerConnection && peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(iceCandidate);
    } else {
      this.iceCandidateQueues.get(senderUserId)?.push(iceCandidate);
    }
  }

  private async processIceCandidateQueue(remoteUserId: string) {
    const queue = this.iceCandidateQueues.get(remoteUserId);
    const peerConnection = this.peerConnections.get(remoteUserId);
    if (queue && peerConnection && peerConnection.remoteDescription) {
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (candidate) {
          await peerConnection.addIceCandidate(candidate);
        }
      }
    }
  }

  public initializeSocket() {
    if (this.userId && !this.socket.connected) {
      this.socket.emit('register', this.userId);
    }
  }

  public async call(roomId: string, mode: 'video' | 'audio' | 'file') {
    this.currentRoomId = roomId;
    this.socket.emit('join_room', { userId: this.userId, roomId: roomId });

    // Start local stream based on mode
    if (!this.localStream$.getValue()) {
      let mediaConstraints: MediaStreamConstraints = { audio: true };
      if (mode === 'video') {
        mediaConstraints.video = true;
      }
      const localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      this.localStream$.next(localStream);
    }
  }

  public disconnect() {
    if (this.localStream$.getValue()) {
      this.localStream$.getValue()?.getTracks().forEach(track => track.stop());
      this.localStream$.next(null);
    }

    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.iceCandidateQueues.clear();
    this.remoteStreams$.next(new Map());

    if (this.currentRoomId) {
      this.socket.emit('leave_room', { userId: this.userId, roomId: this.currentRoomId });
      this.currentRoomId = null;
    }

    this.incomingCall$.next(false);
  }

  private handleDisconnect() {
    // This is for when the other peer disconnects in a 1-to-1 call
    // For group calls, we handle user_left message
    if (this.peerConnections.size === 1) {
      this.peerConnections.forEach(pc => pc.close());
      this.peerConnections.clear();
      this.iceCandidateQueues.clear();
      this.remoteStreams$.next(new Map());
      if (this.localStream$.getValue()) {
        this.localStream$.getValue()?.getTracks().forEach(track => track.stop());
        this.localStream$.next(null);
      }
      this.incomingCall$.next(false);
    }
  }

  private async handleUserJoined(message: any) {
    const newUserId = message.userId;
    console.log(`User ${newUserId} joined the room.`);
    // Create a new peer connection for the new user and send an offer
    // Assuming 'video' mode for new users joining
    const peerConnection = await this.createPeerConnection(newUserId, 'video');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    this.sendMessage({ type: 'offer', offer: offer }, newUserId);
  }

  private handleUserLeft(message: any) {
    const leftUserId = message.userId;
    console.log(`User ${leftUserId} left the room.`);
    const peerConnection = this.peerConnections.get(leftUserId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(leftUserId);
      this.iceCandidateQueues.delete(leftUserId);
      const currentRemoteStreams = this.remoteStreams$.getValue();
      currentRemoteStreams.delete(leftUserId);
      this.remoteStreams$.next(currentRemoteStreams);
    }
  }

  private async handleExistingUsers(message: any) {
    const existingUsers = message.users;
    console.log(`Existing users in the room: ${existingUsers}`);
    // For each existing user, create a peer connection and wait for their offer
    // Assuming 'video' mode for existing users
    for (const userId of existingUsers) {
      await this.createPeerConnection(userId, 'video');
    }
  }
}

