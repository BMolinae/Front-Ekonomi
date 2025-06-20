import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ModoChatbotPage } from './modo-chatbot.page';

const routes: Routes = [
  {
    path: '',
    component: ModoChatbotPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ModoChatbotPageRoutingModule {}
