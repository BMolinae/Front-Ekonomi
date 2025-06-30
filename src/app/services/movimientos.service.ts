import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, orderBy, Timestamp, doc, getDoc, updateDoc, increment } from '@angular/fire/firestore';
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
    monto: number, // Recibir el monto siempre positivo
    categoria: string,
  ): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    // Guardar el movimiento (monto siempre positivo, el signo lo maneja el tipo)
    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    await addDoc(ref, {
      categoria_nombre: categoria,
      descripcion,
      fecha: Timestamp.now(),
      monto: Math.abs(monto), // Guardar siempre positivo
      tipo,
      modo: 'tarjeta'
    });

    // Obtener y actualizar usuario
    const userRef = doc(this.firestore, `users/${uid}`);
    const updateData: any = {
      saldoTarjeta: increment(tipo === 'ingreso' ? monto : -monto)
    };

    if (tipo === 'gasto') {
      updateData.gastoMensualActual = increment(monto);
    }

    await updateDoc(userRef, updateData);

    // Verificación de gasto (movido aquí desde obtenerMovimientos)
    const userSnap = await getDoc(userRef);
    const usuario = userSnap.data();
    if (usuario) {
      console.log('agregarMovimiento: usuario obtenido, verificando gasto...');
      this.verificarGasto(usuario);
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

    // Eliminado el verificarGasto de aquí
    console.log('obtenerMovimientos: movimientos obtenidos sin verificación de gasto');

    return this.movimientosCache;
  }
  async getTarjetaBalance(): Promise<number> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) return 0;

    const ref = collection(this.firestore, `users/${uid}/movimientos`);
    const q = query(ref);

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data['tipo'] === 'ingreso' ? +data['monto'] : -(+data['monto']));
    }, 0);
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
    const { email, nombre, gastoMensualActual, limiteMensual } = usuario;

    if (!email || !limiteMensual || gastoMensualActual === undefined) {
      console.log('verificarGasto: faltan datos para enviar alerta');
      return;
    }

    const porcentaje = (gastoMensualActual / limiteMensual) * 100;
    console.log(`verificarGasto: porcentaje gastado: ${porcentaje.toFixed(2)}%`);

    if (porcentaje >= 80) {
      console.log('verificarGasto: porcentaje >= 80%, enviando alerta...');
      this.emailService.sendGastoAlertaEmail({
        to_email: email,
        user_name: nombre || 'Usuario',
        gasto_actual: gastoMensualActual,
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

  async resetearGastoMensual(): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const userRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userRef, {
      gastoMensualActual: 0
    });
  }

  async actualizarLimiteMensual(nuevoLimite: number): Promise<void> {
    const uid = this.auth.currentUser?.uid || localStorage.getItem('userUid');
    if (!uid) throw new Error('Usuario no autenticado');

    const userRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userRef, {
      limiteMensual: nuevoLimite,
      gastoMensualActual: 0
    });
  }

}
