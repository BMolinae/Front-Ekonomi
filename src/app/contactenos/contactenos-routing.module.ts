import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ContactenosPage } from './contactenos.page';

const routes: Routes = [
  {
    path: '',
    component: ContactenosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContactenosPageRoutingModule {}
