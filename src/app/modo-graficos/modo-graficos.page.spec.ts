import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModoGraficosPage } from './modo-graficos.page';

describe('ModoGraficosPage', () => {
  let component: ModoGraficosPage;
  let fixture: ComponentFixture<ModoGraficosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModoGraficosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
