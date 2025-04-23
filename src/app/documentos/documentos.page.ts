import { Component, OnInit } from '@angular/core';
import { IonicModule }     from '@ionic/angular';
import { CommonModule }    from '@angular/common';

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [IonicModule, CommonModule],
  templateUrl: './documentos.page.html',
  styleUrls: ['./documentos.page.scss'],
})
export class DocumentosPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
