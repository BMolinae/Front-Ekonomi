import { Component, OnInit } from '@angular/core';
import { IonicModule }     from '@ionic/angular';
import { CommonModule }    from '@angular/common';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [
    IonicModule,
    CommonModule
  ],
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
})
export class ChatbotPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
