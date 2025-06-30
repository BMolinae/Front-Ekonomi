import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, addDoc, setDoc, getDoc, getDocs, collection } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CardService } from '../services/card.service';
import { limit, updateDoc } from 'firebase/firestore';
import { Storage } from '@ionic/storage';
import { LoadingController } from '@ionic/angular';


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
    private loadingController: LoadingController,
    private auth: Auth,
    private firestore: Firestore,
    private router: Router,
    private cardService: CardService,
    private storage: Storage

  ) {
    this.initStorage(); // Inicializar Storage
    onAuthStateChanged(this.auth, user => {
      this.currentUser = user;
      if (user) {
        const staticData = {
          uid: user.uid,
          email: user.email
        };
        this.userSubject.next(staticData);
        this.storage.set('userUid', user.uid);
        this.storage.set('userEmail', user.email || '');
      } else {
        this.reset();
      }
    });
  }

  private async initStorage() {
    await this.storage.create();
  }

  login(email: string, password: string): Promise<void> {
    return signInWithEmailAndPassword(this.auth, email, password)
      .then((cred) => {
        this.currentUser = cred.user;
        return this.getCurrentUserData().then(data => {
          this.userSubject.next(data);
          this.storage.set('userEmail', cred.user.email || '');
          this.storage.set('userUid', cred.user.uid);
          this.storage.set('username', data?.username || '');
          this.router.navigate(['/dashboard']);
        });
      })
      .catch(error => {
        console.error('Error de inicio de sesión:', error);
        return Promise.reject('Credenciales inválidas. Intentelo Nuevamente');
      });
  }


  register(email: string, password: string, username: string): Promise<void> {
    this.reset(); // Limpiar datos existentes

    return createUserWithEmailAndPassword(this.auth, email, password)
      .then(cred => {
        // Limpiar storage antes de establecer nuevos valores
        return Promise.all([
          this.storage.remove('userUid'),
          this.storage.remove('userEmail'),
          this.storage.remove('username')
        ]).then(() => {
          const userRef = doc(this.firestore, `users/${cred.user.uid}`);
          return setDoc(userRef, {
            email,
            username,
            saldoTarjeta: 500000,
            saldoManual: 0,
            limiteMensual: 0,
            limiteMensualManual: 0,
            tarjeta: ''
          }).then(() => {
            // Establecer nuevos datos de usuario
            return Promise.all([
              this.storage.set('userUid', cred.user.uid),
              this.storage.set('userEmail', email),
              this.storage.set('username', username)
            ]).then(() => { }); // <-- Ensure void is returned
          });
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

  async logout(): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Cerrando sesión...',
      duration: 1500,
      spinner: 'crescent'
    });

    await loading.present();

    await Promise.all([
      this.storage.remove('userUid'),
      this.storage.remove('userEmail'),
      this.storage.remove('username'),
      this.storage.remove(this.cacheKey)
    ]);

    this.userCache = null;
    this.userSubject.next(null);
    this.currentUserSubject.next(null);

    try {
      await signOut(this.auth);
      await this.router.navigateByUrl('/home');
      setTimeout(() => {
        location.reload(); // Recarga con un pequeño delay tras el loader
      }, 300);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      loading.dismiss();
    }
  }

  async getCurrentUserData(): Promise<any> {
    const uid = this.auth.currentUser?.uid || await this.storage.get('userUid');
    if (!uid) return null;

    const ref = doc(this.firestore, `users/${uid}`);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? snapshot.data() : null;
  }

  refreshUserData(): Promise<void> {
    return this.storage.get('userUid').then(uid => {
      if (!uid) return Promise.reject('No user');

      const ref = doc(this.firestore, `users/${uid}`);
      return getDoc(ref).then(docSnap => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          this.currentUserSubject.next(userData);
        }
      });
    });
  }


  async cacheUserData(data: any): Promise<void> {
    await this.storage.set(this.cacheKey, data);
  }

  async getCachedUserData(): Promise<any> {
    return await this.storage.get(this.cacheKey);
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


  async resetGastoMensual(): Promise<void> {
    const uid = this.auth.currentUser?.uid || await this.storage.get('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = doc(this.firestore, `users/${uid}`);
    await setDoc(ref, {
      gastoMensualActual: 0
    }, { merge: true });
  }

  async updateGastoMensual(monto: number): Promise<void> {
    const uid = this.auth.currentUser?.uid || await this.storage.get('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = doc(this.firestore, `users/${uid}`);
    await setDoc(ref, { gastoMensualActual: monto }, { merge: true });
  }


  async setLimit(limit: number, modo: 'manual' | 'tarjeta'): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const field = modo === 'manual' ? 'limiteMensualManual' : 'limiteMensual';
    const ref = doc(this.firestore, `users/${uid}`);
    await setDoc(ref, { [field]: limit }, { merge: true });;
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
    // No necesitamos await aquí ya que es un método void
    Promise.all([
      this.storage.remove('userUid'),
      this.storage.remove('userEmail'),
      this.storage.remove('username'),
      this.storage.remove(this.cacheKey)
    ]).catch(err => console.error('Error clearing storage:', err));
  }

  getUserId(): Promise<string | null> {
    return this.storage.get('userUid');
  }

  getUserEmail(): Promise<string | null> {
    return this.storage.get('userEmail');
  }


}

