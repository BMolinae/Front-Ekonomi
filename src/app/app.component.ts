import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ModoService } from './services/modo.service';

import { FirebaseX } from '@awesome-cordova-plugins/firebase-x/ngx';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

import { Keyboard } from '@capacitor/keyboard'; // 👈 NUEVO: Importa el plugin de teclado
import { Platform } from '@ionic/angular';       // 👈 NUEVO: Necesario para que funcione correctamente en dispositivos

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
    private auth: Auth,
    private platform: Platform // 👈 NUEVO
  ) {
    // Suscribirse al modo manual
    this.modoService.modoManual$.subscribe((value) => {
      this.isManualMode = value;
    });

    // Mostrar/ocultar footer según la ruta
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

    // 👇 NUEVO: Listeners del teclado (globales)
    this.platform.ready().then(() => {
      Keyboard.addListener('keyboardWillShow', info => {
        console.log('Teclado mostrando, altura:', info.keyboardHeight);
        // Puedes aplicar lógica adicional si quieres desplazar algo
      });

      Keyboard.addListener('keyboardWillHide', () => {
        console.log('Teclado oculto');
        // Restablecer cualquier cambio si hiciste algo visual
      });
    });
  }

  ngOnInit() {
    // Forzar modo claro en toda la app
    document.body.setAttribute('color-theme', 'light');

    // Token de notificaciones push
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
