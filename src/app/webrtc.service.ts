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
  private remoteUserId!: string;
  private peerConnection!: RTCPeerConnection;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  public localStream$ = new BehaviorSubject<MediaStream | null>(null);
  public remoteStream$ = new BehaviorSubject<MediaStream | null>(null);
  public incomingCall$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.userId = this.generateUserId();
    this.socket = io(environment.socketEndpoint);
    this.socket.emit('register', this.userId);
    this.socket.on('message', (message) => {
      this.handleMessage(message);
    });
  }

  private generateUserId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async createPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    });

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.localStream$.next(localStream);
      localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, localStream);
      });
    } else {
      console.error('getUserMedia is not supported');
    }

    const remoteStream = new MediaStream();
    this.remoteStream$.next(remoteStream);
    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: 'candidate',
          candidate: event.candidate,
        }, this.remoteUserId);
      }
    };
  }

  private sendMessage(message: any, remoteUserId: string) {
    this.socket.emit('message', { ...message, remoteUserId });
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
    }
  }

  private async handleOffer(offer: any) {
    this.remoteUserId = offer.remoteUserId;
    this.incomingCall$.next(true);
    await this.createPeerConnection();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer.offer));
    this.processIceCandidateQueue();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.sendMessage({ type: 'answer', answer: answer }, this.remoteUserId);
  }

  private async handleAnswer(answer: any) {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer.answer));
    this.processIceCandidateQueue();
  }

  private async handleCandidate(candidate: any) {
    const iceCandidate = new RTCIceCandidate(candidate.candidate);
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } else {
      this.iceCandidateQueue.push(iceCandidate);
    }
  }

  private async processIceCandidateQueue() {
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        await this.peerConnection.addIceCandidate(candidate);
      }
    }
  }

  public async call(remoteUserId: string) {
    this.remoteUserId = remoteUserId;
    await this.createPeerConnection();
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.sendMessage({ type: 'offer', offer: offer }, this.remoteUserId);
  }
}
