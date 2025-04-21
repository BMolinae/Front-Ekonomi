import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CreateAccountPage } from './create-account.page';

@NgModule({
  imports: [
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