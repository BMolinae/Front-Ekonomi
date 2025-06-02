import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MovimientosService } from 'src/app/services/movimientos.service';
import { FirestoreService } from 'src/app/services/firestore.service';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavParams } from '@ionic/angular';

@Component({
  selector: 'app-agregar-movimiento',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
  ],
  templateUrl: './agregar-movimiento.page.html',
})
export class AgregarMovimientoPage implements OnInit {
  form: FormGroup;
  categorias: any[] = [];
  idTarjeta!: string;

  constructor(
    private modalCtrl: ModalController,
    private fb: FormBuilder,
    private movimientosService: MovimientosService,
    private firestoreService: FirestoreService,
    private navParams: NavParams
  ) {
    this.form = this.fb.group({
      descripcion: ['', Validators.required],
      monto: [null, Validators.required],
      tipo: ['gasto', Validators.required],
      categoria: ['', Validators.required],
      fecha: [new Date().toISOString(), Validators.required],
    });
  }

  ngOnInit() {
    this.idTarjeta = this.navParams.get('idTarjeta');
    this.firestoreService.getCategorias().subscribe(cats => {
      this.categorias = cats;
    });
  }

  cerrarModal() {
    this.modalCtrl.dismiss();
  }

  async guardarMovimiento() {
    console.log(this.form.value, this.form.valid);
    if (this.form.invalid) {
      console.log('Formulario inválido');
      return;
    }

    const { tipo, descripcion, monto, categoria } = this.form.value;

    try {
      await this.movimientosService.agregarMovimiento(
        tipo,
        descripcion,
        monto,
        categoria,
        this.idTarjeta
      );
      this.modalCtrl.dismiss(true);
    } catch (error) {
      console.error('Error al guardar movimiento', error);
    }
  }
}
