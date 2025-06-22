import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CreateAccountPage } from './create-account.page';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild([
      {
        path: '',
        component: CreateAccountPage, // 👈 Asignación directa
      },
    ]),
    CreateAccountPage, // 👈 Lo importamos directamente porque es standalone
  ],
})
export class CreateAccountPageModule {}