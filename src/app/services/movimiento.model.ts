export interface Movimiento {
    fecha: Date;
    tipo: 'ingreso' | 'gasto';
    descripcion: string;
    categoria_nombre: string;
    monto: number;
  }
  