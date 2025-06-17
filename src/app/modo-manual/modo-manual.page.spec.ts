import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModoManualPage } from './modo-manual.page';

describe('ModoManualPage', () => {
  let component: ModoManualPage;
  let fixture: ComponentFixture<ModoManualPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModoManualPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
