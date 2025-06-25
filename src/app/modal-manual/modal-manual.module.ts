import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ModalManualPage } from './modal-manual.page';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        component: ModalManualPage
      }
    ])
  ]
})
export class ModalManualPageModule {}
