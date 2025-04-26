import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PoliticaUsoPageRoutingModule } from './politica-uso-routing.module';

import { PoliticaUsoPage } from './politica-uso.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PoliticaUsoPage,
    PoliticaUsoPageRoutingModule
  ],
})
export class PoliticaUsoPageModule {}
