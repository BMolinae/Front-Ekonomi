import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConoceTuAppPage } from './conoce-tu-app.page';

describe('ConoceTuAppPage', () => {
  let component: ConoceTuAppPage;
  let fixture: ComponentFixture<ConoceTuAppPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ConoceTuAppPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
