import { NgModule }           from '@angular/core';
import { CommonModule }       from '@angular/common';
import { IonicModule }        from '@ionic/angular';
import { GraficosPage }       from './graficos.page';
import { RouterModule }       from '@angular/router';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    GraficosPage,
    RouterModule.forChild([{ path: '', component: GraficosPage }])
  ]
})
export class GraficosPageModule {}
