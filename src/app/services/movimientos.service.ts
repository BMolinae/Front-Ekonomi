import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  async agregarMovimiento(
    tipo: 'ingreso' | 'gasto',
    descripcion: string,
    monto: number,
    categoria: string
  ): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    await addDoc(ref, {
      tipo,
      descripcion,
      monto,
      categoria_nombre: categoria,
      fecha: Timestamp.now()
    });
    
  }

  async obtenerMovimientos(): Promise<any[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    const q = query(ref, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data: any = doc.data();
      return {
        id: doc.id,
        ...data,
        categoria_nombre: data.categoria_nombre || data.categoria || '-',
        fecha: data.fecha?.toDate ? data.fecha.toDate() : data.fecha
      };
    });
     
  }
}
