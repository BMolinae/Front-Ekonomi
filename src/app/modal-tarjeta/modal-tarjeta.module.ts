import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ModalTarjetaPage } from './modal-tarjeta.page';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: ModalTarjetaPage
      }
    ])
  ]
})
export class ModalTarjetaPageModule {}
