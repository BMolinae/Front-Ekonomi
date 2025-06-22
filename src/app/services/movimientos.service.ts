import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class MovimientosService {

  private movimientosCache: any[] = [];

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) { }

  async agregarMovimiento(
    tipo: 'ingreso' | 'gasto',
    descripcion: string,
    monto: number,
    categoria: string,
    tarjeta: string
  ): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');

    if (!uid) throw new Error('Usuario no autenticado');

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    await addDoc(ref, {
      tipo,
      descripcion,
      monto,
      categoria_nombre: categoria,
      tarjeta,
      fecha: Timestamp.now(),
      modo: 'tarjeta'
    });
  }


  async obtenerMovimientos(forceRefresh = false): Promise<any[]> {
    console.log('Obteniendo movimientos...');
    if (!forceRefresh && this.movimientosCache.length) {
      return this.movimientosCache;
    }

    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    const q = query(ref, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

    this.movimientosCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha: doc.data()['fecha']?.toDate?.() || doc.data()['fecha']
    }));

    return this.movimientosCache;
  }

  async obtenerMovimientosPorTarjeta(tarjeta: string): Promise<any[]> {
    console.log(`Obteniendo movimientos para tarjeta ${tarjeta}...`);
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    const q = query(ref, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

    // Filtramos manualmente por idTarjeta
    return snapshot.docs
      .map(doc => {
        const data: any = doc.data();
        return {
          id: doc.id,
          ...data,
          categoria_nombre: data.categoria_nombre || data.categoria || '-',
          fecha: data.fecha?.toDate ? data.fecha.toDate() : data.fecha
        };
      })
      .filter(mov => mov.tarjeta === tarjeta);
  }

}
