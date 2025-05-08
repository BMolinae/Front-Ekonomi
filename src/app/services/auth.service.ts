import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User} from '@angular/fire/auth';
import { Firestore, doc, addDoc, setDoc, getDoc, getDocs, collection} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser: User | null = null;
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router
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
    console.error('❌', errorMsg);
    alert(errorMsg);
  });
  

  }

  logout(): Promise<void> {
    localStorage.clear();
    return signOut(this.auth).then(() => {
      this.router.navigate(['/login']);
    });
  }

  getCurrentUser(): Promise<any> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');
    const ref = doc(this.firestore, `users/${uid}`);
    return getDoc(ref).then(snapshot => {
      const data = snapshot.data();
      this.userSubject.next(data);
      return data;
    });
  }

  addCard(cardNumber: string): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');
  
    const userRef = doc(this.firestore, `users/${uid}`);
    const movRef = collection(this.firestore, `users/${uid}/movimientos`);
  
    const movimiento = {
      tipo: 'ingreso',
      descripcion: 'Saldo inicial al agregar tarjeta',
      monto: 500000,
      fecha: new Date()
    };
  
    return Promise.all([
      setDoc(userRef, { tarjeta: cardNumber, saldo: 500000 }, { merge: true }),
      addDoc(movRef, movimiento)
    ]).then(() => {
      return;
    });
  }
  
  setLimit(limit: number): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');
    const ref = doc(this.firestore, `users/${uid}`);
    return setDoc(ref, { limite_mensual: limit }, { merge: true });
  }

  updateSaldo(nuevoSaldo: number): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');
    const ref = doc(this.firestore, `users/${uid}`);
    return setDoc(ref, { saldo: nuevoSaldo }, { merge: true });
  }

  getMovimientos(): Promise<any[]> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return Promise.reject('No user');
    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    return getDocs(ref).then(snapshot =>
      snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    );
  }
}

