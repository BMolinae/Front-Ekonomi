import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Platform } from '@ionic/angular';
import { AlertController } from '@ionic/angular';
import { AndroidPermissions } from '@awesome-cordova-plugins/android-permissions/ngx';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  constructor(
    private platform: Platform,
    private alertController: AlertController,
    private androidPermissions: AndroidPermissions
  ) { }
  async generarPDFCompleto(
    usuario: any,
    movimientos: any[],
    resumen: { saldo: number; limite: number; usado: number; restante: number },
    csvData: string,
    chartImages: { id: string, name: string, dataUrl: string }[]
  ): Promise<void> {
    try {
      // 1. Crear el documento PDF
      const doc = new jsPDF();

      // 2. Portada
      this.addCoverPage(doc, usuario);

      // 3. Resumen financiero
      this.addFinancialSummary(doc, usuario, resumen);

      // 4. Gráficos
      this.addChartsSection(doc, chartImages);

      // 5. Datos CSV
      this.addCsvDataSection(doc, csvData);

      // 6. Movimientos
      this.addTransactionsSection(doc, movimientos);

      // 7. Guardar el archivo
      const fileName = `ekonomi_reporte_completo_${new Date().getTime()}.pdf`;
      await this.savePdf(doc, fileName);

    } catch (error) {
      console.error('Error en generación de PDF completo:', error);
      await this.showAlert('Error', 'No se pudo generar el PDF completo.');
      throw error;
    }
  }

  private addCoverPage(doc: jsPDF, usuario: any): void {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Reporte Completo - Ekonomi', 105, 40, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(`Usuario: ${usuario.username || 'N/A'}`, 105, 60, { align: 'center' });
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 105, 70, { align: 'center' });

    doc.addPage();
  }

  private addFinancialSummary(doc: jsPDF, usuario: any, resumen: any): void {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Financiero', 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');

    const summaryData = [
      ['Saldo Actual', `$${resumen.saldo.toLocaleString('es-MX')}`],
      ['Límite Mensual', `$${resumen.limite.toLocaleString('es-MX')}`],
      ['Gastado este Mes', `$${resumen.usado.toLocaleString('es-MX')}`],
      ['Saldo Restante', `$${resumen.restante.toLocaleString('es-MX')}`],
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Concepto', 'Valor']],
      body: summaryData,
      styles: {
        cellPadding: 5,
        fontSize: 11,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { cellWidth: 'auto' }
      }
    });

    doc.addPage();
  }

  private addChartsSection(doc: jsPDF, charts: { id: string, name: string, dataUrl: string }[]): void {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Gráficos de Resumen', 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');

    let yPosition = 30;

    for (const chart of charts) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(chart.name, 14, yPosition);
      yPosition += 10;

      try {
        const imgProps = doc.getImageProperties(chart.dataUrl);
        const width = doc.internal.pageSize.getWidth() - 30;
        const height = (imgProps.height * width) / imgProps.width;

        doc.addImage(chart.dataUrl, 'PNG', 15, yPosition, width, height);
        yPosition += height + 15;
      } catch (error) {
        console.error(`Error al agregar gráfico ${chart.id}:`, error);
        doc.text(`Error al cargar el gráfico ${chart.name}`, 14, yPosition);
        yPosition += 20;
      }
    }

    doc.addPage();
  }

  private addCsvDataSection(doc: jsPDF, csvData: string): void {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Datos de Usuarios (CSV)', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Dividir el CSV en líneas y mostrarlo
    const lines = csvData.split('\n');
    let yPosition = 30;

    for (const line of lines) {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
        doc.setFontSize(10);
      }

      doc.text(line, 14, yPosition);
      yPosition += 7;
    }

    doc.addPage();
  }

  private addTransactionsSection(doc: jsPDF, movimientos: any[]): void {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Historial de Movimientos', 14, 20);

    const data = movimientos.map(m => [
      this.formatDate(m.fecha),
      m.categoria || 'Sin categoría',
      m.descripcion || 'Sin descripción',
      m.tipo === 'ingreso' ? `$${m.monto.toLocaleString('es-MX')}` : `-$${m.monto.toLocaleString('es-MX')}`,
      m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'
    ]);

    autoTable(doc, {
      startY: 30,
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
  }

  private async savePdf(doc: jsPDF, fileName: string): Promise<void> {
    const pdfBlob = doc.output('blob');

    if (this.platform.is('hybrid')) {
      try {
        // 1. Convertir a base64
        const base64Data = await this.blobToBase64(pdfBlob);

        // 2. Definir ruta de guardado
        const path = `Download/${fileName}`; // Guardar en la carpeta Download

        // 3. Escribir archivo
        const result = await Filesystem.writeFile({
          path,
          data: base64Data,
          directory: Directory.ExternalStorage, // Usar almacenamiento externo
          encoding: Encoding.UTF8,
        });

        // 4. Mostrar notificación
        if (this.platform.is('android')) {
          await this.showAndroidNotification(fileName, result.uri);
        }

      } catch (error) {
        console.error('Error al guardar PDF:', error);
        throw error;
      }
    } else {
      // Para navegador
      this.downloadInBrowser(URL.createObjectURL(pdfBlob), fileName);
    }
  }

  private async showAndroidNotification(fileName: string, fileUri: string): Promise<void> {
    try {
      // Opción para abrir el archivo
      const alert = await this.alertController.create({
        header: 'Reporte guardado',
        message: `El archivo ${fileName} se ha guardado correctamente. ¿Deseas abrirlo ahora?`,
        buttons: [
          {
            text: 'Abrir',
            handler: async () => {
              await FileOpener.open({
                filePath: fileUri,
                contentType: 'application/pdf'
              });
            }
          },
          {
            text: 'Más tarde',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
    } catch (error) {
      console.error('Error al mostrar notificación:', error);
    }
  }

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

  private async verifyAndroidPermissions(): Promise<boolean> {
  try {
    const permissions = [
      this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE,
      this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE
    ];

    const results = await Promise.all(
      permissions.map(p => this.androidPermissions.checkPermission(p))
    );

    const needsRequest = results.some(r => !r.hasPermission);

    if (needsRequest) {
      const requestResults = await Promise.all(
        permissions.map(p => this.androidPermissions.requestPermission(p))
      );
      
      return requestResults.every(r => r.hasPermission);
    }

    return true;
  } catch (error) {
    console.error('Error verificando permisos:', error);
    return false;
  }
}
}