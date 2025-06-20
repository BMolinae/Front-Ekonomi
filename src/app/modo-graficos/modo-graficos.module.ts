import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { ModoGraficosPage } from './modo-graficos.page';

@NgModule({
  imports: [
    RouterModule.forChild([{ path: '', component: ModoGraficosPage }]),
    ModoGraficosPage // ✅ lo importas, no lo declaras
  ]
})
export class ModoGraficosPageModule {}
