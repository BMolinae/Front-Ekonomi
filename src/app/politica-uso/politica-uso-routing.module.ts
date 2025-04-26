import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PoliticaUsoPage } from './politica-uso.page';

const routes: Routes = [
  {
    path: '',
    component: PoliticaUsoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PoliticaUsoPageRoutingModule {}
