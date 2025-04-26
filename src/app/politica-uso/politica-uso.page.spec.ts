import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PoliticaUsoPage } from './politica-uso.page';

describe('PoliticaUsoPage', () => {
  let component: PoliticaUsoPage;
  let fixture: ComponentFixture<PoliticaUsoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PoliticaUsoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
