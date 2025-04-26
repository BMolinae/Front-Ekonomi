import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ConoceTuAppPageRoutingModule } from './conoce-tu-app-routing.module';

import { ConoceTuAppPage } from './conoce-tu-app.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ConoceTuAppPage,
    ConoceTuAppPageRoutingModule
  ],
})
export class ConoceTuAppPageModule {}
