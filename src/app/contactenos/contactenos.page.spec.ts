import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactenosPage } from './contactenos.page';

describe('ContactenosPage', () => {
  let component: ContactenosPage;
  let fixture: ComponentFixture<ContactenosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ContactenosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
