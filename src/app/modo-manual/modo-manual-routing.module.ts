import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ModoManualPage } from './modo-manual.page';

const routes: Routes = [
  {
    path: '',
    component: ModoManualPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModoManualPageRoutingModule {}
