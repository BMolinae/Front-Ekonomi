import { Component, OnInit } from '@angular/core';
import { saveAs } from 'file-saver';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Chart, registerables } from 'chart.js';
import { PdfService } from '../services/pdf.service'; 
import { AuthService } from '../services/auth.service';
import { Movimiento } from '../services/movimiento.model';

Chart.register(...registerables);

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule
  ],
  templateUrl: './documentos.page.html',
  styleUrls: ['./documentos.page.scss'],
})
export class DocumentosPage implements OnInit {
  charts = [
    { id: 'gauge', name: 'Uso del Límite' },
    { id: 'pie',   name: 'Distribución por Categorías' },
    { id: 'bar',   name: 'Comparación Mensual' },
  ];

  constructor(
    private firestore: Firestore,
    private auth: AuthService,
    private pdfService: PdfService
  ) {}

  ngOnInit(): void {}

  async downloadReport(type: 'monthly' | 'csv' | string): Promise<void> {
    if (type === 'csv') {
      await this.generateCSV();
    } else if (type === 'monthly') {
      await this.generatePDF();
    } else if (this.charts.some(c => c.id === type)) {
      await this.generatePNG(type);
    }
  }

  private async generateCSV() {
    const snapshot = await getDocs(collection(this.firestore, 'users'));
    let csv = 'username,email,saldo,limite_mensual\n';

    snapshot.forEach(doc => {
      const d: any = doc.data();
      csv += `${d.username},${d.email},${d.saldo},${d.limite_mensual}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, `ekonomi_usuarios.csv`);
  }

  private async generatePNG(type: string) {
    const canvas = document.getElementById(`${type}-chart`) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`No se encontró el canvas para el gráfico ${type}`);
      return;
    }

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), 'image/png');
    });

    if (blob) {
      saveAs(blob, `ekonomi_${type}.png`);
    } else {
      console.error('No se pudo generar la imagen');
    }
  }

  private async generatePDF() {
    const user = await this.auth.getCurrentUser();
    if (!user) {
      console.error('Usuario no autenticado');
      return;
    }

    const movimientos = await this.auth.getMovimientos();
    const saldo = user.saldo || 0;
    const limite = user.limite_mensual || 0;
    const usado = movimientos
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);
    const restante = limite - usado;

    const resumen = { saldo, limite, usado, restante };
    this.pdfService.generarPDF(user, movimientos, resumen);
  }
}
