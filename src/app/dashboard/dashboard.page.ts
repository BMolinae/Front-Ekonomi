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
  saldo = 0;
  tarjeta = '';
  cardType = '';
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
        this.router.navigate(['/login']);
      }
    });

    this.subscription = this.cardService.cardLimitUpdated$.subscribe(() => {
      this.loadUserData();
    });
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
  }

  async loadUserData() {
    const userData = await this.authService.getCurrentUser();
    if (userData) {
      this.tarjeta = userData.tarjeta || '';
      this.cardType = userData.cardType || '';
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

    const ingresos = movMes
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + +m.monto, 0);

    const gastos = movMes
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + +m.monto, 0);

    this.ingresoMes = ingresos;
    this.gastosMes = gastos;
    this.saldo = ingresos - gastos;
    this.limitLeft = this.monthlyLimit - gastos;

    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((gastos / this.monthlyLimit) * 100), 100)
      : 0;

    this.saveFinancialData();
  }

  private saveFinancialData() {
    const data = {
      saldo: this.saldo,
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
              if (!data.cardNumber || data.cardNumber.length !== 16) {
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
      await this.loadMovimientos();
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
    try {
      await this.authService.logout();
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
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