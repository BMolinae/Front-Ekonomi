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
  getDocs,
  increment
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, Subject, from } from 'rxjs';
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

  private transactionsUpdated = new Subject<void>();
  transactionsUpdated$ = this.transactionsUpdated.asObservable();

  async addTransaction(transaction: any): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    // Asegurar que el monto sea positivo
    const montoPositivo = Math.abs(transaction.monto);
    const transactionDoc = {
      ...transaction,
      monto: montoPositivo,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      fecha: transaction.fecha ? Timestamp.fromDate(new Date(transaction.fecha)) : serverTimestamp(),
      modo: 'manual'
    };

    const transactionsRef = this.getUserManualTransactionsRef(user.uid);
    await addDoc(transactionsRef, transactionDoc);

    // Actualizar gasto mensual y saldo
    const userRef = doc(this.firestore, `users/${user.uid}`);

    if (transaction.tipo === 'gasto') {
      await updateDoc(userRef, {
        gastoMensualActualManual: increment(montoPositivo),
        saldoManual: increment(-montoPositivo)
      });
    } else if (transaction.tipo === 'ingreso') {
      await updateDoc(userRef, {
        saldoManual: increment(montoPositivo)
      });
    }
    
    this.transactionsUpdated.next();
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
    this.transactionsUpdated.next();
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
    this.transactionsUpdated.next();
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