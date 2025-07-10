import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MovimientosService } from '../services/movimientos.service';
import { FirestoreService } from '../services/firestore.service';
import { ViewChild } from '@angular/core';
import { IonRefresher, LoadingController } from '@ionic/angular';
import { createAnimation } from '@ionic/angular';
import { ModalController } from '@ionic/angular';
import { CardService } from '../services/card.service';
import { Storage } from '@ionic/storage-angular';
import { ModoService } from '../services/modo.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit, OnDestroy {
  @ViewChild('refresher', { static: false }) refresher!: IonRefresher;
  private subscription?: Subscription;



  // Datos del usuario
  user: any = null;
  saldoTarjeta = 0;
  tarjeta = '';
  cardType = '';
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

  isLoggingOut = false;

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private authService: AuthService,
    private movimientosService: MovimientosService,
    private firestoreService: FirestoreService,
    private loadingController: LoadingController,
    private modalCtrl: ModalController,
    private cardService: CardService,
    private storage: Storage,
    private toastController: ToastController,
    private modoService: ModoService
  ) { }

  async ngOnInit() {
    await this.storage.create();
    this.loadCachedData();

    this.authService.user$.subscribe(user => {
      this.user = user;
      if (user) {
        this.loadData();
      } else {
        this.router.navigate(['/home']);
      }
    });

    this.subscription = this.cardService.cardLimitUpdated$.subscribe(() => {
      this.loadUserData();
    });
  }

  private calcularDiasRestantesMes() {
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.diasRestantesMes = ultimoDiaMes.getDate() - hoy.getDate();
  }

  private async loadCachedData() {
    const cachedData = await this.storage.get('user_financial_data');
    if (cachedData) {
      this.monthlyLimit = cachedData.monthlyLimit || 0;
    }
  }

  private async loadData() {
    await Promise.all([
      this.loadUserData(),
      this.loadMovimientos()
    ]);
    this.calcularDiasRestantesMes();
  }

  async loadUserData() {
    try {
      const userData = await this.authService.getCurrentUserData();
      if (userData) {
        this.tarjeta = userData.tarjeta || '';
        this.cardType = userData.cardType || '';
        this.monthlyLimit = userData.limiteMensual || 0;
        this.saldoTarjeta = userData.saldoTarjeta || 0;
        this.gastoMensualActual = userData.gastoMensualActual || 0; // <-- Fuente principal

        this.porcentajeGastado = this.monthlyLimit > 0
          ? Math.min(Math.round((this.gastoMensualActual / this.monthlyLimit) * 100), 100)
          : 0;
      }
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
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
      this.movimientos = await this.movimientosService.obtenerMovimientos();
      this.computeMonthlyStats();
    } catch (err) {
      console.error('Error al cargar movimientos', err);
      this.showToast('Error al cargar movimientos');
    } finally {
      await loading.dismiss();
    }
  }

  private computeMonthlyStats() {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const movMes = this.movimientos.filter(m => new Date(m.fecha) >= inicioMes);

    // Calcular solo ingresos (gastos vienen de Firestore)
    this.ingresoMes = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    // Usar gastoMensualActual como fuente principal
    this.limitLeft = this.monthlyLimit - this.gastoMensualActual;
    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((this.gastoMensualActual / this.monthlyLimit) * 100), 100)
      : 0;

    console.log('Estadísticas:', {
      saldoFirestore: this.saldoTarjeta,
      ingresos: this.ingresoMes,
      gastosFirestore: this.gastoMensualActual
    });
  }




  private saveFinancialData() {
    const data = {
      saldoTarjeta: this.saldoTarjeta,
      monthlyLimit: this.monthlyLimit,
      gastosMes: this.gastosMes,
      ingresoMes: this.ingresoMes
    };
    this.storage.set('user_financial_data', data);
  }

  async onSetLimit() {
    const alert = await this.alertCtrl.create({
      header: 'Establecer Límite Mensual',
      inputs: [{
        name: 'limite',
        type: 'number',
        placeholder: `Máximo: $${this.saldoTarjeta}`,
        min: '0',
        max: this.saldoTarjeta.toString(),
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

            // Mostrar confirmación para resetear gastos
            await this.confirmResetGastos(newLimit);
            return false; // Evitar que el alert se cierre automáticamente
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
      await this.authService.setLimit(newLimit, 'tarjeta');

      if (resetGastos) {
        // Opción: Reiniciar gastos
        await this.authService.resetGastoMensual();
        this.gastoMensualActual = 0;
        this.showToast('Límite actualizado y gastos reiniciados');
      } else {
        // Opción: Mantener gastos
        // Calcula los gastos actuales desde los movimientos
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
        const gastosActuales = this.movimientos
          .filter(m => new Date(m.fecha) >= inicioMes && m.tipo === 'gasto')
          .reduce((sum, m) => sum + +m.monto, 0);

        // Actualiza Firestore con los gastos calculados
        await this.authService.updateGastoMensual(gastosActuales);
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
              await this.authService.resetGastoMensual();
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

  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        {
          name: 'cardNumber',
          type: 'text',
          placeholder: 'Número de tarjeta (16 dígitos)',
          attributes: { maxlength: 16, inputmode: 'numeric' }
        },
        {
          name: 'cardName',
          type: 'text',
          placeholder: 'Nombre del titular'
        },
        {
          name: 'expiryDate',
          type: 'month',
          placeholder: 'Fecha de expiración'
        },
        {
          name: 'cvv',
          type: 'password',
          placeholder: 'CVV (3 dígitos)',
          attributes: { maxlength: 3, inputmode: 'numeric' }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            try {
              // Validación de campos
              if (!data.cardNumber || data.cardNumber.length !== 16 || !/^\d{16}$/.test(data.cardNumber)) {
                this.showToast('Número de tarjeta inválido');
                return false;
              }
              if (!data.cardName) {
                this.showToast('Ingrese el nombre del titular');
                return false;
              }
              if (!data.expiryDate) {
                this.showToast('Seleccione fecha de expiración');
                return false;
              }

              if (!data.expiryDate) {
                this.showToast('Seleccione fecha de expiración');
                return false;
              }
              const today = new Date();
              const [month, year] = data.expiryDate.split('/');
              const monthNumber = parseInt(month, 10);
              const yearNumber = parseInt(year, 10) + 2000; // "25" → 2025
              const expiryDate = new Date(yearNumber, monthNumber, 0);

              if (expiryDate < today) {
                this.showToast('La tarjeta está vencida');
                return false;
              }

              if (!data.cvv || data.cvv.length !== 3) {
                this.showToast('CVV inválido');
                return false;
              }

              // Determinar tipo de tarjeta
              const cardType = this.determineCardType(data.cardNumber);

              // Guardar tarjeta y recargar saldo
              await this.authService.addCard({
                number: data.cardNumber,
                name: data.cardName,
                expiry: data.expiryDate,
                cvv: data.cvv,
                type: cardType
              });

              this.showToast(`Tarjeta ${cardType} agregada con éxito!`);
              this.loadMovimientos();
              return true;
            } catch (error: any) {
              this.showToast(error.message || 'Error al agregar tarjeta');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private determineCardType(cardNumber: string): string {
    const firstDigit = cardNumber.charAt(0);
    switch (firstDigit) {
      case '4': return 'Visa';
      case '5': return 'Mastercard';
      case '3': return 'American Express';
      default: return 'Otra';
    }
  }
  // Resto de métodos existentes (toggleBalance, abrirModalAgregar, etc.) se mantienen igual
  // ... 

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
      this.movimientos = await this.movimientosService.obtenerMovimientos(true); // Forzar actualización
      this.computeMonthlyStats();
      if (event) event.target.complete();
    } catch (error) {
      console.error('Error al actualizar:', error);
      if (event) event.target.complete();
    }
  }

  // Métodos del panel de usuario
  toggleUserPanel() {
    this.isUserPanelExpanded = !this.isUserPanelExpanded;
  }

  // Métodos de navegación
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
    this.router.navigate(['/modal-tarjeta'])
  }

  async switchToManualMode() {
    try {
      this.modoService.setModoManual(true);
      await this.router.navigate(['/modo-dashboard']);
    } catch (error) {
      console.error('Error al cambiar a modo manual:', error);
      this.showToast('Error al cambiar de modo');
    }
  }

  async cerrarSesion() {
    const loading = await this.loadingController.create({
      message: 'Cerrando sesión...',
      spinner: 'crescent',
      duration: 1500
    });

    await loading.present();

    try {
      await this.authService.logout();

      this.isLoggingOut = true;  // Mostrar animación overlay

      await this.router.navigate(['/home']);

      setTimeout(() => {
        location.reload();  // Forzar recarga para limpiar todo el estado
      }, 500);

    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      loading.dismiss();
    }
  }

  // Método para mostrar/ocultar saldo
  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  // Método para abrir modal de agregar movimiento


  // Método para obtener iconos de categoría
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