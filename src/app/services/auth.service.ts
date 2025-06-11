import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, addDoc, setDoc, getDoc, getDocs, collection } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CardService } from '../services/card.service';

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
        this.getCurrentUser().then(data => {
          this.userSubject.next(data);
          localStorage.setItem('userEmail', user.email || '');
          localStorage.setItem('userUid', user.uid);
          localStorage.setItem('username', data?.username || '');
        });
      } else {
        this.userSubject.next(null);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userUid');
        localStorage.removeItem('username');
      }
    });
  }

  login(email: string, password: string): Promise<void> {
    return signInWithEmailAndPassword(this.auth, email, password)
      .then((cred) => {
        this.currentUser = cred.user;
        return this.getCurrentUser().then(data => {
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

  register(email: string, password: string, username: string): Promise<void> {
    return createUserWithEmailAndPassword(this.auth, email, password)
      .then(cred => {
        const userRef = doc(this.firestore, `users/${cred.user.uid}`);
        return setDoc(userRef, {
          email,
          username,
          saldo: 500000,
          limiteMensual: 0,
          tarjeta: ''
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
    localStorage.clear();
    return signOut(this.auth);
  }

  getCurrentUser(): Promise<any> {
    if (this.userCache) {
      return Promise.resolve(this.userCache); // devuelve desde memoria
    }

    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');

    const ref = doc(this.firestore, `users/${uid}`);
    return getDoc(ref).then(snapshot => {
      const data = snapshot.data();
      this.userSubject.next(data);
      this.userCache = data;
      return data;
    });
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
    const currentUser = await this.getCurrentUser();
    const nuevoSaldo = (currentUser?.saldo || 0) + 500000;
    await this.updateSaldo(nuevoSaldo);
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

  async setLimit(limit: number, currentBalance: number): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');

    if (limit > currentBalance) {
      return Promise.reject('El límite no puede ser mayor al saldo disponible');
    }

    const ref = doc(this.firestore, `users/${uid}`);
    return setDoc(ref, { limiteMensual: limit }, { merge: true })
      .then(() => {
        this.cardService.notifyLimitUpdate();
        return this.refreshUserData();
      });
  }

  async cacheUserData(data: any): Promise<void> {
    localStorage.setItem(this.cacheKey, JSON.stringify(data));
  }

  async getCachedUserData(): Promise<any> {
    const cached = localStorage.getItem(this.cacheKey);
    return cached ? JSON.parse(cached) : null;
  }


  updateSaldo(nuevoSaldo: number): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');
    const ref = doc(this.firestore, `users/${uid}`);
    console.log('prueba 2');
    return setDoc(ref, { saldo: nuevoSaldo }, { merge: true });
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

  reset() {
    this.userCache = null;
    this.userSubject.next(null);
    this.currentUserSubject.next(null);
  }

  getUidUsuario(): string | null {
    return this.auth.currentUser?.uid || localStorage.getItem('userUid');
  }


}

