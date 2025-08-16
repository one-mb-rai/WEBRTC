import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebrtcService } from '../webrtc.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, IonList } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel, IonInput, IonButton, FormsModule, CommonModule, IonList],
})
export class HomePage implements OnInit, OnDestroy {
  public userId: string;
  public userName: string = '';
  public connectedUsers: { id: string; name: string }[] = [];
  private incomingCallSubscription!: Subscription;
  private usersSubscription!: Subscription;

  constructor(private webrtc: WebrtcService, private router: Router) {
    this.userId = this.webrtc.userId;
    this.userName = this.webrtc.userName;
  }

  updateUserName() {
    this.webrtc.setUserName(this.userName);
  }

  callUser(remoteUserId: string) {
    this.webrtc.call(remoteUserId);
    this.router.navigate(['/call']);
  }

  ngOnInit() {
    this.incomingCallSubscription = this.webrtc.incomingCall$.subscribe(incoming => {
      if (incoming) {
        this.router.navigate(['/call']);
      }
    });

    this.usersSubscription = this.webrtc.users$.subscribe(users => {
      this.connectedUsers = users.filter(user => user.id !== this.userId);
    });
  }

  ngOnDestroy() {
    if (this.incomingCallSubscription) {
      this.incomingCallSubscription.unsubscribe();
    }
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
  }


}
