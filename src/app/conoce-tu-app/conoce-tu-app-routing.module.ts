import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConoceTuAppPage } from './conoce-tu-app.page';

const routes: Routes = [
  {
    path: '',
    component: ConoceTuAppPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConoceTuAppPageRoutingModule {}
