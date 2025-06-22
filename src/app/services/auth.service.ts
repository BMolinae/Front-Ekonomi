import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, addDoc, setDoc, getDoc, getDocs, collection } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CardService } from '../services/card.service';
import { limit } from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser: User | null = null;
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  private userCache: any = null;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private cacheKey = 'user_financial_data';

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private cardService: CardService
  ) {
    onAuthStateChanged(this.auth, user => {
      this.currentUser = user;
      if (user) {
        const staticData = {
          uid: user.uid,
          email: user.email
        };
        this.userSubject.next(staticData);
        localStorage.setItem('userUid', user.uid);
        localStorage.setItem('userEmail', user.email || '');
      } else {
        this.reset();
      }
    });
  }

  login(email: string, password: string): Promise<void> {
    return signInWithEmailAndPassword(this.auth, email, password)
      .then((cred) => {
        this.currentUser = cred.user;
        return this.getCurrentUserData().then(data => {
          this.userSubject.next(data);
          localStorage.setItem('userEmail', cred.user.email || '');
          localStorage.setItem('userUid', cred.user.uid);
          localStorage.setItem('username', data?.username || '');
          this.router.navigate(['/dashboard']);
        });
      })
      .catch(error => {
        console.error('Error de inicio de sesión:', error);
        return Promise.reject('Credenciales inválidas. Intentelo Nuevamente');
      });

  }

  // In your register method in AuthService
  register(email: string, password: string, username: string): Promise<void> {
    // First clear any existing data
    this.reset(); // Add this line

    return createUserWithEmailAndPassword(this.auth, email, password)
      .then(cred => {
        // Clear localStorage before setting new values
        localStorage.removeItem('userUid');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('username');

        const userRef = doc(this.firestore, `users/${cred.user.uid}`);
        return setDoc(userRef, {
          email,
          username,
          saldoTarjeta: 500000, // Default value
          saldoManual: 0,       // Default value
          limiteMensual: 0,     // Default value
          limiteMensualManual: 0, // Default value
          tarjeta: ''           // Default value
        }).then(() => {
          // Set new user data in localStorage
          localStorage.setItem('userUid', cred.user.uid);
          localStorage.setItem('userEmail', email);
          localStorage.setItem('username', username);
        });
      })
      .catch(error => {
        let errorMsg = 'Error al crear cuenta.';
        if (error.code === 'auth/email-already-in-use') {
          errorMsg = 'Este correo ya está registrado.';
        }
        return Promise.reject(errorMsg);
      });
  }

  logout(): Promise<void> {
    // Limpiar todo el almacenamiento local relacionado con la sesión
    localStorage.removeItem('userUid');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
    localStorage.removeItem(this.cacheKey); // Elimina los datos financieros en caché

    // Resetear los observables y caché en memoria
    this.userCache = null;
    this.userSubject.next(null);
    this.currentUserSubject.next(null);

    // Cerrar sesión en Firebase Auth
    return signOut(this.auth)
      .then(() => {
        this.router.navigate(['/home']); // Redirigir a la página de inicio
      })
      .catch(error => {
        console.error('Error al cerrar sesión:', error);
        throw error;
      });
  }

  async getCurrentUserData(): Promise<any> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return null;

    const ref = doc(this.firestore, `users/${uid}`);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? snapshot.data() : null;
  }

  refreshUserData(): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');

    const ref = doc(this.firestore, `users/${uid}`);
    return getDoc(ref).then(docSnap => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        this.currentUserSubject.next(userData); // 👈 Aquí es lo importante
      }
    });
  }


  async addCard(cardData: {
    number: string,
    name: string,
    expiry: string,
    cvv: string,
    type: string
  }): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const userRef = doc(this.firestore, `users/${uid}`);
    const movRef = collection(this.firestore, `users/${uid}/movimientos`);

    // 1. Actualizar datos de la tarjeta
    await setDoc(userRef, {
      tarjeta: cardData.number.slice(-4),
      cardType: cardData.type,
      cardFullData: { // Opcional: guardar todos los datos cifrados en producción
        name: cardData.name,
        expiry: cardData.expiry,
        cvv: cardData.cvv
      }
    }, { merge: true });

    // 2. Crear movimiento de recarga
    const movimiento = {
      tipo: 'ingreso',
      descripcion: 'Recarga inicial por agregar tarjeta',
      monto: 500000,
      fecha: new Date(),
      categoria: 'Recarga'
    };

    await addDoc(movRef, movimiento);

    // 3. Actualizar saldo
    const currentUser = await this.getCurrentUserData();
    const nuevoSaldo = (currentUser?.saldoTarjeta || 0) + 500000;
    await this.updateSaldo(nuevoSaldo, 'tarjeta');
  }

  private determineCardType(number: string): string {
    const firstDigit = number.charAt(0);
    switch (firstDigit) {
      case '4': return 'Visa';
      case '5': return 'Mastercard';
      case '3': return 'American Express';
      default: return 'Otra';
    }
  }

  async setLimit(limit: number, modo: 'manual' | 'tarjeta'): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const field = modo === 'manual' ? 'limiteMensualManual' : 'limiteMensual';
    const ref = doc(this.firestore, `users/${uid}`);
    await setDoc(ref, { [field]: limit }, { merge: true });
  }


  async cacheUserData(data: any): Promise<void> {
    localStorage.setItem(this.cacheKey, JSON.stringify(data));
  }

  async getCachedUserData(): Promise<any> {
    const cached = localStorage.getItem(this.cacheKey);
    return cached ? JSON.parse(cached) : null;
  }


  async updateSaldo(nuevoSaldo: number, modo: 'manual' | 'tarjeta'): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const field = modo === 'manual' ? 'saldoManual' : 'saldoTarjeta';
    const ref = doc(this.firestore, `users/${uid}`);
    await setDoc(ref, { [field]: nuevoSaldo }, { merge: true });
  }

  async getSaldo(modo: 'manual' | 'tarjeta'): Promise<number> {
    const userData = await this.getCurrentUserData();
    const field = modo === 'manual' ? 'saldoManual' : 'saldoTarjeta';
    return userData?.[field] || 0;
  }

  getMovimientos(): Promise<any[]> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    console.log('prueba 3');
    if (!uid) return Promise.reject('No user');
    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    return getDocs(ref).then(snapshot =>
      snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    );

  }

reset(): void {
  this.currentUser = null;
  this.userCache = null;
  this.userSubject.next(null);
  this.currentUserSubject.next(null);
  localStorage.removeItem('userUid');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('username');
  localStorage.removeItem(this.cacheKey);
}

  getUserId(): string | null {
    return this.auth.currentUser?.uid || localStorage.getItem('userUid');
  }

  getUserEmail(): string | null {
    return this.auth.currentUser?.email || localStorage.getItem('userEmail');
  }


}

