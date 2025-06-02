// src/app/dashboard/dashboard.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription, interval, switchMap, tap, of, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MovimientosService } from '../services/movimientos.service';
import { FirestoreService } from '../services/firestore.service';
import { ViewChild } from '@angular/core';
import { IonRefresher, LoadingController } from '@ionic/angular';
import { createAnimation } from '@ionic/angular';
import { ModalController } from '@ionic/angular';
import { AgregarMovimientoPage } from '../modals/agregar-movimiento/agregar-movimiento.page';
import { CardService } from '../services/card.service';





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

  userData: any;

  user: any = null;
  movimientos: any[] = [];

  saldo = 0;
  tarjeta = '';
  tarjetas: any[] = [];
  tarjetaActiva: any = null;

  ingresoMes = 0;
  gastosMes = 0;
  limitLeft = 0;
  percentOfLimit = 0;
  monthlyLimit = 0;

  limiteMensual: number = 0;


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
    private cardService: CardService
  ) { }

  async doRefresh(event: any) {
    // Mostrar el loading mientras actualiza
    const loading = await this.loadingController.create({
      message: 'Actualizando app...',
      spinner: 'crescent',
      duration: 3000 // auto-dismiss tras 1.5s
    });
    await loading.present();

    // Simular actualización (ejecuta tu lógica real aquí)
    this.actualizarTodo();

    // Espera mínimo 1 segundo antes de cerrar refresher
    setTimeout(() => {
      event.target.complete(); // o this.refresher.complete() si no pasas el $event
    }, 3000);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user?.limiteMensual != null) {
        this.monthlyLimit = user.limiteMensual;
        this.limitLeft = user.limiteMensual - this.gastosMes;
        this.percentOfLimit = user.limiteMensual > 0
          ? Math.min(Math.round((this.gastosMes / user.limiteMensual) * 100), 100)
          : 0;
      }
    });

    this.actualizarTodo();

    window.addEventListener('refreshDashboard', () => {
      console.log('Actualizando desde botón de home');

      setTimeout(() => {
        this.refresher?.complete();
      }, 1000);

      this.actualizarTodo();
    });
    this.authService.user$.subscribe(user => {
      this.user = user;

      if (user) {
        this.firestoreService.getUserDataObservable()?.subscribe(userData => {
          if (userData) {
            this.tarjeta = userData.tarjeta || '';
            this.monthlyLimit = userData.limite_mensual || 0;
          }
        });

        this.loadMovimientos();
      } else {
        this.router.navigate(['/login']);
      }
    });

    this.subscription = this.cardService.cardLimitUpdated$.subscribe(updated => {
      if (updated) {
        this.loadUserData(); // 👈 recargamos la info
        this.cardService.resetNotification();
      }
    });

    this.loadUserData();
  }

  loadUserData() {
    this.authService.getCurrentUser().then(data => {
      this.userData = data;
      this.monthlyLimit = data?.limiteMensual || 0;
    });
  }

  actualizarTodo(event?: any) {
    this.authService.getCurrentUser()
      .then(user => {
        this.user = user;
        this.tarjeta = user?.tarjeta || '';
        this.monthlyLimit = user?.limite_mensual || 0;
        return this.movimientosService.obtenerMovimientos();
      })
      .then(movs => {
        this.movimientos = movs;
        this.computeMonthlyStats();
        if (event) event.target.complete();
      })
      .catch(err => {
        console.error('Error al actualizar datos', err);
        if (event) event.target.complete();
      });
  }

  

  private customEnterAnimation(baseEl: any) {
    const backdropAnimation = createAnimation()
      .addElement(baseEl.querySelector('ion-backdrop'))
      .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = createAnimation()
      .addElement(baseEl.querySelector('.loading-wrapper'))
      .keyframes([
        { offset: 0, opacity: '0', transform: 'scale(0.9)' },
        { offset: 1, opacity: '1', transform: 'scale(1)' }
      ])
      .beforeStyles({
        'color': 'black',
        'background': 'white'
      });

    return createAnimation()
      .addElement(baseEl)
      .easing('ease-in-out')
      .duration(300)
      .addAnimation([backdropAnimation, wrapperAnimation]);
  }

  private customLeaveAnimation(baseEl: any) {
    return this.customEnterAnimation(baseEl).direction('reverse');
  }

  ngAfterViewInit() {
    window.addEventListener('refreshDashboard', this.handleRefreshEvent);
  }

  ngOnDestroy() {
    window.removeEventListener('refreshDashboard', () => this.actualizarTodo());
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

  }

  private handleRefreshEvent = () => {
    console.log('Actualizando desde botón de home');
    setTimeout(() => {
      this.refresher?.complete();
    }, 1000);
    this.actualizarTodo();
  };


  private async loadMovimientos() {
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

    const nuevoSaldo = ingresos - gastos;
    const nuevoLimite = this.monthlyLimit - gastos;

    this.ingresoMes = ingresos;
    this.gastosMes = gastos;
    this.saldo = nuevoSaldo;
    this.limitLeft = nuevoLimite;

    this.percentOfLimit = this.monthlyLimit > 0
      ? Math.min(Math.round((gastos / this.monthlyLimit) * 100), 100)
      : 0;

    this.saveFinancialData();

    if (this.user && this.user.saldo !== nuevoSaldo) {
      this.authService.updateSaldo(nuevoSaldo);
    }
  }

  private saveFinancialData() {
    const data = {
      saldo: this.saldo,
      gastosMes: this.gastosMes,
      ingresoMes: this.ingresoMes,
      limitLeft: this.limitLeft,
    };
    localStorage.setItem('user_financial_data', JSON.stringify(data));
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  toggleBalance() {
    this.isBalanceHidden = !this.isBalanceHidden;
  }

  toggleUserPanel() {
    this.isUserPanelExpanded = !this.isUserPanelExpanded;
  }

  conoceTuApp() {
    this.goTo('conoce-tu-app');
  }

  politicaUso() {
    this.goTo('politica-uso');
  }

  contactenos() {
    this.goTo('contactenos');
  }

  cerrarSesion() {
    this.authService.logout().then(() => {
      this.authService.reset(); // ✅ Limpia el estado en memoria
      this.router.navigate(['/login']);
    }).catch(error => {
      console.error('Error al cerrar sesión:', error);
    });
  }



  getCategoriaIcono(nombreCategoria: string): string {
    const iconos: any = {
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

  async onAddCard() {
    const alert = await this.alertCtrl.create({
      header: 'Agregar Tarjeta',
      inputs: [
        { name: 'cardNumber', type: 'text', placeholder: 'Número 16 dígitos', attributes: { maxlength: 16 } },
        { name: 'cardHolder', type: 'text', placeholder: 'Nombre del Titular' },
        { name: 'expiryDate', type: 'month', placeholder: 'Fecha de Vencimiento' },
        { name: 'cvv', type: 'password', placeholder: 'CVV', attributes: { maxlength: 3 } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async data => {
            const rawNumber = (data.cardNumber || '').replace(/\D/g, '');
            const holder = (data.cardHolder || '').trim();
            const expiry = data.expiryDate || '';
            const cvv = (data.cvv || '').trim();

            const isValid = rawNumber.length === 16 && holder && expiry && cvv.length >= 3;
            if (!isValid) {
              this.showToast('Completa correctamente todos los campos');
              return false;
            }

            const formatted = rawNumber.match(/.{1,4}/g)!.join('-');

            try {
              await this.authService.addCard(formatted);

              const updated = await this.authService.getCurrentUser();
              this.user = updated;
              this.tarjeta = updated.tarjeta || '';
              await this.loadMovimientos();
            } catch (err) {
              console.error('Error al guardar tarjeta o crear movimiento', err);
              this.showToast('Hubo un error al guardar la tarjeta');
            }

            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  async onSetLimit() {
    const alert = await this.alertCtrl.create({
      header: 'Poner Límite Mensual',
      inputs: [{ name: 'limite', type: 'number', placeholder: 'Ingresa límite' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async data => {
            const x = Number(data.limite);
            if (x > 0) {
              await this.authService.setLimit(x);
              // Ya no es necesario: const updated = await this.authService.getCurrentUser()
              // Ya no es necesario: this.monthlyLimit = updated.limiteMensual;
              this.loadMovimientos(); // sigue siendo útil
              return true;
            } else {
              this.showToast('Ingresa un número mayor a 0');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }


  private async showToast(msg: string) {
    const toast = await this.alertCtrl.create({
      header: 'Atención',
      message: msg,
      buttons: ['OK']
    });
    await toast.present();
  }

  async abrirModalAgregar() {
    const modal = await this.modalCtrl.create({
      component: AgregarMovimientoPage,
    });
    modal.onDidDismiss().then((res) => {
      if (res.data) {
        this.loadMovimientos(); // refresca la lista
      }
    });
    await modal.present();
  }



}

