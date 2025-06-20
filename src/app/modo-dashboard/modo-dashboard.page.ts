// modo-manual.page.ts (versión corregida)
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ViewChild } from '@angular/core';
import { IonRefresher, LoadingController } from '@ionic/angular';
import { ManualTransactionService } from '../services/manual-transaction.service';
import { Storage } from '@ionic/storage-angular';
import { ModoService } from '../services/modo.service';

@Component({
  selector: 'app-modo-manual',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './modo-dashboard.page.html',
  styleUrls: ['./modo-dashboard.page.scss'],
})
export class ModoDashboardPage implements OnInit, OnDestroy {
  @ViewChild('refresher', { static: false }) refresher!: IonRefresher;
  private transactionsSubscription?: Subscription;
  private userSubscription?: Subscription;

  // Datos del usuario
  user: any = null;
  saldo = 0;
  movimientos: any[] = [];

  // Estadísticas
  ingresoMes = 0;
  gastosMes = 0;
  limitLeft = 0;
  percentOfLimit = 0;
  monthlyLimit = 0;

  // UI States
  isBalanceHidden = false;
  isUserPanelExpanded = false;

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private authService: AuthService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private manualTransactionService: ManualTransactionService,
    private storage: Storage,
    private modoService: ModoService
  ) { }

  async ngOnInit() {
    await this.storage.create();
    this.loadInitialData();
  }

  private loadInitialData() {
    this.userSubscription = this.authService.user$.subscribe({
      next: async (user) => {
        this.user = user;
        if (user) {
          await this.loadData();
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        console.error('Error al cargar usuario:', err);
        this.showToast('Error al cargar datos del usuario');
      }
    });
  }

  private async loadData() {
    await Promise.all([
      this.loadUserData(),
      this.loadMovimientos()
    ]);
  }

  async loadUserData() {
    try {
      const userData = await this.authService.getCurrentUser();
      if (userData) {
        this.monthlyLimit = userData.limiteMensual || 0;
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      throw error;
    }
  }

  async loadMovimientos() {
    const loading = await this.loadingController.create({
      message: 'Cargando movimientos...',
      spinner: 'bubbles',
    });
    await loading.present();

    try {
      if (this.transactionsSubscription) {
        this.transactionsSubscription.unsubscribe();
      }

      this.transactionsSubscription = this.manualTransactionService.getTransactions().subscribe({
        next: (transactions) => {
          // Mapear las transacciones para que coincidan con la estructura del modo tarjeta
          this.movimientos = transactions.map(t => ({
            id: t.id,
            tipo: t.tipo,
            descripcion: t.descripcion,
            monto: Math.abs(t.monto),
            categoria_nombre: t.categoria || 'Otros',
            fecha: t.createdAt?.toDate?.() || t.fecha || new Date()
          }));

          this.computeMonthlyStats();
        },
        error: (err) => {
          console.error('Error al cargar movimientos:', err);
          this.showToast('Error al cargar movimientos');
        }
      });
    } finally {
      await loading.dismiss();
    }
  }

  private computeMonthlyStats() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filtrar movimientos del mes actual
    const movMes = this.movimientos.filter(m => {
      const fechaMov = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
      return fechaMov >= inicioMes;
    });

    // Calcular ingresos y gastos
    const ingresos = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    const gastos = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    // Actualizar estadísticas
    this.ingresoMes = ingresos;
    this.gastosMes = gastos;
    this.saldo = ingresos - gastos;
    this.limitLeft = Math.max(0, this.monthlyLimit - gastos);

    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((gastos / this.monthlyLimit) * 100), 100)
      : 0;
  }


  async abrirModalAgregar() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Movimiento Manual',
      inputs: [
        {
          name: 'descripcion',
          type: 'text',
          placeholder: 'Descripción'
        },
        {
          name: 'monto',
          type: 'number',
          placeholder: 'Monto',
          attributes: {
            inputmode: 'decimal',
            min: '0.01'
          }
        },
        {
          name: 'tipo',
          type: 'text',
          placeholder: 'Tipo (ingreso/gasto)',
          value: 'gasto'
        },
        {
          name: 'categoria',
          type: 'text',
          placeholder: 'Categoría',
          value: 'Otros'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (!data.descripcion || !data.monto) {
              this.showToast('Descripción y monto son requeridos');
              return false;
            }

            const montoNumber = Number(data.monto);
            if (isNaN(montoNumber) || montoNumber <= 0) {
              this.showToast('El monto debe ser un número positivo');
              return false;
            }

            const tipo = data.tipo.trim().toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';

            try {
              await this.manualTransactionService.addTransaction({
                descripcion: data.descripcion.trim(),
                monto: tipo === 'ingreso' ? montoNumber : -montoNumber,
                tipo,
                categoria: data.categoria?.trim() || 'Otros',
                fecha: new Date().toISOString()
              });

              this.showToast('Movimiento guardado correctamente');
              return true;
            } catch (error) {
              console.error('Error guardando movimiento:', error);
              this.showToast('Error al guardar movimiento');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top'
    });
    await toast.present();
  }

  async actualizarTodo(event?: any) {
    try {
      await this.loadData();
    } catch (error) {
      console.error('Error al actualizar:', error);
      this.showToast('Error al actualizar datos');
    } finally {
      if (event) event.target.complete();
    }
  }



  async onSetLimit() {
    const alert = await this.alertCtrl.create({
      header: 'Establecer Límite Mensual',
      inputs: [{
        name: 'limite',
        type: 'number',
        placeholder: `Máximo: $${this.saldo}`,
        min: '0',
        max: this.saldo.toString(),
        attributes: {
          inputmode: 'decimal'
        }
      }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            const newLimit = Number(data.limite);
            try {
              await this.authService.setLimit(newLimit, this.saldo);
              this.monthlyLimit = newLimit;
              this.computeMonthlyStats();
              this.showToast('Límite actualizado correctamente');
              return true;
            } catch (error: any) {
              this.showToast(error.message || 'Error al guardar límite');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async switchToAutoMode() {
    try {
      this.modoService.setModoManual(false);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Error al cambiar a modo automático:', error);
      this.showToast('Error al cambiar de modo');
    }
  }





  toggleUserPanel() {
    this.isUserPanelExpanded = !this.isUserPanelExpanded;
  }

  conoceTuApp() {
    this.router.navigate(['/conoce-tu-app']);
  }

  politicaUso() {
    this.router.navigate(['/politica-uso']);
  }

  contactenos() {
    this.router.navigate(['/contactenos']);
  }

  async cerrarSesion() {
    try {
      await this.authService.logout();
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  getCategoriaIcono(nombreCategoria: string): string {
    const iconos: Record<string, string> = {
      Transporte: 'bus-outline',
      Alimentacion: 'restaurant-outline',
      Salud: 'medkit-outline',
      Educacion: 'book-outline',
      Entretenimiento: 'game-controller-outline',
      Hogar: 'home-outline',
      Otros: 'ellipsis-horizontal-outline',
    };
    return iconos[nombreCategoria] || 'pricetag-outline';
  }

  ngOnDestroy() {
    this.transactionsSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }
}

