import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  getDocs
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ManualTransactionService {

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) { }

  private getUserManualTransactionsRef(userId: string) {
    return collection(this.firestore, `users/${userId}/movimientosManual`);
  }

  async addTransaction(transaction: any): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    const transactionDoc = {
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Asegurar que la fecha sea un Timestamp si viene como string
      fecha: transaction.fecha ? Timestamp.fromDate(new Date(transaction.fecha)) : serverTimestamp(),
      modo: 'manual'
    };

    const transactionsRef = this.getUserManualTransactionsRef(user.uid);
    await addDoc(transactionsRef, transactionDoc);
  }

  getTransactions(): Observable<any[]> {
    const user = this.auth.currentUser;
    if (!user) return new Observable<any[]>(subscriber => subscriber.next([]));

    const transactionsRef = this.getUserManualTransactionsRef(user.uid);
    const q = query(transactionsRef, orderBy('createdAt', 'desc'));

    return from(getDocs(q).then(snapshot =>
      snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data['createdAt']?.toDate?.() || new Date(),
          updatedAt: data['updatedAt']?.toDate?.() || new Date(),
          fecha: data['fecha']?.toDate?.() || new Date()
        };
      })
    ));
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    const docRef = doc(this.firestore, `users/${user.uid}/movimientosManual/${transactionId}`);
    await deleteDoc(docRef);
  }

  async updateTransaction(transactionId: string, updates: any): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    const docRef = doc(this.firestore, `users/${user.uid}/movimientosManual/${transactionId}`);
    await updateDoc(docRef, updateData);
  }

  async getManualBalance(): Promise<number> {
    const user = this.auth.currentUser;
    if (!user) return 0;

    const transactionsRef = this.getUserManualTransactionsRef(user.uid);
    const q = query(transactionsRef);

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data['tipo'] === 'ingreso' ? +data['monto'] : -(+data['monto']));
    }, 0);
  }
}