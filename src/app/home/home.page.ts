import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebrtcService } from '../webrtc.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, FormsModule, CommonModule],
})
export class HomePage implements OnInit, OnDestroy {
  public userId: string;
  public remoteUserId: string;
  private incomingCallSubscription!: Subscription;

  constructor(private webrtc: WebrtcService, private router: Router) {
    this.userId = this.webrtc.userId;
    this.remoteUserId = '';
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

  async call() {
    await this.webrtc.call(this.remoteUserId);
    this.router.navigate(['/call']);
  }
}
