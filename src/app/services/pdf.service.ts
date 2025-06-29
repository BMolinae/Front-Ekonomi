// src/app/services/pdf.service.ts

import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';                           // Mantenido de la versión original
import autoTable from 'jspdf-autotable';             // Mantenido
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'; // Movido desde la página
import { Platform, AlertController } from '@ionic/angular';             // Agregado para detección de plataforma y alertas
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx'; // Agregado

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  constructor(
    private platform: Platform,
    private alertController: AlertController,
    private fileOpener: FileOpener
  ) { }

  /**
   * Genera un PDF y lo guarda en Descargas (Android 14) o descarga en web.
   */
  async generarPDF(
    usuario: any,
    movimientos: any[],
    resumen: { saldo: number; limite: number; usado: number; restante: number; }
  ): Promise<{ filePath: string } | void> {
    try {
      // 1. Crear el documento PDF
      const doc = new jsPDF();

      // 2. Configuración inicial del documento
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Reporte de Movimientos - Ekonomi', 14, 22);

      // 3. Información del usuario
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Usuario: ${usuario.username || 'N/A'}`, 14, 40);
      doc.text(`Correo: ${usuario.email || 'N/A'}`, 14, 47);
      doc.text(`Saldo actual: $${resumen.saldo.toLocaleString('es-MX')}`, 14, 54);
      doc.text(`Límite mensual: $${resumen.limite.toLocaleString('es-MX')}`, 14, 61);
      doc.text(`Gastado este mes: $${resumen.usado.toLocaleString('es-MX')}`, 14, 68);
      doc.text(`Restante disponible: $${resumen.restante.toLocaleString('es-MX')}`, 14, 75);

      // 4. Tabla de movimientos
      const data = movimientos.map(m => [
        this.formatDate(m.fecha),
        m.categoria || 'Sin categoría',
        m.descripcion || 'Sin descripción',
        m.tipo === 'ingreso'
          ? `$${m.monto.toLocaleString('es-MX')}`
          : `-$${m.monto.toLocaleString('es-MX')}`,
        m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Tipo']],
        body: data,
        styles: { cellPadding: 3, fontSize: 8, valign: 'middle' },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 50 }, 3: { cellWidth: 25 }, 4: { cellWidth: 20 } }
      });

      // 5. Pie de página
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
        doc.text(`Generado el ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
      }

      const fileName = `ekonomi_${usuario.username}_${new Date().getTime()}.pdf`;

      if (this.platform.is('hybrid')) {
        // Eze: Verificación de permisos de almacenamiento antes de escribir el PDF
        const perm = await Filesystem.checkPermissions();
        if (perm.publicStorage !== 'granted') {
          const request = await Filesystem.requestPermissions();
          if (request.publicStorage !== 'granted') {
            await this.showAlert('Permiso denegado', 'Debes permitir el acceso al almacenamiento.');
            return;
          }
        }

        // Eze: Obtener PDF en Base64 directamente desde jsPDF
        const base64Data = doc.output('datauristring').split(',')[1];

        // Eze: Escribir el archivo sin encoding para mantener el PDF intacto
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });

        // Eze: Obtener la URI del archivo y abrirlo con FileProvider
        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: fileName
        });
        await this.fileOpener.open(fileUri.uri, 'application/pdf');

        return { filePath: fileUri.uri };

      } else {
        // Web: descarga automática en navegador
        const pdfBlob = doc.output('blob');
        this.downloadInBrowser(URL.createObjectURL(pdfBlob), fileName);
      }

    } catch (error) {
      console.error('Error en generación de PDF:', error);
      await this.showAlert('Error', 'No se pudo generar el PDF. Por favor, intenta nuevamente.');
      throw error;
    }


  }

  private formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('es-MX');
    } catch {
      return dateString;
    }
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  private downloadInBrowser(url: string, filename: string): void {
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
  }

}




