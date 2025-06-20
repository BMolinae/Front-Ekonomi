import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModoDashboardPage } from './modo-dashboard.page';

describe('ModoDashboardPage', () => {
  let component: ModoDashboardPage;
  let fixture: ComponentFixture<ModoDashboardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModoDashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
