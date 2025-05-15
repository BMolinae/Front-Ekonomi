import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Movimiento } from './movimiento.model';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Platform } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class PdfService {

  constructor(
    private fileOpener: FileOpener,
    private platform: Platform
  ) {}

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

    doc.setFontSize(18);
    doc.text('Resumen Financiero Mensual', 70, 25);

    doc.setFontSize(12);
    doc.text(`Usuario: ${usuario.username}`, 14, 40);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 47);
    doc.text(`Saldo: $${resumen.saldo.toLocaleString()}`, 14, 54);
    doc.text(`Límite mensual: $${resumen.limite.toLocaleString()}`, 14, 61);

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

    const pdfOutput = doc.output('blob');
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64data = (reader.result as string).split(',')[1];
      const fileName = `ekonomi_${usuario.username}_reporte.pdf`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64data,
        directory: Directory.Documents,
        encoding: 'base64' as Encoding,
      });

      console.log('📁 PDF guardado en:', fileName);

      // 🔓 Abrir el archivo directamente en Android
      if (this.platform.is('android')) {
        const uri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: fileName
        });

        this.fileOpener.open(uri.uri, 'application/pdf')
          .then(() => console.log('✅ Archivo abierto correctamente'))
          .catch(err => console.error('❌ Error al abrir archivo', err));
      }
    };

    reader.readAsDataURL(pdfOutput);
  }
}
