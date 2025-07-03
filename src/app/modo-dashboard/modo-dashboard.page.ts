// modo-manual.page.ts (versión corregida)
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ViewChild } from '@angular/core';
import { IonRefresher, LoadingController } from '@ionic/angular';
import { ManualTransactionService } from '../services/manual-transaction.service';
import { Storage } from '@ionic/storage-angular';
import { ModoService } from '../services/modo.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

import { ModalController } from '@ionic/angular';
import { ModalManualPage } from '../modal-manual/modal-manual.page';

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

  gastoMensualActual = 0;
  porcentajeGastado = 0;
  diasRestantesMes = 0;

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
    private modoService: ModoService,
    private firestore: Firestore,
    private modalCtrl: ModalController,

  ) { }

  private initialLoadComplete = false;
  private dataLoading = false;

  async ngOnInit() {
    await this.storage.create();
    this.loadInitialData();
  }

  private async loadInitialData() {
    this.dataLoading = true;
    
    this.userSubscription = this.authService.user$.subscribe({
      next: async (user) => {
        this.user = user;
        if (user) {
          try {
            await this.loadData();
          } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error al cargar datos');
          }
        } else {
          this.router.navigate(['/home']);
        }
        this.initialLoadComplete = true;
        this.dataLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar usuario:', err);
        this.showToast('Error al cargar datos del usuario');
        this.dataLoading = false;
      }
    });
  }

  async loadData() {
    // Bloquea la UI durante la carga
    this.dataLoading = true;
    
    try {
      const [userData, movimientos] = await Promise.all([
        this.authService.getCurrentUserData(),
        this.manualTransactionService.getTransactions().pipe(take(1)).toPromise()
      ]);

      // Asignar todos los datos de una vez
      this.monthlyLimit = userData?.limiteMensualManual || 0;
      this.saldo = userData?.saldoManual || 0;
      this.gastoMensualActual = userData?.gastoMensualActualManual || 0;
      
      this.movimientos = (movimientos ?? []).map(t => ({
        id: t.id,
        tipo: t.tipo,
        descripcion: t.descripcion || 'Sin descripción',
        monto: +t.monto,
        categoria: t.categoria || 'Otros',
        fecha: t.fecha?.toDate?.() || t.createdAt?.toDate?.() || new Date()
      })).sort((a, b) => b.fecha - a.fecha);

      this.calcularEstadisticasManuales();
    } finally {
      this.dataLoading = false;
    }
  }

  async loadUserData() {
    try {
      const userData = await this.authService.getCurrentUserData();
      if (userData) {
        this.monthlyLimit = userData.limiteMensualManual || 0;
        this.saldo = userData.saldoManual || 0;
        this.gastoMensualActual = userData.gastoMensualActualManual || 0;

        this.calcularEstadisticasManuales();
      }
    } catch (error) {
      console.error('Error al cargar datos manuales:', error);
      this.showToast('Error al cargar datos');
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
          // Procesar movimientos para el modo manual
          this.movimientos = transactions.map(t => ({
            id: t.id,
            tipo: t.tipo,
            descripcion: t.descripcion || 'Sin descripción',
            monto: +t.monto, // Asegurar que es número
            categoria: t.categoria || 'Otros',
            fecha: t.fecha?.toDate?.() || t.createdAt?.toDate?.() || new Date()
          })).sort((a, b) => b.fecha - a.fecha); // Ordenar por fecha más reciente

          // Calcular estadísticas
          this.calcularEstadisticasManuales();
        },
        error: (err) => {
          console.error('Error al cargar movimientos manuales:', err);
          this.showToast('Error al cargar movimientos');
        }
      });
    } finally {
      await loading.dismiss();
    }
  }

  private calcularEstadisticasManuales() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filtrar movimientos del mes actual
    const movimientosMes = this.movimientos.filter(m => {
      const fechaMov = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
      return fechaMov >= inicioMes;
    });

    // Calcular ingresos del mes
    this.ingresoMes = movimientosMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0);

    // Usar gastoMensualActualManual como fuente principal para gastos
    this.limitLeft = Math.max(0, this.monthlyLimit - this.gastoMensualActual);
    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min((this.gastoMensualActual / this.monthlyLimit) * 100, 100)
      : 0;

    // Calcular días restantes
    const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.diasRestantesMes = ultimoDiaMes.getDate() - now.getDate();
  }

  private computeMonthlyStats() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calcular días restantes en el mes
    const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.diasRestantesMes = ultimoDiaMes.getDate() - now.getDate();

    // El gastoMensualActual ya viene positivo de Firestore
    this.limitLeft = Math.max(0, this.monthlyLimit - this.gastoMensualActual);
    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((this.gastoMensualActual / this.monthlyLimit) * 100), 100)
      : 0;

    // Actualizar saldo manual (ya se maneja con signo en el servicio)
    this.authService.updateSaldo(this.saldo, 'manual')
      .catch(err => console.error('Error al actualizar saldo:', err));
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
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Continuar',
          handler: async (data) => {
            const newLimit = Number(data.limite);
            if (isNaN(newLimit)) {
              this.showToast('El límite ingresado no es válido');
              return false;
            }

            await this.confirmResetGastos(newLimit);
            return false;
          }
        }
      ]
    });
    await alert.present();
  }


  private async confirmResetGastos(newLimit: number) {
    const confirm = await this.alertCtrl.create({
      header: '¿Reiniciar gastos del mes?',
      message: '¿Deseas reiniciar el contador de gastos mensuales a cero? Esto es recomendado al cambiar el límite.',
      buttons: [
        {
          text: 'No, usar gastos mensuales',
          handler: async () => {
            await this.updateLimit(newLimit, false);
          }
        },
        {
          text: 'Sí, reiniciar',
          handler: async () => {
            await this.updateLimit(newLimit, true);
          }
        }
      ]
    });
    await confirm.present();
  }

  private async updateLimit(newLimit: number, resetGastos: boolean) {
    const loading = await this.loadingController.create({
      message: 'Actualizando límite...'
    });
    await loading.present();

    try {
      // 1. Actualizar el límite primero
      await this.authService.setLimit(newLimit, 'manual');

      if (resetGastos) {
        // Opción: Reiniciar gastos
        await this.authService.resetGastoMensualManual();
        this.gastoMensualActual = 0;
        this.showToast('Límite actualizado y gastos reiniciados');
      } else {
        // Opción: Mantener gastos
        // Calcula los gastos actuales desde los movimientos manuales
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
        const gastosActuales = this.movimientos
          .filter(m => {
            const fechaMov = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
            return fechaMov >= inicioMes && m.tipo === 'gasto';
          })
          .reduce((sum, m) => sum + +m.monto, 0);

        // Actualiza Firestore con los gastos calculados
        await this.authService.updateGastoMensualManual(gastosActuales);
        this.gastoMensualActual = gastosActuales;
        this.showToast('Límite actualizado correctamente');
      }

      // Actualizar UI
      this.monthlyLimit = newLimit;
      this.porcentajeGastado = this.monthlyLimit > 0
        ? Math.min(Math.round((this.gastoMensualActual / this.monthlyLimit) * 100), 100)
        : 0;

    } catch (error) {
      console.error('Error al actualizar límite:', error);
      const errorMessage = (error as any)?.message || 'Error al guardar límite';
      this.showToast(errorMessage);
    } finally {
      await loading.dismiss();
    }
  }

  async resetearGastoMensual() {
    const alert = await this.alertCtrl.create({
      header: '¿Comenzar nuevo mes?',
      message: 'Esto reseteará tu contador de gastos mensuales a cero.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              await this.authService.resetGastoMensualManual();
              this.gastoMensualActual = 0;
              this.porcentajeGastado = 0;
              this.showToast('Contador de gastos reiniciado');
            } catch (error) {
              this.showToast('Error al reiniciar contador');
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

  abrirModalAgregar() {
    this.router.navigate(['/modal-manual']);
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

