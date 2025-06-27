import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ModoService } from './services/modo.service';

import { FirebaseX } from '@awesome-cordova-plugins/firebase-x/ngx';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  isManualMode = false;
  showFooter = false;
  currentRoute = '';

  constructor(
    private router: Router,
    private modoService: ModoService,
    private firebaseX: FirebaseX,
    private firestore: Firestore,
    private auth: Auth
  ) {
    this.modoService.modoManual$.subscribe((value) => {
      this.isManualMode = value;
    });

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects;
        const allowedRoutes = [
          '/dashboard',
          '/graficos',
          '/chatbot',
          '/documentos',
          '/modo-dashboard',
          '/modo-graficos',
          '/modo-chatbot',
          '/modo-documentos',
        ];
        this.showFooter = allowedRoutes.includes(this.currentRoute);
      }
    });
  }

  ngOnInit() {
    // Forzar modo claro en toda la app
    document.body.setAttribute('color-theme', 'light');
    this.firebaseX.getToken().then(async token => {
      const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
      if (!uid || !token) return;

      const userDoc = doc(this.firestore, `users/${uid}`);
      await setDoc(userDoc, { fcmToken: token }, { merge: true });
    });
  }

  isActive(path: string): boolean {
    const expectedPath = this.isManualMode ? `/modo-${path}` : `/${path}`;
    return this.currentRoute === expectedPath;
  }


  navigateTo(path: string) {
    const finalPath = this.isManualMode ? `/modo-${path}` : `/${path}`;
    const currentPath = this.router.url;

    if (currentPath === finalPath) {
      const event = new CustomEvent('refreshDashboard');
      window.dispatchEvent(event);
    } else {
      this.router.navigateByUrl(finalPath);
    }
  }


}
