import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  constructor(
    private fileOpener: FileOpener,
    private platform: Platform,
    private alertController: AlertController
  ) {}

  /**
   * Genera un PDF con los movimientos del usuario
   * @param usuario Datos del usuario
   * @param movimientos Lista de movimientos
   * @param resumen Resumen financiero
   */
  async generarPDF(
    usuario: any,
    movimientos: any[],
    resumen: {
      saldo: number;
      limite: number;
      usado: number;
      restante: number;
    }
  ): Promise<void> {
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
        m.tipo === 'ingreso' ? `$${m.monto.toLocaleString('es-MX')}` : `-$${m.monto.toLocaleString('es-MX')}`,
        m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Tipo']],
        body: data,
        styles: {
          cellPadding: 3,
          fontSize: 8,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 50 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 }
        }
      });

      // 5. Pie de página
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width - 40,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          `Generado el ${new Date().toLocaleDateString()}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      // 6. Guardar el archivo
      const pdfOutput = doc.output('datauristring');
      const base64 = pdfOutput.split(',')[1];
      const fileName = `ekonomi_${usuario.username}_${new Date().getTime()}.pdf`;

      // 7. Escribir el archivo en el sistema
      const fileResult = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: this.getBestDirectory(),
        encoding: Encoding.UTF8,
      });

      // 8. Obtener URI compatible con la plataforma
      let fileUri = fileResult.uri;
      if (this.platform.is('android')) {
        fileUri = Capacitor.convertFileSrc(fileUri);
      }

      // 9. Abrir el archivo
      await this.fileOpener.open(fileUri, 'application/pdf')
        .catch(async (error) => {
          console.error('Error al abrir PDF:', error);
          await this.showAlert(
            'Archivo descargado',
            `El PDF se guardó correctamente pero no se pudo abrir automáticamente. Busca el archivo ${fileName} en tu dispositivo.`
          );
        });

    } catch (error) {
      console.error('Error en generación de PDF:', error);
      await this.showAlert(
        'Error',
        'No se pudo generar el PDF. Por favor, intenta nuevamente.'
      );
      throw error;
    }
  }

  /**
   * Determina el mejor directorio según la plataforma
   */
  private getBestDirectory(): Directory {
    if (this.platform.is('ios')) {
      return Directory.Documents;
    }
    return Directory.ExternalStorage; // Para Android
  }

  /**
   * Formatea la fecha para mostrarla en el PDF
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX');
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Muestra una alerta al usuario
   */
  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  /**
   * Método alternativo para navegadores web
   */
  async downloadInBrowser(pdfData: string, filename: string): Promise<void> {
    if (this.platform.is('mobileweb') || this.platform.is('desktop')) {
      const blob = this.base64ToBlob(pdfData.split(',')[1], 'application/pdf');
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    }
  }

  /**
   * Convierte base64 a Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}