import { NgModule }         from '@angular/core';
import { CommonModule }     from '@angular/common';
import { IonicModule }      from '@ionic/angular';
import { DocumentosPage }   from './documentos.page';
import { RouterModule }     from '@angular/router';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    DocumentosPage,
    RouterModule.forChild([{ path: '', component: DocumentosPage }])
  ]
})
export class DocumentosPageModule {}
