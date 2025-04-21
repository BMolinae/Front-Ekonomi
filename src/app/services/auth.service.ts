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

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>('http://localhost:8000/api-token-auth/', { username: email, password })
      .pipe(
        tap(response => {
          if (response && response.token) {
            this.storeToken(response.token);
            this.getCurrentUser().subscribe();
          }
        })
      );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}register/`, userData).pipe(
      tap(response => {
        if (response && response.token) {
          this.storeToken(response.token);
          this.userSubject.next(response.user);
          localStorage.setItem('user_data', JSON.stringify(response.user));
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getCurrentUser(): Observable<any> {
    const token = this.getToken();
    const headers =  { Authorization: `Token ${token}` };

    return this.http.get<any>(`${this.apiUrl}user/`, { headers }).pipe(
      tap(user => {
        this.userSubject.next(user);
        localStorage.setItem('user_data', JSON.stringify(user));
      })
    );
  }

  public getUserFromStorage(): any {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  addCard(): Observable<{ saldo: number }> {
    const token = this.getToken();
    return this.http.post<{ saldo: number }>(
      `${this.apiUrl}add-card/`,
      {},
      { headers: { Authorization: `Token ${token}` }}
    );
  }

  setLimit(limite: number): Observable<{ limite: number }> {
    const token = this.getToken();
    return this.http.post<{ limite: number }>(
      `${this.apiUrl}set-limit/`,
      { limite },
      { headers: { Authorization: `Token ${token}` } }
    );
  }
}
