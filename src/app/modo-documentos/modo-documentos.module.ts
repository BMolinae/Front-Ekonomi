import { NgModule }         from '@angular/core';
import { CommonModule }     from '@angular/common';
import { IonicModule }      from '@ionic/angular';
import { RouterModule }     from '@angular/router';

import { ModoDocumentosPage } from './modo-documentos.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ModoDocumentosPage,
    RouterModule.forChild([{ path: '', component: ModoDocumentosPage }])
  ]
})
export class ModoDocumentosPageModule {}
