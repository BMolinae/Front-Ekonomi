import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ModoDocumentosPage } from './modo-documentos.page';

const routes: Routes = [
  {
    path: '',
    component: ModoDocumentosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModoDocumentosPageRoutingModule {}
