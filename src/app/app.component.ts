import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { WebrtcService } from './webrtc.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(private webrtc: WebrtcService) {
    // this.webrtc.init(); // The init method does not exist on WebrtcService
  }
}
