import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Platform } from '@ionic/angular';
import { AlertController } from '@ionic/angular';
import { Browser } from '@capacitor/browser';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  constructor(
    private platform: Platform,
    private alertController: AlertController
  ) { }

  async generarPDFCompleto(
    usuario: any,
    movimientos: any[],
    resumen: {
      saldo: number;
      limite: number;
      usado: number;
      restante: number;
    }
  ): Promise<void> {
    // 1. Crear documento
    const doc = new jsPDF();

    // 2. Portada
    this.addCoverPage(doc, usuario);

    // 3. Resumen financiero
    this.addFinancialSummary(doc, resumen);

    // 4. Movimientos
    this.addTransactions(doc, movimientos);

    // 5. Guardar
    const fileName = `Reporte_Ekonomi_${usuario.username}_${new Date().getTime()}.pdf`;
    await this.savePdf(doc, fileName);
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

  private addFinancialSummary(doc: jsPDF, resumen: any): void {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Financiero', 14, 20);

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
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 }
      }
    });

    doc.addPage();
  }

  private addTransactions(doc: jsPDF, movimientos: any[]): void {
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
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
  }

  private async savePdf(doc: jsPDF, fileName: string): Promise<void> {
    try {
      const blob = doc.output('blob');
      const url = window.URL.createObjectURL(blob);

      if (this.platform.is('hybrid')) {
        // App nativa: usa Capacitor Browser
        await Browser.open({ url });
      } else {
        // Navegador: abrir en nueva pestaña
        window.open(url, '_blank');
      }

      // Si prefieres descarga directa en navegador, descomenta esto:
      // const a = document.createElement('a');
      // a.href = url;
      // a.download = fileName;
      // a.click();

    } catch (error) {
      console.error('Error al mostrar PDF:', error);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'No se pudo abrir el PDF',
        buttons: ['OK']
      });
      await alert.present();
    }
  }
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }


  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
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
}