import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ViewChild } from '@angular/core';
import { IonRefresher, LoadingController } from '@ionic/angular';
import { ModalController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { ManualTransactionService } from '../services/manual-transaction.service';

@Component({
  selector: 'app-modo-manual',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './modo-manual.page.html',
  styleUrls: ['./modo-manual.page.scss'],
})
export class ModoManualPage implements OnInit, OnDestroy {
  @ViewChild('refresher', { static: false }) refresher!: IonRefresher;
  private subscription?: Subscription;

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
    private modalCtrl: ModalController,
    private storage: Storage,
    private toastController: ToastController,
    private manualTransactionService: ManualTransactionService
  ) { }

  async ngOnInit() {
    await this.storage.create();
    this.loadCachedData();

    this.authService.user$.subscribe(async user => {
      this.user = user;
      if (user) {
        await this.loadData();
        await this.manualTransactionService.syncLocalTransactions();
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  private async loadCachedData() {
    const cachedData = await this.storage.get('manual_financial_data');
    if (cachedData) {
      this.movimientos = cachedData.movimientos || [];
      this.monthlyLimit = cachedData.monthlyLimit || 0;
      this.saldo = cachedData.saldo || 0;
      this.computeMonthlyStats();
    }
  }

  private async loadData() {
    await Promise.all([
      this.loadUserData(),
      this.loadMovimientos()
    ]);
  }

  async loadUserData() {
    const userData = await this.authService.getCurrentUser();
    if (userData) {
      this.monthlyLimit = userData.limiteMensual || 0;
      this.saveFinancialData();
    }
  }

  async loadMovimientos() {
    const loading = await this.loadingController.create({
      message: 'Cargando movimientos...',
      spinner: 'bubbles',
    });
    await loading.present();

    try {
      this.movimientos = await this.manualTransactionService.getTransactions();
      this.computeMonthlyStats();
      await this.saveFinancialData();
    } catch (err) {
      console.error('Error al cargar movimientos', err);
      this.showToast('Error al cargar movimientos. Usando datos locales.');
    } finally {
      await loading.dismiss();
    }
  }

  private computeMonthlyStats() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const movMes = this.movimientos.filter(m => new Date(m.fecha) >= inicioMes);

    const ingresos = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    const gastos = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.ingresoMes = ingresos;
    this.gastosMes = gastos;
    this.saldo = ingresos - gastos; // Aquí se hace la diferencia correcta
    this.limitLeft = this.monthlyLimit - gastos;

    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((gastos / this.monthlyLimit) * 100), 100)
      : 0;
  }

  private saveFinancialData() {
    const data = {
      movimientos: this.movimientos,
      saldo: this.saldo,
      monthlyLimit: this.monthlyLimit,
      gastosMes: this.gastosMes,
      ingresoMes: this.ingresoMes
    };
    return this.storage.set('manual_financial_data', data);
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
          attributes: { inputmode: 'decimal' }
        },
        {
          name: 'tipo',
          type: 'text',
          placeholder: 'Escribe: ingreso o gasto' // ✅ más claro
        },
        {
          name: 'categoria',
          type: 'text',
          placeholder: 'Categoría (opcional)'
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

            // ✅ Normalizamos el texto: quita espacios y convierte a minúscula
            const tipoLimpio = (data.tipo || '').trim().toLowerCase();

            // ✅ Solo acepta 'ingreso' o 'gasto', todo lo demás será 'gasto' por defecto
            const tipo = tipoLimpio === 'ingreso' ? 'ingreso' : 'gasto';

            const newTransaction = {
              descripcion: data.descripcion,
              monto: +data.monto,
              tipo,
              categoria: data.categoria?.trim() || 'Otros',
              fecha: new Date().toISOString()
            };

            try {
              await this.manualTransactionService.addTransaction(newTransaction);
              this.movimientos.unshift(newTransaction);
              this.computeMonthlyStats();
              await this.saveFinancialData();
              this.showToast('Movimiento guardado correctamente');
              return true;
            } catch (error) {
              this.showToast('Error guardando movimiento');
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
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Error al cambiar a modo automático:', error);
      this.showToast('Error al cambiar de modo');
    }
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
      await this.loadUserData();
      await this.loadMovimientos();
      if (event) event.target.complete();
    } catch (error) {
      console.error('Error al actualizar:', error);
      if (event) event.target.complete();
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
    this.subscription?.unsubscribe();
  }
}