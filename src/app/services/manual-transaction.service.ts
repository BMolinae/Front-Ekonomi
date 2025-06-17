// manual-transaction.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, where, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class ManualTransactionService {
  private readonly COLLECTION_NAME = 'manualTransactions';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private storage: Storage
  ) {}

  async addTransaction(transaction: any): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');

    // Estructura base del documento
    const transactionDoc = {
      ...transaction,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSynced: true
    };

    try {
      // Guardar en Firestore
      const transactionsRef = collection(this.firestore, this.COLLECTION_NAME);
      await addDoc(transactionsRef, transactionDoc);
      
      // Guardar en caché local
      await this.cacheTransaction(transactionDoc);
    } catch (error) {
      console.error('Error al guardar en Firestore, guardando localmente', error);
      // Guardar localmente con flag de no sincronizado
      await this.cacheTransaction({
        ...transactionDoc,
        isSynced: false
      });
    }
  }

  private async cacheTransaction(transaction: any): Promise<void> {
    const cached = await this.storage.get('manualTransactions') || [];
    cached.unshift(transaction);
    await this.storage.set('manualTransactions', cached);
  }

  async getTransactions(): Promise<any[]> {
    // Primero intentar obtener de Firestore
    try {
      const user = this.auth.currentUser;
      if (!user) return [];
      
      const transactionsRef = collection(this.firestore, this.COLLECTION_NAME);
      const q = query(
        transactionsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const firestoreData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Guardar en caché
      await this.storage.set('manualTransactions', firestoreData);
      
      return firestoreData;
    } catch (error) {
      console.error('Error al obtener de Firestore, usando caché', error);
      // Fallback a caché local
      return await this.storage.get('manualTransactions') || [];
    }
  }

  async syncLocalTransactions(): Promise<void> {
    const localTransactions = await this.storage.get('manualTransactions') || [];
    const unsynced = localTransactions.filter((t: any) => !t.isSynced);
    
    if (unsynced.length === 0) return;

    try {
      const transactionsRef = collection(this.firestore, this.COLLECTION_NAME);
      
      for (const transaction of unsynced) {
        await addDoc(transactionsRef, {
          ...transaction,
          isSynced: true,
          updatedAt: new Date().toISOString()
        });
      }
      
      // Actualizar caché local marcando como sincronizados
      await this.storage.set('manualTransactions', 
        localTransactions.map((t: any) => ({ ...t, isSynced: true }))
      );
    } catch (error) {
      console.error('Error sincronizando transacciones locales', error);
    }
  }
}