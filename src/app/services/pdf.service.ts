import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Movimiento } from './movimiento.model';

@Injectable({ providedIn: 'root' })
export class PdfService {
  async generarPDF(
    usuario: any,
    movimientos: Movimiento[],
    resumen: {
      saldo: number;
      limite: number;
      usado: number;
      restante: number;
    }
  ) {
    const doc = new jsPDF();

    // 🖼️ Insertar LOGO de la empresa (reemplaza el base64 por el tuyo si cambia)
    const logoBase64 = 'src\assets\img\logoEmpresa.jpeg'; // <- aquí va el base64 completo
    doc.addImage(logoBase64, 'JPEG', 15, 10, 45, 15);

    // ENCABEZADO
    doc.setFontSize(18);
    doc.text('Resumen Financiero Mensual', 70, 25);

    doc.setFontSize(12);
    doc.text(`Usuario: ${usuario.username}`, 14, 40);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 47);
    doc.text(`Saldo: $${resumen.saldo.toLocaleString()}`, 14, 54);
    doc.text(`Límite mensual: $${resumen.limite.toLocaleString()}`, 14, 61);

    // TABLA DE MOVIMIENTOS
    const data = movimientos.map(m => [
      new Date((m.fecha as any).seconds * 1000).toLocaleDateString(),
      m.tipo,
      m.descripcion,
      m.categoria_nombre || '-',
      `$${(+m.monto).toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto']],
      body: data,
      startY: 70,
      styles: { fontSize: 10 }
    });

    doc.save(`ekonomi_${usuario.username}_reporte.pdf`);
  }
}
