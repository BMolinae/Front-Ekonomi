import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { ModoChatbotPage } from './modo-chatbot.page';

@NgModule({
  imports: [
    RouterModule.forChild([{ path: '', component: ModoChatbotPage }]),
    ModoChatbotPage // ✅ IMPORTA el componente standalone aquí
  ]
})
export class ModoChatbotPageModule {}
