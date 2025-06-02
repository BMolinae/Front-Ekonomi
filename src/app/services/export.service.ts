import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  constructor(private fileOpener: FileOpener) {}

  async exportarPDF(
    usuario: any,
    movimientos: any[],
    resumen: {
      saldo: number,
      limite: number,
      usado: number,
      restante: number
    }
  ): Promise<void> {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reporte financiero', 14, 22);
    doc.setFontSize(12);
    doc.text(`Usuario: ${usuario.username}`, 14, 40);

    doc.text(`Saldo: $${resumen.saldo.toLocaleString()}`, 14, 54);
    doc.text(`Límite mensual: $${resumen.limite.toLocaleString()}`, 14, 61);
    doc.text(`Usado: $${resumen.usado.toLocaleString()}`, 14, 68);
    doc.text(`Restante: $${resumen.restante.toLocaleString()}`, 14, 75);

    const data = movimientos.map(m => [
      m.fecha,
      m.categoria,
      m.descripcion,
      `$${m.monto.toLocaleString()}`,
      m.tipo
    ]);

    autoTable(doc, {
      head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Tipo']],
      body: data,
      startY: 85
    });

    const fileName = `ekonomi_${usuario.username}_reporte.pdf`;
    const pdfOutput = doc.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    const uriResult = await Filesystem.getUri({
      directory: Directory.Documents,
      path: fileName
    });

    const mimeType = 'application/pdf';
    await this.fileOpener.open(uriResult.uri, mimeType);
  }

  async exportarCSV(nombreArchivo: string, encabezados: string[], filas: string[][]): Promise<void> {
    const csvContent = [encabezados.join(','), ...filas.map(fila => fila.join(','))].join('\n');

    await Filesystem.writeFile({
      path: `${nombreArchivo}.csv`,
      data: csvContent,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    const uriResult = await Filesystem.getUri({
      directory: Directory.Documents,
      path: `${nombreArchivo}.csv`
    });

    const mimeType = 'text/csv';
    await this.fileOpener.open(uriResult.uri, mimeType);
  }

  async exportarPNG(nombreArchivo: string, base64Image: string): Promise<void> {
    await Filesystem.writeFile({
      path: `${nombreArchivo}.png`,
      data: base64Image,
      directory: Directory.Documents
    });

    const uriResult = await Filesystem.getUri({
      directory: Directory.Documents,
      path: `${nombreArchivo}.png`
    });

    const mimeType = 'image/png';
    await this.fileOpener.open(uriResult.uri, mimeType);
  }
}
