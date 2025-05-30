import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgregarMovimientoPage } from './agregar-movimiento.page';

describe('AgregarMovimientoPage', () => {
  let component: AgregarMovimientoPage;
  let fixture: ComponentFixture<AgregarMovimientoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AgregarMovimientoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
