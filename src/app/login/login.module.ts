import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { LoginPage } from './login.page';  // Importa directamente el componente
import { LoginPageRoutingModule } from './login-routing.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    LoginPageRoutingModule,  // Asegúrate de que el routing esté importado
    LoginPage,  // IMPORTA EL COMPONENTE DIRECTAMENTE AQUÍ
  ],
})
export class LoginPageModule {}
