import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Platform } from '@ionic/angular';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  constructor(
    private platform: Platform,
    private alertController: AlertController
  ) {}

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

      // 6. Guardar el archivo según la plataforma
      const fileName = `ekonomi_${usuario.username}_${new Date().getTime()}.pdf`;
      const pdfBlob = doc.output('blob');

      if (this.platform.is('hybrid')) {
        // Para dispositivos móviles
        const base64Data = await this.blobToBase64(pdfBlob);
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path: fileName
        });

        await FileOpener.open({ 
          filePath: fileUri.uri,
          contentType: 'application/pdf'
        });
      } else {
        // Para navegador
        this.downloadInBrowser(URL.createObjectURL(pdfBlob), fileName);
      }

    } catch (error) {
      console.error('Error en generación de PDF:', error);
      await this.showAlert(
        'Error',
        'No se pudo generar el PDF. Por favor, intenta nuevamente.'
      );
      throw error;
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Solo la parte base64
      };
      reader.readAsDataURL(blob);
    });
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-MX');
    } catch (error) {
      return dateString;
    }
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private downloadInBrowser(url: string, filename: string): void {
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