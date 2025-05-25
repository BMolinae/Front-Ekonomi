// src/app/services/firestore.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, getDoc } from '@angular/fire/firestore';
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

  async getUserMovimientos(): Promise<Observable<any[]> | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    const colRef = collection(this.firestore, `users/${user.uid}/movimientos`);
    return collectionData(colRef, { idField: 'id' }) as Observable<any[]>;
  }

  getCategorias(): Observable<Categoria[]> {
    const colRef = collection(this.firestore, 'Categorias');
    console.log('test 1');
    return collectionData(colRef, { idField: 'id' }) as Observable<Categoria[]>;
  }

  getUserDataObservable(): Observable<any> | null {
    const user = this.auth.currentUser;
    console.log('test 2');
    if (!user) return null;

    const docRef = doc(this.firestore, `users/${user.uid}`);
    return docData(docRef);
  }

  async getUserDataOnce() {
    const user = this.auth.currentUser;
    console.log('test 3');
    if (!user) return null;

    const docRef = doc(this.firestore, `users/${user.uid}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  }
}
