import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/api/';
  private tokenKey = 'auth_token';
  private userSubject = new BehaviorSubject<any>(this.getUserFromStorage());

  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // Iniciar sesión
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}token-auth/`, {
      username: email, // email actúa como username aquí
      password
    }).pipe(
      tap(response => {
        if (response && response.token) {
          this.storeToken(response.token);
          this.getCurrentUser().subscribe(); // cargar y guardar datos de usuario
        }
      })
    );
  }

  // Registrar nuevo usuario
  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}register/`, userData).pipe(
      tap(response => {
        if (response && response.token && response.user) {
          this.storeToken(response.token);
          this.userSubject.next(response.user);
          localStorage.setItem('user_data', JSON.stringify(response.user));
        }
      })
    );
  }

  // Cerrar sesión
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('user_data');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Obtener el token actual
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Guardar token
  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  // Obtener datos del usuario autenticado
  getCurrentUser(): Observable<any> {
    const token = this.getToken();
    const headers = { Authorization: `Token ${token}` };

    return this.http.get<any>(`${this.apiUrl}user/`, { headers }).pipe(
      tap(user => {
        this.userSubject.next(user);
        localStorage.setItem('user_data', JSON.stringify(user));
      })
    );
  }

  // Obtener usuario guardado localmente
  private getUserFromStorage(): any {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  // Agregar tarjeta
  addCard(cardNumber: string): Observable<{ saldo: number, tarjeta: string}> {
    const token = this.getToken();
    return this.http.post<{ saldo: number, tarjeta: string }>(
      `${this.apiUrl}add-card/`,
      {cardNumber},
      { headers: { Authorization: `Token ${token}` } }
    );
  }

  // Establecer límite mensual
  setLimit(limite: number): Observable<{ limite: number }> {
    const token = this.getToken();
    return this.http.post<{ limite: number }>(
      `${this.apiUrl}set-limit/`,
      { limite },
      { headers: { Authorization: `Token ${token}` } }
    );
  }
}
