import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalManualPage } from './modal-manual.page';

describe('ModalManualPage', () => {
  let component: ModalManualPage;
  let fixture: ComponentFixture<ModalManualPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalManualPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
