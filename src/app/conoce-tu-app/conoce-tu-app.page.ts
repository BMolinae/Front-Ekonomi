import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';


@Component({
  selector: 'app-conoce-tu-app',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,        // <— aquí
    RouterModule
  ],
  templateUrl: './conoce-tu-app.page.html',
  styleUrls: ['./conoce-tu-app.page.scss'],
})
export class ConoceTuAppPage{
  

  constructor(
    private navCtrl:  NavController,
  ) { }

  goBack() {
    this.navCtrl.back();
  }

  ngOnInit() {
    
  }

}
