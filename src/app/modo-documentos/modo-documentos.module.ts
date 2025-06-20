import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ModoDocumentosPageRoutingModule } from './modo-documentos-routing.module';

import { ModoDocumentosPage } from './modo-documentos.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ModoDocumentosPageRoutingModule
  ],
  declarations: [ModoDocumentosPage]
})
export class ModoDocumentosPageModule {}
