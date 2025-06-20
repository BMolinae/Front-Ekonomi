import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ModoDashboardPage } from './modo-dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: ModoDashboardPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModoDashboardPageRoutingModule {}
