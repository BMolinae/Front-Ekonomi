// src/app/reset-password/reset-password.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { ResetPasswordPageRoutingModule } from './reset-password-routing.module';
import { ResetPasswordPage } from './reset-password.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    // si realmente no lo necesitas aquí, puedes quitar FormsModule; el standalone ya trae ReactiveFormsModule
    ResetPasswordPageRoutingModule,
    ResetPasswordPage     // <-- IMPORTA el componente standalone aquí
  ],
  // ¡fuera declarations! el componente standalone no va en declarations
})
export class ResetPasswordPageModule {}
