import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebrtcService } from '../webrtc.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonSegment, IonSegmentButton, IonIcon } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, FormsModule, CommonModule, IonSegment, IonSegmentButton, IonIcon],
})
export class HomePage implements OnInit, OnDestroy {
  public localPhoneNumber: string;
  public remotePhoneNumber: string;
  public isPhoneNumberValid: boolean = false;
  public selectedTab: 'video' | 'audio' | 'file' = 'video'; // Default to video call
  private incomingCallSubscription!: Subscription;

  constructor(private webrtc: WebrtcService, private router: Router) {
    this.localPhoneNumber = '';
    this.remotePhoneNumber = '';
  }

  ngOnInit() {
    this.incomingCallSubscription = this.webrtc.incomingCall$.subscribe(incoming => {
      if (incoming) {
        this.router.navigate(['/call']);
      }
    });
  }

  ngOnDestroy() {
    if (this.incomingCallSubscription) {
      this.incomingCallSubscription.unsubscribe();
    }
  }

  validatePhoneNumber() {
    this.isPhoneNumberValid = this.localPhoneNumber.length === 10 && /^\d+$/.test(this.localPhoneNumber);
  }

  async call(mode: 'video' | 'audio' | 'file') {
    if (this.isPhoneNumberValid) {
      this.webrtc.userId = this.localPhoneNumber; // Set the user ID in the service
      this.webrtc.initializeSocket(); // Initialize socket after setting userId
      await this.webrtc.call(this.remotePhoneNumber, mode); // Pass the mode to the call method
      this.router.navigate(['/call']);
    }
  }
}
