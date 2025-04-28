import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  showFooter = false;
  currentRoute = '';

  constructor(private router: Router) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.urlAfterRedirects;
        const allowedRoutes = ['/dashboard', '/graficos', '/chatbot', '/documentos'];
        this.showFooter = allowedRoutes.includes(this.currentRoute);
      }
    });
  }

  isActive(path: string): boolean {
    return this.currentRoute === path;
  }

  navigateTo(path: string) {
    this.router.navigateByUrl(path);
  }
}
