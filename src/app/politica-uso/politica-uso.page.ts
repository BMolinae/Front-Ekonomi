import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';

@Component({
  selector: 'app-politica-uso',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,     // <— necesario para ion-content, ion-icon, ion-button...
  ],
  templateUrl: './politica-uso.page.html',
  styleUrls: ['./politica-uso.page.scss'],
})
export class PoliticaUsoPage {

  constructor( private navCtrl: NavController) { }

  goBack() {
    this.navCtrl.back();
  }

  ngOnInit() {
  }

}
