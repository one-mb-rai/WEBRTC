import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { WebrtcService } from '../webrtc.service';

@Component({
  selector: 'app-call',
  templateUrl: './call.page.html',
  styleUrls: ['./call.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class CallPage implements AfterViewInit {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  constructor(public webrtc: WebrtcService) { }

  ngAfterViewInit() {
    this.webrtc.localStream$.subscribe(stream => {
      if (stream && this.localVideo) {
        this.localVideo.nativeElement.srcObject = stream;
      }
    });

    this.webrtc.remoteStreams$.subscribe(streamsMap => {
      // Assuming for simplicity that we only display the first remote stream
      // In a multi-party call, you would iterate through the map and create multiple video elements
      const firstRemoteStream = streamsMap.values().next().value;
      if (firstRemoteStream && this.remoteVideo) {
        this.remoteVideo.nativeElement.srcObject = firstRemoteStream;
      }
    });
  }
}
