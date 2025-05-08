import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, getDoc,} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';

export interface Categoria {
  nombre: string;
  icono: string;
  color: string;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  constructor(private firestore: Firestore, private auth: Auth) {}

  // Obtiene movimientos del usuario autenticado
  async getUserMovimientos(): Promise<Observable<any[]> | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    const colRef = collection(this.firestore, `users/${user.uid}/movimientos`);
    return collectionData(colRef, { idField: 'id' }) as Observable<any[]>;
  }

  // Obtiene todas las categorías globales
  getCategorias(): Observable<Categoria[]> {
    const colRef = collection(this.firestore, 'Categorias');
    return collectionData(colRef, { idField: 'id' }) as Observable<Categoria[]>;
  }

  // Obtiene los datos del usuario (saldo, tarjeta, etc)
  async getUserData() {
    const user = this.auth.currentUser;
    if (!user) return null;

    const docRef = doc(this.firestore, `users/${user.uid}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  }
}
