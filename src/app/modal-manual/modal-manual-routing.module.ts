import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ModalManualPage } from './modal-manual.page';

const routes: Routes = [
  {
    path: '',
    component: ModalManualPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModalManualPageRoutingModule {}
