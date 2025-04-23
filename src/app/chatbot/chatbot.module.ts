import { NgModule }      from '@angular/core';
import { CommonModule }  from '@angular/common';
import { IonicModule }   from '@ionic/angular';
import { ChatbotPage }   from './chatbot.page';
import { RouterModule }  from '@angular/router';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ChatbotPage,
    RouterModule.forChild([{ path: '', component: ChatbotPage }])
  ]
})
export class ChatbotPageModule {}
