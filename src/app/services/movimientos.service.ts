import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, Timestamp, doc, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { EmailService } from './email.service';

@Injectable({ providedIn: 'root' })
export class MovimientosService {

  private movimientosCache: any[] = [];

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private emailService: EmailService
  ) { }

  async agregarMovimiento(
    tipo: 'ingreso' | 'gasto',
    descripcion: string,
    monto: number,
    categoria: string,
  ): Promise<void> {
    console.log('agregarMovimiento: inicio');

    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) {
      console.error('agregarMovimiento: usuario no autenticado');
      throw new Error('Usuario no autenticado');
    }

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    await addDoc(ref, {
      categoria_nombre: categoria,
      descripcion,
      fecha: Timestamp.now(),
      monto,
      tipo,
      modo: 'tarjeta'
    });

    console.log('agregarMovimiento: gasto agregado, obteniendo usuario...');
    const userRef = doc(this.firestore, `users/${uid}`);
    const userSnap = await getDoc(userRef);
    const usuario = userSnap.data();

    if (usuario) {
      console.log('agregarMovimiento: usuario obtenido, verificando gasto...');
      this.verificarGasto(usuario);
    } else {
      console.warn('agregarMovimiento: usuario no encontrado');
    }
  }


  async obtenerMovimientos(forceRefresh = false): Promise<any[]> {
    console.log('Obteniendo movimientos...');
    if (!forceRefresh && this.movimientosCache.length) {
      return this.movimientosCache;
    }

    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    // Obtener movimientos
    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    const q = query(ref, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

    this.movimientosCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha: doc.data()['fecha']?.toDate?.() || doc.data()['fecha']
    }));

    // Obtener usuario para verificar gasto
    const userRef = doc(this.firestore, `users/${uid}`);
    const userSnap = await getDoc(userRef);
    const usuario = userSnap.data();

    if (usuario) {
      console.log('obtenerMovimientos: usuario obtenido, verificando gasto...');
      this.verificarGasto(usuario);
    } else {
      console.warn('obtenerMovimientos: usuario no encontrado');
    }

    return this.movimientosCache;
  }


  async obtenerMovimientosPorTarjeta(tarjeta: string): Promise<any[]> {
    console.log(`Obteniendo movimientos para tarjeta ${tarjeta}...`);
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    const q = query(ref, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

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

  private verificarGasto(usuario: any) {
    console.log('verificarGasto: entrando', usuario);
    const { email, nombre, saldoTarjeta, limiteMensual } = usuario;

    if (!email || !limiteMensual || !saldoTarjeta) {
      console.log('verificarGasto: faltan datos para enviar alerta');
      return;
    }

    const porcentaje = (saldoTarjeta / limiteMensual) * 100;

    console.log(`verificarGasto: porcentaje gastado: ${porcentaje.toFixed(2)}%`);

    if (porcentaje >= 80) {
      console.log('verificarGasto: porcentaje >= 80%, enviando alerta...');
      this.emailService.sendGastoAlertaEmail({
        to_email: email,
        user_name: nombre || 'Usuario',
        saldo_tarjeta: saldoTarjeta,
        limite_mensual: limiteMensual,
        porcentaje_gastado: Math.round(porcentaje)
      }).then(() => {
        console.log('✅ Alerta enviada');
      }).catch(err => {
        console.error('❌ Error al enviar alerta:', err);
      });
    } else {
      console.log('verificarGasto: porcentaje < 80%, no se envía alerta');
    }
  }

}
