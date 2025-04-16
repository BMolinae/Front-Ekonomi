import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://tu-backend-django.com/api'; // Cambia esto con tu URL real
  private tokenKey = 'auth_token';
  private userSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // Iniciar sesión
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api-token-auth/`, { email, password })
      .pipe(
        tap(response => {
          if (response && response.token) {
            // Guarda el token
            this.storeToken(response.token);
            
            // Opcional: obtener datos del usuario después del login
            this.getCurrentUser().subscribe();
          }
        })
      );
  }

  // Registrar nuevo usuario
  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register/`, userData);
  }

  // Cerrar sesión
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Obtener el token actual
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Guardar el token en localStorage
  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  // Opcional: obtener datos del usuario actual
  getCurrentUser(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/user/`)
      .pipe(
        tap(user => {
          this.userSubject.next(user);
        })
      );
  }

  // Obtener usuario del almacenamiento
  private getUserFromStorage(): any {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }
}
